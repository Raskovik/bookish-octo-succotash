"use client";

import { useActionState } from "react";
import { deleteAccount, type DeleteAccountState } from "./actions";

const initialState: DeleteAccountState = null;

// A plain window.confirm() popup, not the typed-username confirmation
// the per-player /mod page uses — this page is explicitly the quick,
// search-and-click version of the same admin_delete_account() tool,
// for clearing out test accounts fast while exercising onboarding
// (0070) repeatedly.
export function DeleteAccountButton({ targetUserId, targetName }: { targetUserId: string; targetName: string }) {
  const [state, formAction, isPending] = useActionState(deleteAccount, initialState);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm(`Permanently delete ${targetName}'s account? This can't be undone.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="target_user_id" value={targetUserId} />
      <button
        type="submit"
        className="rounded-md bg-red-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-50"
        disabled={isPending}
      >
        {isPending ? "Deleting…" : "Delete"}
      </button>
      {state && "error" in state ? (
        <p className="mt-1 text-xs text-red-700 dark:text-red-400" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
