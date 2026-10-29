"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { bbcodeToHtml } from "@/lib/bbcode";
import { petLevelTier } from "@/lib/pet-display";

/**
 * The `.pt-wrap` contents of /pets/[petId] — ported from
 * furgarden-design's pages/pet.html + js/pet.js. One client component
 * (like pets-app.tsx for /pets) since almost everything here is either
 * interactive (rename/feed/bio) or needs to reflect what those actions
 * just changed (energy, bio) without a full page reload.
 *
 * Three departures from the handoff, each real/working rather than
 * visual-only:
 *
 * 1. Stat plaque tiers (wood/silver/gold/diamond) use the user's own
 *    rule, not the handoff's placeholder thresholds (7/25/60/99, which
 *    don't even fit — rolls are 1-10, see roll_strength's own column
 *    comment): <=5 wood, 6-9 silver, 10 gold, diamond when all three
 *    rolls are 10. See statTier() below.
 * 2. name-max/bio-max use this app's real, already-enforced server
 *    limits (40 / 2000 — rename_pet()/set_pet_bio()) instead of the
 *    handoff's data-name-max="20"/data-bio-max="500" placeholders,
 *    which would just be a UI lie about what the server actually
 *    accepts.
 * 3. Feed has no food-points cost here — feed_pet() (0046_pet_energy.sql)
 *    is free and just resets the energy-decay clock to now(). The
 *    confirm dialog's copy reflects that instead of the handoff's
 *    "use food points" text, which belongs to the separate (and still
 *    only partly wired) food-points system on /pets.
 *
 * Sell and Release have no backend at all yet (no coin-economy sell
 * price, no pet-deletion path) — kept as disabled "Coming soon"
 * buttons, same as the Tailwind version of this page did, rather than
 * building confirm dialogs for actions that don't do anything real.
 */

function statTier(value: number, allTen: boolean): "" | "pt-silver" | "pt-gold" | "pt-diamond" {
  if (allTen) return "pt-diamond";
  if (value >= 10) return "pt-gold";
  if (value >= 6) return "pt-silver";
  return "";
}

const NAME_MAX = 40; // rename_pet() server limit — see file-level comment
const BIO_MAX = 2000; // set_pet_bio() server limit — see file-level comment

