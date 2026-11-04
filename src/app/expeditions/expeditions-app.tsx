"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { petImageUrl, petTypeName } from "@/lib/pet-display";
import { statTier } from "@/lib/pet-combat";
import type {
  ActiveExpeditionSummary,
  ClaimExpeditionResult,
  ExpeditionRewardReveal,
  ExplorableZone,
  OwnedPotion,
  PetFolderRow,
  PetWithStats,
} from "@/lib/supabase/types";

// Real map art, replacing the placehold.co stand-in the Tailwind version
// of this page used — single sitewide image, not zone-specific (see
// zones.map_x/y/width/height for the per-zone hotspot placement over
// it). Delivered as part of the "map and planner" design handoff.
const MAP_IMAGE_URL = "/img/expeditions/map.webp";

const STAT_LABELS = ["STR", "SPD", "DEF"] as const;

function petStatRolls(pet: PetWithStats): [number, number, number] {
  return [pet.roll_strength, pet.roll_speed, pet.roll_defence];
}

function bestStat(pet: PetWithStats): { label: string; value: number } {
  const rolls = petStatRolls(pet);
  const max = Math.max(...rolls);
  const index = rolls.indexOf(max);
  return { label: STAT_LABELS[index], value: max };
}

function PetPicture({ pet }: { pet: PetWithStats }) {
  const url = petImageUrl(pet);
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element -- unsized, object-fit: contain, same as items-app.tsx's ItemPicture
    return <img src={url} alt="" />;
  }
  return <span className="iv-ph paw leaf" aria-hidden="true" />;
}

// Which zone is under the pointer, tested against each zone's own
// image alpha (not just its bounding rectangle) so hovering only
// reacts to the island's own visible shape — same idea as the design
// handoff's canvas hit-test, generalized to however many zones have
// real cutout art instead of 3 hardcoded ones. A zone whose mask isn't
// ready yet (image still loading, or none set) falls back to its plain
// bounding box rather than never being hoverable.
function hitTestZone(
  zones: ExplorableZone[],
  masks: Map<string, CanvasRenderingContext2D>,
  fx: number,
  fy: number,
): string | null {
  for (const zone of zones) {
    if (zone.map_x === null || zone.map_y === null || zone.map_width === null || zone.map_height === null) continue;
    const x0 = zone.map_x / 100;
    const y0 = zone.map_y / 100;
    const w = zone.map_width / 100;
    const h = zone.map_height / 100;
    if (fx < x0 || fy < y0 || fx > x0 + w || fy > y0 + h) continue;

    const ctx = masks.get(zone.id);
    if (!ctx) return zone.id;

    const u = Math.min(ctx.canvas.width - 1, Math.floor(((fx - x0) / w) * ctx.canvas.width));
    const v = Math.min(ctx.canvas.height - 1, Math.floor(((fy - y0) / h) * ctx.canvas.height));
    if (ctx.getImageData(u, v, 1, 1).data[3] > 40) return zone.id;
  }
  return null;
}

