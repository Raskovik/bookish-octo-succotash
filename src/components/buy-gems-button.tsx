"use client";

import { useActionState } from "react";
import { createGemCheckoutSession, type GemCheckoutState } from "@/app/gems/actions";

const initialState: GemCheckoutState = null;

// Unlike every other "Buy" button in this app (BuyShopItemButton,
// buy-button.tsx), this one can't be a client-side RPC call — creating a
// Stripe Checkout Session needs the secret key, which must never reach
// the browser, so it has to go through a real Server Action. A
// successful submit never returns state at all (the action redirects to
// Stripe); only a failure (bad package, Stripe not configured) ever
// shows something here.
export function BuyGemsButton({ packageId }: { packageId: string }) {
  const [state, formAction, isPending] = useActionState(createGemCheckoutSession, initialState);

  return (
    <form action={formAction} className="flex flex-col items-center gap-1">
      <input type="hidden" name="package_id" value={packageId} />
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-green-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 dark:bg-green-200 dark:text-green-950 dark:hover:bg-green-300"
      >
        {isPending ? "Redirecting…" : "Buy"}
      </button>
      {state?.error ? <p className="text-xs text-red-600 dark:text-red-400">{state.error}</p> : null}
    </form>
  );
}