export function PetPanel({
  userId,
  petId,
  isOwner,
  initialCustomName,
  speciesName,
  imageUrl,
  level,
  ageLabel,
  adventureCount,
  energyPct,
  rollStrength,
  rollSpeed,
  rollDefence,
  initialBio,
}: {
  userId: string;
  petId: string;
  isOwner: boolean;
  initialCustomName: string | null;
  speciesName: string;
  imageUrl: string | null;
  level: number;
  ageLabel: string;
  adventureCount: number;
  energyPct: number;
  rollStrength: number;
  rollSpeed: number;
  rollDefence: number;
  initialBio: string | null;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [customName, setCustomName] = useState(initialCustomName);
  const displayName = customName ?? "Unnamed";
  const allTen = rollStrength === 10 && rollSpeed === 10 && rollDefence === 10;
  const energyClass = energyPct <= 25 ? " low" : energyPct <= 50 ? " mid" : "";
  const energyLabel = energyPct === 100 ? "Fully rested" : "Energy";
  const tier = petLevelTier(level);

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  // Separate from toastMsg so the bounce-out animation (.pets-toast-closing)
  // has something to play before the toast leaves the DOM — see
  // onAnimationEnd below, same pattern as pets-app.tsx's toast.
  const [toastClosing, setToastClosing] = useState(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function toast(msg: string) {
    setToastMsg(msg);
    setToastClosing(false);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToastClosing(true);
      // Fallback in case onAnimationEnd never fires (prefers-reduced-motion
      // sets `animation: none`, so no animationend follows) — without this
      // the toast would stay stuck in the closing state forever.
      toastTimerRef.current = setTimeout(() => {
        setToastClosing(false);
        setToastMsg(null);
      }, 400);
    }, 2800);
  }

  /* ---------- rename ---------- */
  const renameDialogRef = useRef<HTMLDialogElement>(null);
  const [nameDraft, setNameDraft] = useState(displayName);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  function openRename() {
    setNameDraft(customName ?? "");
    setRenameError(null);
    renameDialogRef.current?.showModal();
  }
  async function doRename() {
    const value = nameDraft.trim().slice(0, NAME_MAX);
    if (!value || value === (customName ?? "")) {
      renameDialogRef.current?.close();
      return;
    }
    setIsRenaming(true);
    const { error } = await supabase.rpc("rename_pet", { p_user_id: userId, p_pet_id: petId, p_name: value });
    setIsRenaming(false);
    if (error) {
      setRenameError(error.message);
      return;
    }
    setCustomName(value);
    renameDialogRef.current?.close();
    toast(`Renamed to ${value}`);
    router.refresh();
  }

  /* ---------- feed (real, free — see file-level comment) ---------- */
  const feedDialogRef = useRef<HTMLDialogElement>(null);
  const [isFeeding, setIsFeeding] = useState(false);
  async function doFeed() {
    setIsFeeding(true);
    const { error } = await supabase.rpc("feed_pet", { p_user_id: userId, p_pet_id: petId });
    setIsFeeding(false);
    feedDialogRef.current?.close();
    if (error) {
      toast("That didn't work. Please try again.");
      return;
    }
    toast(`${displayName} has been fed`);
    router.refresh();
  }

  /* ---------- bio ---------- */
  const [editingBio, setEditingBio] = useState(false);
  const [bioDraft, setBioDraft] = useState<string | null>(null);
  const [bioPreview, setBioPreview] = useState(false);
  const [bio, setBio] = useState(initialBio);
  const [isSavingBio, setIsSavingBio] = useState(false);
  const bioTextareaRef = useRef<HTMLTextAreaElement>(null);

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

  async function saveBio() {
    const value = (bioDraft ?? bio ?? "").trim().slice(0, BIO_MAX);
    setIsSavingBio(true);
    const { error } = await supabase.rpc("set_pet_bio", { p_user_id: userId, p_pet_id: petId, p_bio: value });
    setIsSavingBio(false);
    if (error) {
      toast("That didn't work. Please try again.");
      return;
    }
    setBio(value || null);
    setEditingBio(false);
    setBioDraft(null);
    setBioPreview(false);
    toast("Bio saved");
  }

  return (
    <div className="pt-wrap">
      <section className="col pt-herof pt-hang" aria-labelledby="pet-title">
        <span className={`pt-vr pt-t${tier}`} role="img" aria-label={`Level ${level}`}>
          <span aria-hidden="true">
            <small>LV</small>
            <b>{level}</b>
          </span>
        </span>
        <h2 className="frame-title">
          <span className="sect-ico" aria-hidden="true" />
          <span id="pet-title">{displayName}</span>
          {isOwner ? (
            <button className="lnk pt-rn pt-owner-only" type="button" onClick={openRename}>
              &#9998; Rename
            </button>
          ) : null}
        </h2>
        <div className="pt-imgwrap">
          {imageUrl ? <img src={imageUrl} alt={`${displayName}, a ${speciesName}`} /> : null}
        </div>
      </section>

      <section className="pc pt-s1" aria-label="Pet details">
        <div>
          <h3>Information</h3>
          <ul className="pt-pe-rows">
            <li>
              <span>Name</span>
              <b>{displayName}</b>
            </li>
            <li>
              <span>Species</span>
              <b>{speciesName}</b>
            </li>
            <li>
              <span>Age</span>
              <b>{ageLabel}</b>
            </li>
            <li>
              <span>Times adventured</span>
              <b>{adventureCount}</b>
            </li>
          </ul>
        </div>

        <div className="pt-cmid">
          <div className="pt-ebox">
            <div className="pt-ehead">
              <span>{energyLabel}</span>
              <b>{Math.round(energyPct)}%</b>
            </div>
            <span
              className={`pt-stripe${energyClass}`}
              role="img"
              aria-label={`Energy ${Math.round(energyPct)}%`}
            >
              <i style={{ width: `${energyPct}%` }} />
            </span>
          </div>
          <div className="pt-sub">Stats</div>
          <div className="pt-plq">
            <div className={`pt-tier ${statTier(rollStrength, allTen)}`}>
              <div className="pt-p">
                <i />
                <small>STR</small>
                <b>{rollStrength}</b>
              </div>
            </div>
            <div className={`pt-tier ${statTier(rollSpeed, allTen)}`}>
              <div className="pt-p">
                <i />
                <small>SPD</small>
                <b>{rollSpeed}</b>
              </div>
            </div>
            <div className={`pt-tier ${statTier(rollDefence, allTen)}`}>
              <div className="pt-p">
                <i />
                <small>DEF</small>
                <b>{rollDefence}</b>
              </div>
            </div>
          </div>
        </div>

        {isOwner ? (
          <div className="pt-owner-only">
            <div className="acts">
              <button type="button" className="btn btn-orange" onClick={() => feedDialogRef.current?.showModal()}>
                Feed
              </button>
              <button type="button" className="btn btn-leaf" disabled title="Coming soon">
                Sell
              </button>
              <button type="button" className="btn btn-red" disabled title="Coming soon">
                Release
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="pc lt bio-card pt-bio-card pt-bio" aria-labelledby="pet-bio-t">
        <h2 className="ltab" id="pet-bio-t">
          Bio
        </h2>
        {editingBio ? (
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
                &#8676;
              </button>
              <button type="button" className="gb-b" title="Centre" aria-label="Centre" disabled={bioPreview} onClick={() => wrapBioSelection("[center]", "[/center]")}>
                &#8596;
              </button>
              <button type="button" className="gb-b" title="Align right" aria-label="Align right" disabled={bioPreview} onClick={() => wrapBioSelection("[right]", "[/right]")}>
                &#8677;
              </button>
              <button type="button" className="gb-b" title="Link" aria-label="Link" disabled={bioPreview} onClick={() => wrapBioSelection("[url=https://]", "[/url]")}>
                &#128279;
              </button>
              <button type="button" className="gb-b pv" aria-pressed={bioPreview} onClick={() => setBioPreview((v) => !v)}>
                {bioPreview ? "Keep editing" : "Preview"}
              </button>
            </div>
            {bioPreview ? (
              <div className="bbcode gb-pv" dangerouslySetInnerHTML={{ __html: bbcodeToHtml(bioDraft ?? bio ?? "") }} />
            ) : (
              <textarea
                ref={bioTextareaRef}
                maxLength={BIO_MAX}
                aria-label="Pet bio"
                placeholder="Write something about this pet. Supports the same BBCode as forum posts."
                value={bioDraft ?? bio ?? ""}
                onChange={(e) => setBioDraft(e.target.value)}
              />
            )}
            <div className="row2">
              <button type="button" className="btn btn-sm btn-leaf" disabled={isSavingBio} onClick={saveBio}>
                {isSavingBio ? "Saving…" : "Save"}
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
              <small>
                {(bioDraft ?? bio ?? "").length} / {BIO_MAX}
              </small>
            </div>
          </div>
        ) : (
          <>
            <div className="bbcode">
              {bio ? <div dangerouslySetInnerHTML={{ __html: bbcodeToHtml(bio) }} /> : <span className="pt-none">This pet has no bio yet.</span>}
            </div>
            {isOwner ? (
              <p className="pt-ed pt-owner-only">
                <button
                  className="lnk"
                  type="button"
                  onClick={() => {
                    setEditingBio(true);
                    setBioDraft(null);
                    setBioPreview(false);
                  }}
                >
                  &#9998; {bio ? "Edit bio" : "Write a bio"}
                </button>
              </p>
            ) : null}
          </>
        )}
      </section>

      <dialog className="fg" ref={renameDialogRef} aria-labelledby="pdr-t">
        <form method="dialog">
          <h2 className="frame-title" id="pdr-t">
            <span>Rename pet</span>
          </h2>
          <div className="fg-body">
            <label htmlFor="pet-newname">New name</label>
            <input
              className="fi"
              id="pet-newname"
              maxLength={NAME_MAX}
              autoComplete="off"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
            />
            {renameError ? (
              <p className="fg-hint" style={{ color: "#a3281a" }}>
                {renameError}
              </p>
            ) : null}
          </div>
          <div className="fg-foot">
            <button type="button" className="btn btn-sm btn-cream" onClick={() => renameDialogRef.current?.close()}>
              Cancel
            </button>
            <button type="button" className="btn btn-sm btn-leaf" disabled={isRenaming} onClick={doRename}>
              {isRenaming ? "Saving…" : "Save name"}
            </button>
          </div>
        </form>
      </dialog>

      <dialog className="fg" ref={feedDialogRef} aria-labelledby="pdf-t">
        <form method="dialog">
          <h2 className="frame-title" id="pdf-t">
            <span>Feed {displayName}?</span>
          </h2>
          <div className="fg-body">
            <p style={{ margin: 0 }}>This restores {displayName}&rsquo;s energy to 100%.</p>
          </div>
          <div className="fg-foot">
            <button type="button" className="btn btn-sm btn-cream" onClick={() => feedDialogRef.current?.close()}>
              Cancel
            </button>
            <button type="button" className="btn btn-sm btn-orange" disabled={isFeeding} onClick={doFeed}>
              {isFeeding ? "Feeding…" : "Feed"}
            </button>
          </div>
        </form>
      </dialog>

      {/* .sheet sets a CSS `filter` for its drop-shadow, which makes it
          a containing block for `position: fixed` descendants — see
          the identical comment in pets-app.tsx. Portal past it. */}
      {typeof document !== "undefined"
        ? createPortal(
            <div
              className={`pets-toast${toastClosing ? " pets-toast-closing" : ""}`}
              role="status"
              aria-live="polite"
              hidden={!toastMsg}
              onAnimationEnd={() => {
                if (!toastClosing) return;
                if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
                setToastClosing(false);
                setToastMsg(null);
              }}
            >
              <span>{toastMsg}</span>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