function clockFormat(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

function wordsFormat(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h ? `${h}h ` : ""}${h || m ? `${m}m ` : ""}${sec.toString().padStart(2, "0")}s left`;
}

// Self-ticking compact countdown for a busy zone's map plaque — same
// "own timer, refresh the route when it hits zero" shape as
// ExpeditionCountdown (components/expedition-countdown.tsx), which this
// deliberately doesn't reuse: that one renders a sentence/bare M:SS, not
// a wood plaque, and the planner's progress pill below needs its own
// percentage anyway, so a single small self-contained ticker here is
// simpler than threading render-prop callbacks through the shared one.
function MapPlaque({ resolvesAt }: { resolvesAt: string }) {
  const router = useRouter();
  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  useEffect(() => {
    const target = new Date(resolvesAt).getTime();
    const tick = () => {
      const next = target - Date.now();
      setRemainingMs(next);
      return next;
    };
    if (tick() <= 0) return;
    const interval = setInterval(() => {
      if (tick() <= 0) {
        clearInterval(interval);
        router.refresh();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [resolvesAt, router]);

  if (remainingMs === null || remainingMs > 0) {
    return (
      <div className="ex-plq">
        <small>Time left</small>
        <b>{remainingMs === null ? "…" : clockFormat(Math.ceil(remainingMs / 1000))}</b>
      </div>
    );
  }

  return (
    <div className="ex-plq is-ready">
      <small>Ready</small>
      <b>Reward</b>
    </div>
  );
}

// Progress pill for the planner's "out exploring" state — same timer
// shape as MapPlaque/ExpeditionCountdown, plus the --p fill fraction
// .xp-fill reads.
function TripProgress({ startedAt, resolvesAt }: { startedAt: string; resolvesAt: string }) {
  const router = useRouter();
  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  useEffect(() => {
    const target = new Date(resolvesAt).getTime();
    const tick = () => {
      const next = target - Date.now();
      setRemainingMs(next);
      return next;
    };
    if (tick() <= 0) return;
    const interval = setInterval(() => {
      if (tick() <= 0) {
        clearInterval(interval);
        router.refresh();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [resolvesAt, router]);

  const total = Math.max(1, new Date(resolvesAt).getTime() - new Date(startedAt).getTime());
  const pct = remainingMs === null ? 0 : Math.min(1, Math.max(0, 1 - remainingMs / total));

  return (
    <div className="xp-fill" style={{ "--p": pct } as React.CSSProperties}>
      {remainingMs === null || remainingMs <= 0 ? "Wrapping up…" : wordsFormat(Math.ceil(remainingMs / 1000))}
    </div>
  );
}

export function ExpeditionsApp({
  userId,
  zones,
  pets,
  folders,
  activeExpeditions,
  ownedPotions,
}: {
  userId: string;
  zones: ExplorableZone[];
  pets: PetWithStats[];
  folders: PetFolderRow[];
  activeExpeditions: ActiveExpeditionSummary[];
  ownedPotions: OwnedPotion[];
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [hoveredZoneId, setHoveredZoneId] = useState<string | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [selectedPetId, setSelectedPetId] = useState<string>("");
  const [selectedPotionId, setSelectedPotionId] = useState<string>("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const [reveal, setReveal] = useState<ExpeditionRewardReveal | null>(null);
  const [revealError, setRevealError] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [bonus, setBonus] = useState<ClaimExpeditionResult | null>(null);

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const masksRef = useRef<Map<string, CanvasRenderingContext2D>>(new Map());

  function toast(msg: string) {
    setToastMsg(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMsg(null), 3200);
  }

  // Builds one alpha-sampling canvas per zone image, off-screen — not
  // tied to the <img> elements actually rendered on the map, so this
  // doesn't care whether/how many times those re-render. A zone with
  // no image, or whose image fails to load, just has no entry in the
  // map and hitTestZone() falls back to its bounding box for it.
  useEffect(() => {
    for (const zone of zones) {
      if (!zone.image_url || masksRef.current.has(zone.id)) continue;
      const img = new Image();
      img.src = zone.image_url;
      img.decode()
        .then(() => {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (!ctx) return;
          ctx.drawImage(img, 0, 0);
          masksRef.current.set(zone.id, ctx);
        })
        .catch(() => {
          // No hover-precision test for this zone's image; hitTestZone
          // falls back to its bounding box.
        });
    }
  }, [zones]);

  function pointerZoneId(clientX: number, clientY: number): string | null {
    const rect = mapRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return null;
    const fx = (clientX - rect.left) / rect.width;
    const fy = (clientY - rect.top) / rect.height;
    return hitTestZone(zones, masksRef.current, fx, fy);
  }

  const busyPetIds = useMemo(() => new Set(activeExpeditions.map((e) => e.pet_id)), [activeExpeditions]);
  const activeByZone = useMemo(() => {
    const map = new Map<string, ActiveExpeditionSummary>();
    for (const exp of activeExpeditions) map.set(exp.zone_id, exp);
    return map;
  }, [activeExpeditions]);
  const petsById = useMemo(() => new Map(pets.map((p) => [p.id, p])), [pets]);

  const selectedZone = zones.find((z) => z.id === selectedZoneId) ?? null;
  const selectedZoneActive = selectedZoneId ? activeByZone.get(selectedZoneId) : undefined;
  const activePet = selectedZoneActive ? petsById.get(selectedZoneActive.pet_id) : undefined;

  const matches = useMemo(() => {
    const term = query.trim().toLowerCase();
    return pets.filter((pet) => {
      const inGroup = groupFilter === "all" || pet.folder_id === groupFilter;
      const name = pet.custom_name ?? "";
      const species = petTypeName(pet);
      const inText = !term || name.toLowerCase().includes(term) || species.toLowerCase().includes(term);
      return inGroup && inText;
    });
  }, [pets, query, groupFilter]);

  const selectedPet = selectedPetId ? (petsById.get(selectedPetId) ?? null) : null;

  // Reset the picker/reveal state fresh every time a different zone's
  // planner opens — same "re-derive, don't carry stale selection
  // forward" reasoning as the Tailwind version's openZone().
  function openZone(zoneId: string) {
    setSelectedZoneId(zoneId);
    setQuery("");
    setGroupFilter("all");
    setSendError(null);
    setSelectedPotionId("");
    setReveal(null);
    setRevealError(null);
    setConfirmLeave(false);
    setClaimError(null);
    setBonus(null);
    const firstAvailable = pets.find((p) => !busyPetIds.has(p.id));
    setSelectedPetId(firstAvailable?.id ?? "");
  }

  function closePanel() {
    setSelectedZoneId(null);
    mapRef.current?.scrollIntoView({ block: "nearest" });
  }

  useEffect(() => {
    if (selectedZoneId) {
      panelRef.current?.focus({ preventScroll: true });
      panelRef.current?.scrollIntoView({ block: "start" });
    }
  }, [selectedZoneId]);

  // Fetch the reward reveal the moment the planner opens on an
  // awaiting_claim zone — deliberately not part of the page's initial
  // data load, so it stays a surprise until the player actually opens
  // this zone (same reasoning the old ClaimRewardModal documented).
  useEffect(() => {
    if (!selectedZoneActive || selectedZoneActive.status !== "awaiting_claim") return;
    let cancelled = false;
    supabase
      .from("expeditions")
      .select(
        "pending_species_id, pending_item_id, coins_reward, species(name, image_url, rarity), items!expeditions_pending_item_id_fkey(name, image_url, rarity)",
      )
      .eq("id", selectedZoneActive.id)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setRevealError("Couldn't load the reward. Please try again.");
          return;
        }
        setReveal(data as unknown as ExpeditionRewardReveal);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedZoneActive, supabase]);

  async function handleSend() {
    if (!selectedZoneId || !selectedPetId) return;
    setIsSending(true);
    setSendError(null);

    const { error } = await supabase.rpc("start_expedition", {
      p_user_id: userId,
      p_pet_id: selectedPetId,
      p_zone_id: selectedZoneId,
      p_potion_item_id: selectedPotionId || null,
    });

    setIsSending(false);

    if (error) {
      setSendError(error.message);
      return;
    }

    toast(`${selectedPet?.custom_name ?? "Your pet"} is on their way!`);
    closePanel();
    router.refresh();
  }

  async function handleClaim(keep: boolean) {
    if (!selectedZoneActive) return;
    setIsClaiming(true);
    setClaimError(null);

    const { data, error } = await supabase.rpc("claim_expedition_reward", {
      p_user_id: userId,
      p_expedition_id: selectedZoneActive.id,
      p_keep: keep,
    });

    setIsClaiming(false);

    if (error) {
      setClaimError(error.message);
      return;
    }

    router.refresh();

    const result = data as ClaimExpeditionResult | null;
    if (result?.bonus_kind) {
      setBonus(result);
      return;
    }

    toast(keep && reveal?.items ? `${reveal.items.name} added to your items.` : "Done!");
    closePanel();
  }

  return (
    <>
      <h1 className="ex-h1">Expeditions</h1>
      <p className="ex-intro">
        Choose an area on the map to plan an expedition. Only one pet can explore each area at a time.
      </p>

      <div
        className={`ex-mapwrap${hoveredZoneId || selectedZoneId ? " is-over" : ""}`}
        id="ex-map"
        ref={mapRef}
        onPointerMove={(e) => setHoveredZoneId(pointerZoneId(e.clientX, e.clientY))}
        onPointerLeave={() => setHoveredZoneId(null)}
        onClick={(e) => {
          // A click on a zone's own pill button (keyboard/touch target,
          // below) already opened it via that button's own onClick —
          // only fall through to the alpha hit-test for a click
          // elsewhere on the map (the base image, or an overlay).
          if ((e.target as HTMLElement).closest(".ex-go")) return;
          const id = pointerZoneId(e.clientX, e.clientY);
          if (id) openZone(id);
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- fills the panel via CSS, same reasoning as the sitewide background art */}
        <img className="ex-base" id="ex-base" src={MAP_IMAGE_URL} alt="Map of the expedition areas." />
        {zones.map((zone) => {
          if (zone.map_x === null || zone.map_y === null || zone.map_width === null || zone.map_height === null) {
            return null;
          }
          const hot = hoveredZoneId === zone.id;
          const on = selectedZoneId === zone.id;
          return zone.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- absolutely positioned fade-in overlay, not a normal content image
            <img
              key={zone.id}
              className={`ex-ov${hot ? " is-hot" : ""}${on ? " is-on" : ""}`}
              style={{ left: `${zone.map_x}%`, top: `${zone.map_y}%`, width: `${zone.map_width}%` }}
              src={zone.image_url}
              alt=""
            />
          ) : null;
        })}
        {zones.map((zone) => {
          if (zone.map_x === null || zone.map_y === null || zone.map_width === null || zone.map_height === null) {
            return null;
          }
          const active = activeByZone.get(zone.id);
          const hot = hoveredZoneId === zone.id;
          const on = selectedZoneId === zone.id;
          return (
            <button
              key={zone.id}
              type="button"
              className={`ex-go${hot ? " is-hot" : ""}${on ? " is-on" : ""}${active ? " is-busy" : ""}`}
              style={{ left: `${zone.map_x + zone.map_width / 2}%`, top: `${zone.map_y + zone.map_height / 2}%` }}
              onClick={() => openZone(zone.id)}
              onFocus={() => setHoveredZoneId(zone.id)}
              onBlur={() => setHoveredZoneId(null)}
            >
              <span>{zone.name}</span>
            </button>
          );
        })}
        <div id="ex-pins">
          {zones.map((zone) => {
            if (zone.map_x === null || zone.map_y === null || zone.map_width === null || zone.map_height === null) {
              return null;
            }
            const active = activeByZone.get(zone.id);
            if (!active) return null;
            const pet = petsById.get(active.pet_id);
            return (
              <div
                key={zone.id}
                className="ex-pin"
                style={{ left: `${zone.map_x + zone.map_width / 2}%`, top: `${zone.map_y + zone.map_height / 2}%` }}
              >
                <div className="ex-pin-tag">
                  {pet ? <PetPicture pet={pet} /> : null}
                  {active.status === "awaiting_claim" ? (
                    <div className="ex-plq is-ready">
                      <small>Ready</small>
                      <b>Reward</b>
                    </div>
                  ) : (
                    <MapPlaque resolvesAt={active.resolves_at} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <section className="xp" id="xp" tabIndex={-1} aria-labelledby="xp-title" hidden={!selectedZone} ref={panelRef}>
        {selectedZone ? (
          <>
            <div className="xp-head">
              <h2 className="frame-title" id="xp-title">
                <span>{selectedZone.name}</span>
              </h2>
              <button type="button" className="btn btn-sm btn-cream" onClick={closePanel}>
                Close
              </button>
            </div>
            <div className="xp-body">
              <div className="xp-main">
                {selectedZoneActive?.status === "awaiting_claim" ? (
                  <div className="xp-back">
                    <div className="xp-state is-done">
                      {activePet ? <PetPicture pet={activePet} /> : null}
                      <div>
                        <p>{activePet?.custom_name ?? petTypeName(activePet ?? {})} is back!</p>
                        {reveal ? (
                          <p className="xp-coins">
                            <span className="coin" aria-hidden="true" />
                            <b>+{reveal.coins_reward} coins</b>
                            <small>added to your wallet</small>
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="xp-loot">
                      {revealError ? (
                        <p className="xp-none">{revealError}</p>
                      ) : bonus?.bonus_kind ? (
                        <>
                          <h4 className="xp-lab">Double reward! Also found:</h4>
                          <div className="xp-lootrow">
                            {bonus.bonus_image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element -- unsized, object-fit: contain
                              <img src={bonus.bonus_image_url} alt="" />
                            ) : null}
                            <div>
                              <p className="xp-lname">{bonus.bonus_name}</p>
                            </div>
                          </div>
                          <div className="xp-ask">
                            <button type="button" className="btn btn-leaf" onClick={closePanel}>
                              Nice!
                            </button>
                          </div>
                        </>
                      ) : !reveal ? (
                        <p className="xp-none">Opening…</p>
                      ) : reveal.species || reveal.items ? (
                        confirmLeave ? (
                          <>
                            <p className="xp-sure">
                              Leave the {reveal.species?.name ?? reveal.items?.name} behind for good?
                            </p>
                            {claimError ? <p className="xp-none">{claimError}</p> : null}
                            <div className="xp-ask">
                              <button
                                type="button"
                                className="btn btn-red"
                                disabled={isClaiming}
                                onClick={() => handleClaim(false)}
                              >
                                {isClaiming ? "…" : "Yes, leave it"}
                              </button>
                              <button type="button" className="btn btn-cream" onClick={() => setConfirmLeave(false)}>
                                Go back
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <h4 className="xp-lab">
                              {activePet?.custom_name ?? "Your pet"} found something
                            </h4>
                            <div className="xp-lootrow">
                              {(reveal.species?.image_url ?? reveal.items?.image_url) ? (
                                // eslint-disable-next-line @next/next/no-img-element -- unsized, object-fit: contain
                                <img src={reveal.species?.image_url ?? reveal.items?.image_url ?? ""} alt="" />
                              ) : null}
                              <div>
                                <p className="xp-lname">{reveal.species?.name ?? reveal.items?.name}</p>
                                <p className="xp-ldesc">
                                  {reveal.species ? `A ${reveal.species.rarity} pet.` : `A ${reveal.items?.rarity} item.`}
                                </p>
                              </div>
                            </div>
                            {claimError ? <p className="xp-none">{claimError}</p> : null}
                            <div className="xp-ask">
                              <button
                                type="button"
                                className="btn btn-leaf"
                                disabled={isClaiming}
                                onClick={() => handleClaim(true)}
                              >
                                {isClaiming ? "…" : "Keep it"}
                              </button>
                              <button type="button" className="btn btn-cream" onClick={() => setConfirmLeave(true)}>
                                Leave it
                              </button>
                            </div>
                          </>
                        )
                      ) : (
                        <>
                          <p className="xp-lname">Nothing else this time</p>
                          <p className="xp-ldesc">
                            {activePet?.custom_name ?? "Your pet"} had a nice trip. Maybe next time.
                          </p>
                          {claimError ? <p className="xp-none">{claimError}</p> : null}
                          <div className="xp-ask">
                            <button
                              type="button"
                              className="btn btn-leaf"
                              disabled={isClaiming}
                              onClick={() => handleClaim(false)}
                            >
                              {isClaiming ? "…" : "Done"}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ) : selectedZoneActive ? (
                  <>
                    <h3 className="xp-lab">Out exploring</h3>
                    <div className="xp-state">
                      {activePet ? <PetPicture pet={activePet} /> : null}
                      <div>
                        <p>{activePet?.custom_name ?? petTypeName(activePet ?? {})} is exploring</p>
                        <TripProgress startedAt={selectedZoneActive.started_at} resolvesAt={selectedZoneActive.resolves_at} />
                      </div>
                    </div>
                  </>
                ) : pets.length === 0 ? (
                  <p className="xp-none">You don&apos;t have any pets to send yet.</p>
                ) : (
                  <div className="xp-split">
                    <div>
                      <h3 className="xp-lab">Choose a pet</h3>
                      <div className="xp-find">
                        <input
                          type="search"
                          placeholder="Search pets"
                          aria-label="Search pets"
                          autoComplete="off"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                        />
                        <select
                          aria-label="Pet group"
                          value={groupFilter}
                          onChange={(e) => setGroupFilter(e.target.value)}
                        >
                          <option value="all">All pets</option>
                          {folders.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="xp-grid">
                        {matches.length === 0 ? (
                          <p className="xp-none">No pets match.</p>
                        ) : (
                          matches.map((pet) => {
                            const away = busyPetIds.has(pet.id);
                            const on = pet.id === selectedPetId;
                            const best = bestStat(pet);
                            return (
                              <button
                                key={pet.id}
                                type="button"
                                className={`xp-pet${on ? " is-sel" : ""}`}
                                aria-pressed={on}
                                disabled={away}
                                onClick={() => setSelectedPetId(pet.id)}
                              >
                                <PetPicture pet={pet} />
                                {pet.custom_name ?? petTypeName(pet)}
                                <small>{away ? "Away" : petTypeName(pet)}</small>
                                {!away ? (
                                  <span className="xp-best">
                                    Best: {best.label} {best.value}
                                  </span>
                                ) : null}
                                {on ? (
                                  <span className="xp-tick" aria-hidden="true">
                                    ✓
                                  </span>
                                ) : null}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                    <div className="xp-side">
                      {!selectedPet ? (
                        <p className="xp-none">Pick a pet to see its stats and send it out.</p>
                      ) : (
                        <>
                          <PetPicture pet={selectedPet} />
                          <p className="xp-name">
                            {selectedPet.custom_name ?? petTypeName(selectedPet)}
                            <small>{petTypeName(selectedPet)}</small>
                          </p>
                          <div className="xp-plq">
                            {(() => {
                              const [str, spd, def] = petStatRolls(selectedPet);
                              const allTen = str === 10 && spd === 10 && def === 10;
                              return (
                                <>
                                  <div className={`pt-tier ${statTier(str, allTen)}`}>
                                    <div className="pt-p">
                                      <i />
                                      <small>STR</small>
                                      <b>{str}</b>
                                    </div>
                                  </div>
                                  <div className={`pt-tier ${statTier(spd, allTen)}`}>
                                    <div className="pt-p">
                                      <i />
                                      <small>SPD</small>
                                      <b>{spd}</b>
                                    </div>
                                  </div>
                                  <div className={`pt-tier ${statTier(def, allTen)}`}>
                                    <div className="pt-p">
                                      <i />
                                      <small>DEF</small>
                                      <b>{def}</b>
                                    </div>
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                          <p className="xp-range">
                            Back in
                            <b>about 2 to 3 minutes</b>
                          </p>
                          {ownedPotions.length > 0 ? (
                            <select
                              aria-label="Use a potion"
                              value={selectedPotionId}
                              onChange={(e) => setSelectedPotionId(e.target.value)}
                            >
                              <option value="">No potion</option>
                              {ownedPotions.map((potion) => (
                                <option key={potion.itemId} value={potion.itemId}>
                                  {potion.name} (×{potion.quantity})
                                </option>
                              ))}
                            </select>
                          ) : null}
                          {sendError ? <p className="xp-none">{sendError}</p> : null}
                          <button type="button" className="btn btn-leaf" disabled={isSending} onClick={handleSend}>
                            {isSending ? "Sending…" : `Send ${selectedPet.custom_name ?? petTypeName(selectedPet)} out`}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : null}
      </section>

      {typeof document !== "undefined"
        ? createPortal(
            <div className="pets-toast" role="status" aria-live="polite" hidden={!toastMsg}>
              <span>{toastMsg}</span>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
