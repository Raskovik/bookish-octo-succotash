"use client";

import { useActionState } from "react";
import { grantSelfCurrency, type CurrencyGrantState } from "./actions";
import { CurrencyIcon } from "@/components/currency-icon";

const initialState: CurrencyGrantState = null;

export function CurrencyGrantForm() {
  const [state, formAction, isPending] = useActionState(grantSelfCurrency, initialState);

  return (
    <form action={formAction} className="flex max-w-sm flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="coin_delta" className="text-sm font-medium">
          <CurrencyIcon kind="coin" /> Coins
        </label>
        <input
          id="coin_delta"
          name="coin_delta"
          type="number"
          step={1}
          defaultValue={0}
          className="rounded-md border border-green-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="gem_delta" className="text-sm font-medium">
          <CurrencyIcon kind="gem" /> Gems
        </label>
        <input
          id="gem_delta"
          name="gem_delta"
          type="number"
          step={1}
          defaultValue={0}
          className="rounded-md border border-green-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
        />
      </div>

      <p className="text-xs text-stone-500">
        Positive to add, negative to remove (balances never go below 0). This only ever affects
        your own account.
      </p>

      {state && "error" in state ? (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      ) : null}
      {state && "success" in state ? (
        <p className="text-sm text-green-600 dark:text-green-400">Balances updated.</p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-md bg-green-800 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60 dark:bg-green-200 dark:text-green-950 dark:hover:bg-green-300"
      >
        {isPending ? "Applying…" : "Apply"}
      </button>
    </form>
  );
}
