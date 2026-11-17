"use client";

import { useActionState, useState } from "react";
import { deleteAccount, type DeleteAccountState } from "../../actions";

const initialState: DeleteAccountState = null;

// Admin-only (the page only renders this when isAdmin is true — see
// ban-form.tsx's "account" ban type for the same gating pattern) and
// gated behind typing the player's exact username, same confirmation
// shape as the delete tool that used to live in a player's own
// /settings before this moved to be admin-only.
export function DeleteAccountForm({ targetUserId, targetName }: { targetUserId: string; targetName: string }) {
  const [state, formAction, isPending] = useActionState(deleteAccount, initialState);
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const canDelete = confirmText.trim() === targetName;

  if (!open) {
    return (
      <button type="button" className="btn btn-sm btn-cream" onClick={() => setOpen(true)}>
        Delete this account
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-lg border border-red-300 p-4 dark:border-red-900">
      <input type="hidden" name="target_user_id" value={targetUserId} />
      <p className="text-sm text-stone-600 dark:text-stone-400">
        This permanently deletes <b>{targetName}</b>&apos;s account, pets, items and everything else tied to it.
        There is no undo. Type their username to confirm.
      </p>
      <input
        type="text"
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        placeholder={targetName}
        autoComplete="off"
        spellCheck={false}
        className="rounded-md border border-green-300 px-3 py-1.5 text-sm dark:border-stone-700 dark:bg-stone-900"
      />
      {state && "error" in state ? (
        <p className="text-sm text-red-700 dark:text-red-400" role="alert">
          {state.error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="button"
          className="btn btn-sm btn-cream"
          onClick={() => {
            setOpen(false);
            setConfirmText("");
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="rounded-md bg-red-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
          disabled={!canDelete || isPending}
        >
          {isPending ? "Deleting…" : "Permanently delete this account"}
        </button>
      </div>
    </form>
  );
}
