"use client";

import { useActionState } from "react";
import { grantSelfCurrency, type CurrencyGrantState } from "./actions";
import { CurrencyIcon } from "@/components/currency-icon";

const initialState: CurrencyGrantState = null;

export function CurrencyGrantForm() {
  const [state, formAction, isPending] = useActionState(grantSelfCurrency, initialState);

  return (
    <form action={formAction} className="card form">
      <div className="fld">
        <label htmlFor="coin_delta">
          <CurrencyIcon kind="coin" /> Coins
        </label>
        <input id="coin_delta" name="coin_delta" type="number" step={1} defaultValue={0} className="in num" />
      </div>

      <div className="fld">
        <label htmlFor="gem_delta">
          <CurrencyIcon kind="gem" /> Gems
        </label>
        <input id="gem_delta" name="gem_delta" type="number" step={1} defaultValue={0} className="in num" />
      </div>

      <p className="hint">
        Positive to add, negative to remove (balances never go below 0). This only ever affects your own account.
      </p>

      {state && "error" in state ? <p className="err">{state.error}</p> : null}
      {state && "success" in state ? <p className="hint" style={{ color: "var(--greend)", fontWeight: 800 }}>Balances updated.</p> : null}

      <button type="submit" disabled={isPending} className="btn pri" style={{ marginTop: 14 }}>
        {isPending ? "Applying…" : "Apply"}
      </button>
    </form>
  );
}
