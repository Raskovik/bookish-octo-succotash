"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { bbcodeToHtml } from "@/lib/bbcode";
import type { PetFolderColor } from "@/lib/supabase/types";

/**
 * The "den" (/pets) page — ported from furgarden-design's js/pets.js
 * reference implementation to React state instead of manual DOM
 * patching, per the design handoff for the "den/my pets" page.
 *
 * Three deliberate departures from the handoff, each one the user's own
 * call when asked (see commit message / PR description for the full
 * reasoning):
 *
 * 1. HP and food points have no real backend yet — this app already
 *    has a different, working pet-vitality system (energy, see
 *    pet-energy.ts + the real per-pet Feed button on /pets/[petId]) —
 *    so hp/hpMax and food points here are a stable, per-pet synthetic
 *    placeholder (see syntheticHp() below), and feeding only updates
 *    local state, never the database. This matches how the reference
 *    js/pets.js itself behaves with no `data-api` configured ("runs in
 *    memory," its own words) rather than a bug — the visual and the
 *    interaction are both real, just not persisted. A second pass
 *    reconciles this with the real energy system.
 * 2. "Groups" are the existing pet_folders table (0012), extended with
 *    color/bio/sort_order (0051) rather than a new parallel concept —
 *    group CRUD here is plain RLS-gated client writes, matching 0012's
 *    own "folders hold nothing sensitive" convention. Only the bulk
 *    pet-move goes through an RPC (move_pets_to_folder, 0051), since
 *    pets has no client UPDATE policy at all.
 * 3. Drag-and-drop, multi-select with a persistent selection, and the
 *    6-second Undo toast are all real and fully wired (not simplified).
 *
 * Bulk for-trade tagging (the old page's BulkForTradeButton) has no
 * place in this design and is dropped from this page; a pet's own
 * for-trade toggle on /pets/[petId] is unaffected. "Upgrade your den"
 * is wired to the real expand_den RPC (not a dead link to a shop page
 * that doesn't exist), styled to match the handoff's plain text link.
 */

// A pet's hp/hpMax everywhere below is derived from this, not stored —
// see the file-level comment. Deterministic per pet id so a given
// pet's bar doesn't jump around between renders/pagination.
function syntheticHp(petId: string): { hp: number; hpMax: number } {
  let h = 0;
  for (let i = 0; i < petId.length; i++) h = (h * 31 + petId.charCodeAt(i)) >>> 0;
  const hpMax = 100;
  const hp = 10 + (h % 91); // 10–100: same wide spread as the handoff's own sample data
  return { hp, hpMax };
}

const COLORS: PetFolderColor[] = ["leaf", "blue", "orange", "rose", "plum"];
const MAX_GROUPS = 12;
const NAME_MAX = 20;
const BIO_MAX = 500;
const PER_PAGE = 8;
const PER_PAGE_SMALL = 18;

export type UIPet = {
  id: string;
  name: string;
  level: number;
  img: string | null;
  typeName: string;
  groupId: string | null;
};

// UIPet plus the synthetic hp/hpMax every pet gets on mount — see the
// file-level comment on syntheticHp().
type Pet = UIPet & { hp: number; hpMax: number };

export type UIGroup = {
  id: string;
  name: string;
  color: PetFolderColor;
  bio: string;
  sortOrder: number;
};

type Tab = "all" | "none" | string;
type SortKey = "name" | "level" | "levellow" | "hp";

