"use client";

import { useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";

const NAME_CHANGE_COST_GEMS = 15;

type ChangeNameResult = {
  display_name: string;
  gem_balance: number;
  next_change_available_at: string;
};

// Username changes stay their own immediate action (call change_display_
// name() directly, like DisplayNameEditor did before this page replaced
// it) rather than going through the page's combined "Save changes" —
// gems are spent the moment you confirm, independent of whether you
// also save a bio/avatar change in the same visit. The RPC (0014/0049)
// is the real backstop for cost, cooldown, length and character-class
// checks; this only front-runs it for a nicer error than a raw
// exception message.
export function UsernameCard({
  userId,
  displayName,
  gemBalance,
  nextChangeAvailableAt,
}: {
  userId: string;
  displayName: string;
  gemBalance: number;
  nextChangeAvailableAt: string;
}) {
  const [currentName, setCurrentName] = useState(displayName);
  const [gems, setGems] = useState(gemBalance);
  const [nextAvailable, setNextAvailable] = useState(nextChangeAvailableAt);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  function say(text: string) {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }

  const canChangeNow = new Date() >= new Date(nextAvailable);
  const canAfford = gems >= NAME_CHANGE_COST_GEMS;

  function validate(v: string): string {
    if (v.length < 3 || v.length > 20) return "Names are 3 to 20 characters long.";
    if (!/^[A-Za-z0-9_]+$/.test(v)) return "Use only letters, numbers and underscores.";
    if (v.toLowerCase() === currentName.toLowerCase()) return "That is already your name.";
    return "";
  }

  function handleChangeClick() {
    const trimmed = value.trim();
    const problem = validate(trimmed);
    setError(problem || null);
    if (problem) return;
    dialogRef.current?.showModal();
  }

  function handleConfirm() {
    const trimmed = value.trim();
    startTransition(async () => {
      const supabase = createClient();
      const { data, error: rpcError } = await supabase.rpc("change_display_name", {
        p_user_id: userId,
        p_new_name: trimmed,
      });

      dialogRef.current?.close();

      if (rpcError) {
        setError(rpcError.message);
        return;
      }

      const result = data as ChangeNameResult;
      setCurrentName(result.display_name);
      setGems(result.gem_balance);
      setNextAvailable(result.next_change_available_at);
      setValue("");
      setError(null);
      say(`Your name is now ${result.display_name}.`);
    });
  }

  return (
    <section className="pc lt" aria-labelledby="ef-name-h">
      <h2 className="ltab" id="ef-name-h">
        Username
      </h2>
      <p className="ef-now">
        Current name <b>{currentName}</b>
      </p>

      {canChangeNow ? (
        <>
          <div className="field">
            <label htmlFor="f-name">New username</label>
            <input
              id="f-name"
              type="text"
              maxLength={20}
              autoComplete="off"
              placeholder="3 to 20 letters, numbers or _"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setError(null);
              }}
              aria-invalid={error ? "true" : "false"}
              disabled={!canAfford}
            />
          </div>
          <p className="ef-cost">
            <span className="coin gem" />
            <span>
              Changing your name costs <b>{NAME_CHANGE_COST_GEMS} gems</b>.
            </span>
            <span className={canAfford ? "have" : "have low"}>
              {canAfford ? `You have ${gems} gems.` : `You need ${NAME_CHANGE_COST_GEMS} gems. You have ${gems}.`}
            </span>
          </p>
          {error ? (
            <p className="ef-error" role="alert">
              {error}
            </p>
          ) : null}
          <button
            className="btn btn-sm btn-orange"
            type="button"
            onClick={handleChangeClick}
            disabled={!canAfford}
            title={canAfford ? "" : "Not enough gems"}
          >
            Change username
          </button>
        </>
      ) : (
        <p className="ef-hint">
          You can change your name again on{" "}
          {new Date(nextAvailable).toLocaleDateString(undefined, {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
          .
        </p>
      )}

      <dialog className="fg" ref={dialogRef} aria-labelledby="dlg-name-t">
        <h2 className="frame-title" id="dlg-name-t">
          <span>Change username?</span>
        </h2>
        <div className="fg-body">
          <p style={{ margin: 0 }}>
            Your name will change from <b>{currentName}</b> to <b>{value.trim()}</b>.
          </p>
          <ul>
            <li>
              This costs <b>{NAME_CHANGE_COST_GEMS} gems</b>. They are taken as soon as you confirm.
            </li>
            <li>You can&apos;t undo it. Changing back costs another {NAME_CHANGE_COST_GEMS} gems.</li>
            <li>Other players will see your new name everywhere.</li>
          </ul>
        </div>
        <div className="fg-foot">
          <button className="btn btn-sm btn-cream" type="button" onClick={() => dialogRef.current?.close()}>
            Cancel
          </button>
          <button className="btn btn-sm btn-orange" type="button" onClick={handleConfirm} disabled={isPending}>
            {isPending ? "Saving…" : `Spend ${NAME_CHANGE_COST_GEMS} gems`}
          </button>
        </div>
      </dialog>

      <div className={toast ? "toast show" : "toast"} role="status" aria-live="polite">
        {toast}
      </div>
    </section>
  );
}
