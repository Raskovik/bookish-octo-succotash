"use client";

import { useState, useTransition } from "react";
import { deleteOwnAccount } from "./actions";

// Collapsed by default and gated behind a typed confirmation (not just
// a window.confirm()) so this can't be triggered by a stray double
// click — deleting your own account is the one truly irreversible
// action anywhere in /settings.
export function DeleteAccountSection({ displayName }: { displayName: string }) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canDelete = displayName.length > 0 && confirmText.trim() === displayName;

  function handleDelete() {
    if (!canDelete || isPending) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteOwnAccount();
      // Only reached on failure — success redirects away via next/navigation.
      if (result && "error" in result) {
        setError(result.error);
      }
    });
  }

  return (
    <section className="pc lt" aria-labelledby="ef-danger-h">
      <h2 className="ltab" id="ef-danger-h">
        Danger zone
      </h2>
      {!open ? (
        <button type="button" className="btn btn-sm btn-cream" onClick={() => setOpen(true)}>
          Delete my account
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="ef-hint">
            This permanently deletes your account, pets, items and everything else tied to it. There is no
            undo. Type your username (<b>{displayName}</b>) to confirm.
          </p>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={displayName}
            autoComplete="off"
            spellCheck={false}
          />
          {error ? (
            <p className="ef-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-sm btn-cream"
              onClick={() => {
                setOpen(false);
                setConfirmText("");
                setError(null);
              }}
            >
              Cancel
            </button>
            <button type="button" className="btn btn-sm" disabled={!canDelete || isPending} onClick={handleDelete}>
              {isPending ? "Deleting…" : "Permanently delete my account"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