export function PetsApp({
  userId,
  userName,
  capacity,
  initialGroups,
  initialPets,
}: {
  userId: string;
  userName: string;
  capacity: number;
  initialGroups: UIGroup[];
  initialPets: UIPet[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [groups, setGroups] = useState<UIGroup[]>(initialGroups);
  const [pets, setPets] = useState<Pet[]>(() => initialPets.map((p) => ({ ...p, ...syntheticHp(p.id) })));
  const [food, setFood] = useState(() => Math.max(100, initialPets.length * 20));

  const [tab, setTab] = useState<Tab>("all");
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("name");
  const [small, setSmall] = useState(false);

  const [selMode, setSelMode] = useState(false);
  const [picked, setPicked] = useState<Record<string, true>>({});

  const [editingBio, setEditingBio] = useState(false);
  const [bioDraft, setBioDraft] = useState<string | null>(null);
  const [bioPreview, setBioPreview] = useState(false);
  const bioTextareaRef = useRef<HTMLTextAreaElement>(null);

  const [draggingPetId, setDraggingPetId] = useState<string | null>(null);
  // dragover/drop need the current value synchronously, within the
  // same native-event dispatch chain that dragstart's setState is
  // still batched in — a ref reads correctly immediately, where state
  // can still be stale across those events. draggingPetId (state)
  // stays for anything that renders from it (the "dragging" class,
  // noGroupVisible); this ref exists only for the drag handlers below.
  const draggingPetIdRef = useRef<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null); // "" = No group

  // Dragging a pet onto a group now requires holding Shift (plain
  // dragstart still fires without it — HTML5 drag-and-drop has no
  // modifier-key gate of its own — so onCardDragStart cancels it via
  // e.preventDefault() unless e.shiftKey is set). This just drives the
  // "grab" cursor hint; the actual gate is in onCardDragStart.
  const [shiftHeld, setShiftHeld] = useState(false);
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Shift") setShiftHeld(true);
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.key === "Shift") setShiftHeld(false);
    }
    function onBlur() {
      setShiftHeld(false);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [hasUndo, setHasUndo] = useState(false);
  const undoRef = useRef<(() => void) | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const manageDialogRef = useRef<HTMLDialogElement>(null);

  function groupById(id: string | null) {
    return id === null ? null : groups.find((g) => g.id === id) ?? null;
  }

  function inTab(t: Tab) {
    return pets.filter((p) => t === "all" || (t === "none" ? p.groupId === null : p.groupId === t));
  }

  function perPage() {
    return small ? PER_PAGE_SMALL : PER_PAGE;
  }

  // Falls back to "all" once the requested tab stops existing (a
  // deleted group, or the "No group" tab emptying out) — computed
  // during render instead of a setState-in-effect so there's no extra
  // render cycle just to self-correct.
  const effectiveTab: Tab = useMemo(() => {
    if (tab === "none") return inTab("none").length === 0 ? "all" : "none";
    if (tab !== "all" && !groupById(tab)) return "all";
    return tab;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, groups, pets]);

  const filteredSorted = useMemo(() => {
    const a = inTab(effectiveTab).filter((p) => !query || p.name.toLowerCase().includes(query.toLowerCase()));
    a.sort((x, y) => {
      if (sort === "level") return y.level - x.level;
      if (sort === "levellow") return x.level - y.level;
      if (sort === "hp") return x.hp / x.hpMax - y.hp / y.hpMax;
      return x.name.localeCompare(y.name);
    });
    return a;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pets, effectiveTab, query, sort]);

  const totalPages = Math.max(1, Math.ceil(filteredSorted.length / perPage()));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filteredSorted.slice((currentPage - 1) * perPage(), currentPage * perPage());

  function toast(msg: string, undo?: () => void) {
    setToastMsg(msg);
    undoRef.current = undo ?? null;
    setHasUndo(!!undo);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(
      () => {
        setToastMsg(null);
        undoRef.current = null;
        setHasUndo(false);
      },
      undo ? 6000 : 2600,
    );
  }

  /* ---------- den expansion (real RPC) ---------- */

  const [isExpanding, setIsExpanding] = useState(false);

  async function expandDen() {
    setIsExpanding(true);
    const { error } = await supabase.rpc("expand_den", { p_user_id: userId });
    setIsExpanding(false);
    if (error) {
      toast(error.message);
      return;
    }
    router.refresh();
  }

  /* ---------- feeding (local-only simulation — see file-level comment) ---------- */

  const feedDialogRef = useRef<HTMLDialogElement>(null);
  const [feedScope, setFeedScope] = useState<Tab>("all");
  const [feedPlan, setFeedPlan] = useState<{ pet: Pet; give: number }[]>([]);

  const feedPool = inTab(effectiveTab);
  const feedMissing = feedPool.reduce((s, p) => s + (p.hpMax - p.hp), 0);
  const feedHungryCount = feedPool.filter((p) => p.hp < p.hpMax).length;
  const feedScopeLabel = effectiveTab === "all" ? "all" : effectiveTab === "none" ? "these" : "group";
  const feedScopeMissing = inTab(feedScope).reduce((s, p) => s + (p.hpMax - p.hp), 0);
  const feedPlanTotal = feedPlan.reduce((s, x) => s + x.give, 0);

  function computeFeedPlan(scope: Tab, foodAvailable: number) {
    let left = foodAvailable;
    const out: { pet: Pet; give: number }[] = [];
    const pool = inTab(scope)
      .filter((p) => p.hp < p.hpMax)
      .sort((a, b) => a.hp / a.hpMax - b.hp / b.hpMax);
    for (const p of pool) {
      const give = Math.min(p.hpMax - p.hp, left);
      if (give > 0) {
        out.push({ pet: p, give });
        left -= give;
      }
    }
    return out;
  }

  function openFeedDialog() {
    setFeedScope(effectiveTab);
    setFeedPlan(computeFeedPlan(effectiveTab, food));
    feedDialogRef.current?.showModal();
  }

  function applyFeed() {
    const plan = feedPlan;
    const spent = plan.reduce((s, x) => s + x.give, 0);
    if (!spent) return;
    setPets((curr) =>
      curr.map((p) => {
        const entry = plan.find((x) => x.pet.id === p.id);
        return entry ? { ...p, hp: p.hp + entry.give } : p;
      }),
    );
    setFood((f) => f - spent);
    feedDialogRef.current?.close();
    toast(`Fed ${plan.length} ${plan.length === 1 ? "pet" : "pets"} with food points`);
  }

  /* ---------- moving pets (real, bulk RPC) ---------- */

  async function sendMove(ids: string[], gid: string | null) {
    const { error } = await supabase.rpc("move_pets_to_folder", {
      p_user_id: userId,
      p_pet_ids: ids,
      p_folder_id: gid,
    });
    return error;
  }

  async function moveTo(ids: string[], gid: string | null) {
    if (ids.length === 0) return;
    const prevMap = new Map<string, string | null>();
    ids.forEach((id) => prevMap.set(id, pets.find((p) => p.id === id)?.groupId ?? null));

    setPets((curr) => curr.map((p) => (ids.includes(p.id) ? { ...p, groupId: gid } : p)));
    setPicked({});
    setPage(1);

    const error = await sendMove(ids, gid);
    if (error) {
      setPets((curr) => curr.map((p) => (prevMap.has(p.id) ? { ...p, groupId: prevMap.get(p.id)! } : p)));
      toast("That didn't save. Please try again.");
      return;
    }

    const destName = gid === null ? "No group" : groupById(gid)?.name ?? "group";
    const firstName = pets.find((p) => p.id === ids[0])?.name ?? "Pet";
    toast(ids.length === 1 ? `${firstName} moved to ${destName}` : `${ids.length} pets moved to ${destName}`, () => {
      setPets((curr) => curr.map((p) => (prevMap.has(p.id) ? { ...p, groupId: prevMap.get(p.id)! } : p)));
      const byTarget = new Map<string, string[]>();
      prevMap.forEach((prevGid, id) => {
        const key = prevGid ?? "";
        byTarget.set(key, [...(byTarget.get(key) ?? []), id]);
      });
      (async () => {
        for (const [key, idsForTarget] of byTarget) {
          await sendMove(idsForTarget, key === "" ? null : key);
        }
      })();
      toast("Move undone");
    });
  }

  /* ---------- select mode ---------- */

  function toggleSelMode() {
    setSelMode((v) => !v);
    setPicked({});
  }

  function togglePick(id: string) {
    setPicked((curr) => {
      const next = { ...curr };
      if (next[id]) delete next[id];
      else next[id] = true;
      return next;
    });
  }

  /* ---------- drag and drop ---------- */

  function onCardDragStart(e: React.DragEvent, id: string) {
    if (!e.shiftKey) {
      e.preventDefault();
      return;
    }
    draggingPetIdRef.current = id;
    setDraggingPetId(id);
  }
  function onCardDragEnd() {
    draggingPetIdRef.current = null;
    setDraggingPetId(null);
    setDropTarget(null);
  }
  function onDropTargetOver(e: React.DragEvent, key: string) {
    if (!draggingPetIdRef.current) return;
    e.preventDefault();
    setDropTarget(key);
  }
  function onDropTargetLeave(key: string) {
    setDropTarget((curr) => (curr === key ? null : curr));
  }
  function onDropTargetDrop(e: React.DragEvent, key: string) {
    e.preventDefault();
    const id = draggingPetIdRef.current;
    draggingPetIdRef.current = null;
    setDraggingPetId(null);
    setDropTarget(null);
    if (!id) return;
    void moveTo([id], key === "" ? null : key);
  }

  /* ---------- group CRUD (plain RLS-gated client writes) ---------- */

  async function addGroup() {
    if (groups.length >= MAX_GROUPS) return;
    const color = COLORS[groups.length % COLORS.length];
    const sortOrder = groups.length ? Math.max(...groups.map((g) => g.sortOrder)) + 1 : 0;
    const { data, error } = await supabase
      .from("pet_folders")
      .insert({ owner_id: userId, name: "New group", color, bio: "", sort_order: sortOrder })
      .select("id")
      .single();
    if (error || !data) {
      toast("Couldn't create a new group.");
      return;
    }
    setGroups((curr) => [...curr, { id: data.id, name: "New group", color, bio: "", sortOrder }]);
  }

  function renameGroupLocal(id: string, name: string) {
    setGroups((curr) => curr.map((g) => (g.id === id ? { ...g, name } : g)));
  }
  async function persistGroupName(id: string, name: string) {
    const trimmed = name.trim() || "Group";
    await supabase.from("pet_folders").update({ name: trimmed }).eq("id", id).eq("owner_id", userId);
  }

  async function setGroupColor(id: string, color: PetFolderColor) {
    setGroups((curr) => curr.map((g) => (g.id === id ? { ...g, color } : g)));
    await supabase.from("pet_folders").update({ color }).eq("id", id).eq("owner_id", userId);
  }

  async function reorderGroup(from: number, to: number) {
    if (to < 0 || to >= groups.length) return;
    const ordered = [...groups].sort((a, b) => a.sortOrder - b.sortOrder);
    const a = ordered[from];
    const b = ordered[to];
    const aOrder = a.sortOrder;
    const bOrder = b.sortOrder;
    setGroups((curr) =>
      curr.map((g) => {
        if (g.id === a.id) return { ...g, sortOrder: bOrder };
        if (g.id === b.id) return { ...g, sortOrder: aOrder };
        return g;
      }),
    );
    await Promise.all([
      supabase.from("pet_folders").update({ sort_order: bOrder }).eq("id", a.id).eq("owner_id", userId),
      supabase.from("pet_folders").update({ sort_order: aOrder }).eq("id", b.id).eq("owner_id", userId),
    ]);
  }

  async function deleteGroup(id: string) {
    setGroups((curr) => curr.filter((g) => g.id !== id));
    setPets((curr) => curr.map((p) => (p.groupId === id ? { ...p, groupId: null } : p)));
    await supabase.from("pet_folders").delete().eq("id", id).eq("owner_id", userId);
  }

  async function saveGroupBio(id: string, bio: string) {
    setGroups((curr) => curr.map((g) => (g.id === id ? { ...g, bio } : g)));
    setEditingBio(false);
    setBioDraft(null);
    setBioPreview(false);
    await supabase.from("pet_folders").update({ bio }).eq("id", id).eq("owner_id", userId);
    toast("Bio saved");
  }

  const sortedGroups = useMemo(() => [...groups].sort((a, b) => a.sortOrder - b.sortOrder), [groups]);

  /* ---------- derived UI info ---------- */

  const tabInfo = useMemo(() => {
    if (effectiveTab === "all") return { name: "All pets", bio: "Everyone in your den, all in one place.", color: null as PetFolderColor | null, fixed: true, id: null as string | null };
    if (effectiveTab === "none") return { name: "No group", bio: "Pets that are not in a group yet. Drag them onto a group, or select some and move them.", color: null, fixed: true, id: null };
    const g = groupById(effectiveTab);
    return { name: g?.name ?? "Group", bio: g?.bio ?? "", color: g?.color ?? null, fixed: false, id: g?.id ?? null };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveTab, groups]);

  const noGroupVisible = inTab("none").length > 0 || draggingPetId !== null;

  function wrapBioSelection(open: string, close: string) {
    const el = bioTextareaRef.current;
    if (!el) return;
    const { selectionStart, selectionEnd, value } = el;
    const selected = value.slice(selectionStart, selectionEnd);
    const next = value.slice(0, selectionStart) + open + selected + close + value.slice(selectionEnd);
    setBioDraft(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(selectionStart + open.length, selectionStart + open.length + selected.length);
    });
  }

  return (
    <div className="panel pets">
      <div className="lw-hdr">
        <div className="lw-t">
          <h1>
            {userName}&rsquo;s Pets <small>({pets.length} / {capacity})</small>
          </h1>
          <p className="lw-sub plain">
            <button type="button" className="lnk upg" disabled={isExpanding} onClick={expandDen}>
              <span className="coin gem" aria-hidden="true" />
              {isExpanding ? "Expanding…" : "Upgrade your den for more space?"}
            </button>
          </p>
        </div>
        <div className="pb-hr">
          <div className="fl">
            <button type="button" className="btn btn-orange btn-sm btn-feed" disabled={!feedMissing} onClick={openFeedDialog}>
              {feedMissing ? (
                <>
                  Feed {feedScopeLabel} &middot; {feedMissing}{" "}
                  <span className="food-ic" aria-hidden="true">
                    🍖
                  </span>
                </>
              ) : (
                "Everyone is full"
              )}
            </button>
            <small>
              {feedHungryCount ? (
                <>
                  <b>{feedHungryCount}</b> hungry &middot;{" "}
                </>
              ) : null}
              <span className="food-ic" aria-hidden="true">
                🍖
              </span>{" "}
              <b>{food}</b> available
            </small>
          </div>
        </div>
      </div>

      <div className="rail wr">
        <div>
          <div className="pb-tabs wood" role="tablist" aria-label="Groups">
            <button
              type="button"
              role="tab"
              className="pb-tab c-all"
              aria-selected={effectiveTab === "all"}
              onClick={() => {
                setTab("all");
                setPage(1);
                setEditingBio(false);
                setBioDraft(null);
                setBioPreview(false);
              }}
            >
              <i />
              <span className="n">All pets</span>
              <em>{inTab("all").length}</em>
            </button>
            {noGroupVisible ? (
              <button
                type="button"
                role="tab"
                className={`pb-tab c-all${dropTarget === "" ? " drop" : ""}`}
                aria-selected={effectiveTab === "none"}
                data-drop=""
                onDragOver={(e) => onDropTargetOver(e, "")}
                onDragLeave={() => onDropTargetLeave("")}
                onDrop={(e) => onDropTargetDrop(e, "")}
                onClick={() => {
                  setTab("none");
                  setPage(1);
                  setEditingBio(false);
                  setBioDraft(null);
                  setBioPreview(false);
                }}
              >
                <i />
                <span className="n">No group</span>
                <em>{inTab("none").length}</em>
              </button>
            ) : null}
            {sortedGroups.map((g) => (
              <button
                key={g.id}
                type="button"
                role="tab"
                className={`pb-tab c-${g.color}${dropTarget === g.id ? " drop" : ""}`}
                aria-selected={effectiveTab === g.id}
                data-drop={g.id}
                onDragOver={(e) => onDropTargetOver(e, g.id)}
                onDragLeave={() => onDropTargetLeave(g.id)}
                onDrop={(e) => onDropTargetDrop(e, g.id)}
                onClick={() => {
                  setTab(g.id);
                  setPage(1);
                  setEditingBio(false);
                  setBioDraft(null);
                  setBioPreview(false);
                }}
              >
                <i />
                <span className="n">{g.name}</span>
                <em>{inTab(g.id).length}</em>
              </button>
            ))}
            <button
              type="button"
              className="pb-tab mng"
              onClick={() => manageDialogRef.current?.showModal()}
            >
              Manage groups
            </button>
          </div>
        </div>

        <div>
          <section className="pc lt bio-card gbio-card" aria-labelledby="gb-t">
            <h2 className="ltab" id="gb-t">
              Bio
            </h2>
            <div className="gbio">
              {editingBio && tabInfo.id ? (
                <div className="gedit">
                  <div className="gb-bar" role="toolbar" aria-label="Formatting">
                    <button type="button" className="gb-b" title="Bold" aria-label="Bold" disabled={bioPreview} onClick={() => wrapBioSelection("[b]", "[/b]")}>
                      B
                    </button>
                    <button type="button" className="gb-b" title="Italic" aria-label="Italic" disabled={bioPreview} onClick={() => wrapBioSelection("[i]", "[/i]")}>
                      I
                    </button>
                    <button type="button" className="gb-b" title="Underline" aria-label="Underline" disabled={bioPreview} onClick={() => wrapBioSelection("[u]", "[/u]")}>
                      U
                    </button>
                    <button type="button" className="gb-b" title="Strikethrough" aria-label="Strikethrough" disabled={bioPreview} onClick={() => wrapBioSelection("[s]", "[/s]")}>
                      S
                    </button>
                    <button type="button" className="gb-b" title="Align left" aria-label="Align left" disabled={bioPreview} onClick={() => wrapBioSelection("[left]", "[/left]")}>
                      ⇤
                    </button>
                    <button type="button" className="gb-b" title="Centre" aria-label="Centre" disabled={bioPreview} onClick={() => wrapBioSelection("[center]", "[/center]")}>
                      ↔
                    </button>
                    <button type="button" className="gb-b" title="Align right" aria-label="Align right" disabled={bioPreview} onClick={() => wrapBioSelection("[right]", "[/right]")}>
                      ⇥
                    </button>
                    <button type="button" className="gb-b" title="Link" aria-label="Link" disabled={bioPreview} onClick={() => wrapBioSelection("[url=https://]", "[/url]")}>
                      🔗
                    </button>
                    <button type="button" className="gb-b pv" aria-pressed={bioPreview} onClick={() => setBioPreview((v) => !v)}>
                      {bioPreview ? "Keep editing" : "Preview"}
                    </button>
                  </div>
                  {bioPreview ? (
                    <div
                      className="bbcode gb-pv"
                      dangerouslySetInnerHTML={{ __html: bbcodeToHtml(bioDraft ?? tabInfo.bio) }}
                    />
                  ) : (
                    <textarea
                      ref={bioTextareaRef}
                      maxLength={BIO_MAX}
                      aria-label="Group bio"
                      placeholder="Write something about this group. Supports the same BBCode as forum posts."
                      value={bioDraft ?? tabInfo.bio}
                      onChange={(e) => setBioDraft(e.target.value)}
                    />
                  )}
                  <div className="row2">
                    <button
                      type="button"
                      className="btn btn-sm btn-leaf"
                      onClick={() => tabInfo.id && saveGroupBio(tabInfo.id, (bioDraft ?? tabInfo.bio).trim())}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-cream"
                      onClick={() => {
                        setEditingBio(false);
                        setBioDraft(null);
                        setBioPreview(false);
                      }}
                    >
                      Cancel
                    </button>
                    <small>{(bioDraft ?? tabInfo.bio).length} / {BIO_MAX}</small>
                  </div>
                </div>
              ) : tabInfo.fixed ? (
                <div className="bbcode">
                  <p style={{ margin: 0 }}>{tabInfo.bio}</p>
                </div>
              ) : (
                <>
                  <div className="bbcode">
                    {tabInfo.bio ? (
                      <div dangerouslySetInnerHTML={{ __html: bbcodeToHtml(tabInfo.bio) }} />
                    ) : (
                      <span className="gdesc none">No bio yet.</span>
                    )}
                  </div>
                  <div className="gb-act">
                    <button
                      type="button"
                      className="lnk"
                      onClick={() => {
                        setEditingBio(true);
                        setBioDraft(null);
                        setBioPreview(false);
                      }}
                    >
                      {tabInfo.bio ? "✎ Edit bio" : "Write a bio"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </section>

          <div className="tools">
            <input
              type="search"
              placeholder="Search this group"
              aria-label="Search this group"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
            <div className="sp">
              <select aria-label="Sort by" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                <option value="name">Sort: Name</option>
                <option value="level">Sort: Level (high)</option>
                <option value="levellow">Sort: Level (low)</option>
                <option value="hp">Sort: Needs food first</option>
              </select>
              <span className="seg" role="group" aria-label="Card size">
                <button type="button" aria-pressed={!small} onClick={() => { setSmall(false); setPage(1); }}>
                  Large
                </button>
                <button type="button" aria-pressed={small} onClick={() => { setSmall(true); setPage(1); }}>
                  Small
                </button>
              </span>
              <button type="button" className={`btn btn-sm ${selMode ? "btn-leaf" : "btn-cream"}`} onClick={toggleSelMode}>
                {selMode ? "Done" : "Select"}
              </button>
            </div>
          </div>

          {filteredSorted.length === 0 ? (
            <div className="empty">
              {query ? (
                "No pets match your search."
              ) : (
                <>
                  <b className="empty-t">This group is empty</b>
                  <br />
                  Drag a pet onto it from another tab, or pick several at once.
                  <br />
                  <button type="button" className="btn btn-sm btn-leaf" style={{ marginTop: 12 }} onClick={toggleSelMode}>
                    Select pets
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className={`pgrid${small ? " dense" : ""}${selMode ? " selmode" : ""}`}>
              {pageItems.map((p) => {
                const on = !!picked[p.id];
                const pct = Math.round((p.hp / p.hpMax) * 100);
                const hpClass = pct <= 25 ? " low" : pct <= 50 ? " mid" : "";
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`pet${small ? " dense" : ""}${on ? " on" : ""}${draggingPetId === p.id ? " dragging" : ""}${shiftHeld && !selMode ? " shift-drag" : ""}`}
                    draggable={!selMode}
                    aria-pressed={on}
                    title={selMode ? undefined : "Shift+drag to move to a group"}
                    onDragStart={(e) => onCardDragStart(e, p.id)}
                    onDragEnd={onCardDragEnd}
                    onClick={() => {
                      if (selMode) {
                        togglePick(p.id);
                        return;
                      }
                      router.push(`/pets/${p.id}`);
                    }}
                  >
                    <span className="lv">Lv {p.level}</span>
                    <span className="chk" />
                    <span className="img">
                      {p.img ? <img src={p.img} alt="" /> : null}
                    </span>
                    <span className="nm">{p.name}</span>
                    <span
                      className={`hp${hpClass}`}
                      role="img"
                      aria-label={`Health ${p.hp} of ${p.hpMax}`}
                      title={`${p.hp} / ${p.hpMax} HP`}
                    >
                      <i style={{ width: `${pct}%` }} />
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {totalPages > 1 ? (
            <div className="lw-pager" style={{ justifyContent: "center", margin: "16px 0 0" }}>
              <div className="pg">
                <button type="button" className="big" disabled={currentPage <= 1} aria-label="Previous page" onClick={() => setPage(currentPage - 1)}>
                  ◀
                </button>
                <span className="nums">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                    <button key={n} type="button" aria-current={n === currentPage} onClick={() => setPage(n)}>
                      {n}
                    </button>
                  ))}
                </span>
                <button type="button" className="big" disabled={currentPage >= totalPages} aria-label="Next page" onClick={() => setPage(currentPage + 1)}>
                  ▶
                </button>
              </div>
            </div>
          ) : null}

          {selMode ? (
            <div className="abar">
              <b>{Object.keys(picked).length} selected</b>
              <button
                type="button"
                className="lnk"
                style={{ color: "#fff" }}
                onClick={() =>
                  setPicked((curr) => {
                    const next = { ...curr };
                    pageItems.forEach((p) => (next[p.id] = true));
                    return next;
                  })
                }
              >
                This page
              </button>
              <button
                type="button"
                className="lnk"
                style={{ color: "#fff" }}
                onClick={() =>
                  setPicked(() => {
                    const next: Record<string, true> = {};
                    filteredSorted.forEach((p) => (next[p.id] = true));
                    return next;
                  })
                }
              >
                All {filteredSorted.length}
              </button>
              <button type="button" className="lnk" style={{ color: "#fff" }} onClick={() => setPicked({})}>
                Clear
              </button>
              <div className="sp">
                <MoveToSelect groups={sortedGroups} pickedCount={Object.keys(picked).length} onMove={(gid) => moveTo(Object.keys(picked), gid)} />
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <dialog className="fg" ref={manageDialogRef} aria-labelledby="manage-groups-t">
        <form method="dialog">
          <h2 className="frame-title" id="manage-groups-t">
            <span>Manage groups</span>
          </h2>
          <div className="fg-body">
            {sortedGroups.length === 0 ? (
              <p>You have no groups yet.</p>
            ) : (
              sortedGroups.map((g, i) => (
                <div key={g.id} className={`mrow c-${g.color}`}>
                  <input
                    className="fi"
                    value={g.name}
                    maxLength={NAME_MAX}
                    aria-label="Group name"
                    onChange={(e) => renameGroupLocal(g.id, e.target.value)}
                    onBlur={(e) => persistGroupName(g.id, e.target.value)}
                  />
                  <span className="sw">
                    {COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={`c-${c}`}
                        aria-pressed={g.color === c}
                        aria-label={c}
                        onClick={() => setGroupColor(g.id, c)}
                      />
                    ))}
                  </span>
                  <button type="button" className="ib" aria-label="Move up" disabled={i === 0} onClick={() => reorderGroup(i, i - 1)}>
                    ↑
                  </button>
                  <button
                    type="button"
                    className="ib"
                    aria-label="Move down"
                    disabled={i === sortedGroups.length - 1}
                    onClick={() => reorderGroup(i, i + 1)}
                  >
                    ↓
                  </button>
                  <button type="button" className="ib ib-del" aria-label="Delete group" onClick={() => deleteGroup(g.id)}>
                    ✕
                  </button>
                </div>
              ))
            )}
            <p className="hintbar">Deleting a group keeps its pets. They move to No group.</p>
          </div>
          <div className="fg-foot fg-split">
            <button type="button" className="btn btn-sm btn-cream" disabled={groups.length >= MAX_GROUPS} onClick={addGroup}>
              + Add group
            </button>
            <button className="btn btn-sm btn-leaf" value="done">
              Done
            </button>
          </div>
        </form>
      </dialog>

      <dialog className="fg" ref={feedDialogRef} aria-labelledby="feed-dlg-t">
        <form method="dialog">
          <h2 className="frame-title" id="feed-dlg-t">
            <span>
              Feed{" "}
              {feedScope === "all" ? "all pets" : feedScope === "none" ? "these pets" : groupById(feedScope)?.name ?? "group"}
            </span>
          </h2>
          <div className="fg-body">
            <p className="fbig">
              <span className="food">
                <span aria-hidden="true">🍖</span> You have <b>{food}</b>
              </span>
              <span className="food">
                To fill everyone <b>{feedScopeMissing}</b>
              </span>
            </p>
            <p>
              {food < feedScopeMissing
                ? "Not quite enough for everyone, so the pets with the lowest health eat first."
                : "Food points are shared out for you. No items to sort."}
            </p>
            <ul className="fpv">
              {feedPlan.slice(0, 5).map(({ pet, give }) => {
                const before = Math.round((pet.hp / pet.hpMax) * 100);
                const after = Math.round(((pet.hp + give) / pet.hpMax) * 100);
                const cls = before <= 25 ? " low" : before <= 50 ? " mid" : "";
                return (
                  <li key={pet.id}>
                    <span className="nm2">{pet.name}</span>
                    <span className={`hp${cls}`}>
                      <i style={{ width: `${after}%` }} />
                    </span>
                    <span className="fa">+{give}</span>
                  </li>
                );
              })}
              {feedPlan.length > 5 ? <li className="more">+ {feedPlan.length - 5} more pets</li> : null}
            </ul>
          </div>
          <div className="fg-foot">
            <button type="button" className="btn btn-sm btn-cream" onClick={() => feedDialogRef.current?.close()}>
              Cancel
            </button>
            <button type="button" className="btn btn-sm btn-orange" disabled={!feedPlanTotal} onClick={applyFeed}>
              Feed for {feedPlanTotal} points
            </button>
          </div>
        </form>
      </dialog>

      {/* .sheet (this page's torn-paper wrapper) sets a CSS `filter`,
          which makes it a containing block for `position: fixed`
          descendants — without a portal the toast ends up pinned to
          the bottom of .sheet instead of the viewport. document isn't
          available during SSR, hence the guard (it's always true once
          hydrated, so the portal appears immediately on the client). */}
      {typeof document !== "undefined"
        ? createPortal(
            <div className="pets-toast" role="status" aria-live="polite" hidden={!toastMsg}>
              <span>{toastMsg}</span>
              {hasUndo ? (
                <button
                  type="button"
                  className="btn btn-sm btn-cream"
                  onClick={() => {
                    const u = undoRef.current;
                    undoRef.current = null;
                    setHasUndo(false);
                    setToastMsg(null);
                    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
                    u?.();
                  }}
                >
                  Undo
                </button>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function MoveToSelect({
  groups,
  pickedCount,
  onMove,
}: {
  groups: UIGroup[];
  pickedCount: number;
  onMove: (gid: string | null) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <>
      <select aria-label="Move to group" value={value} onChange={(e) => setValue(e.target.value)}>
        <option value="">Move to…</option>
        {groups.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="btn btn-sm btn-leaf"
        disabled={!pickedCount || !value}
        onClick={() => {
          if (value) onMove(value);
        }}
      >
        Move
      </button>
      <button type="button" className="btn btn-sm btn-cream" disabled={!pickedCount} onClick={() => onMove(null)}>
        No group
      </button>
    </>
  );
}
