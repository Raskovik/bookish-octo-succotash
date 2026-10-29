"use client";

import { useActionState } from "react";
import { sendMessage, type SendMessageState } from "./actions";

const initialState: SendMessageState = null;

export function ReplyForm({ conversationId }: { conversationId: string }) {
  const [state, formAction, isPending] = useActionState(sendMessage, initialState);

  return (
    <form action={formAction}>
      <input type="hidden" name="conversation_id" value={conversationId} />
      <div className="gedit">
        <textarea name="body" rows={5} maxLength={4000} placeholder="Write a message…" required style={{ minHeight: "110px" }} />
      </div>
      {state?.error ? <p className="fm-err">{state.error}</p> : null}
      <button type="submit" disabled={isPending} className="btn btn-sm btn-orange" style={{ alignSelf: "flex-start" }}>
        {isPending ? "Sending…" : "Send Message"}
      </button>
    </form>
  );
}
