"use client";

import { useActionState } from "react";
import { startConversationWithName, type StartConversationState } from "./actions";

const initialState: StartConversationState = null;

export function NewMessageForm() {
  const [state, formAction, isPending] = useActionState(startConversationWithName, initialState);

  return (
    <form action={formAction} style={{ display: "flex", alignItems: "flex-end", gap: "10px", flexWrap: "wrap" }}>
      <label style={{ flex: "1 1 220px", minWidth: 0 }}>
        Message a player
        <input type="text" id="display_name" name="display_name" placeholder="Their username" className="fi" style={{ width: "100%", boxSizing: "border-box" }} />
      </label>
      <button type="submit" disabled={isPending} className="btn btn-sm btn-orange">
        {isPending ? "Finding…" : "Start"}
      </button>
      {state?.error ? <p className="fm-err" style={{ flexBasis: "100%" }}>{state.error}</p> : null}
    </form>
  );
}
