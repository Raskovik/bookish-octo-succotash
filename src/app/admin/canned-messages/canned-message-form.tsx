"use client";

import { useActionState } from "react";
import type { CannedMessageFormState } from "./actions";
import type { CannedStaffMessageRow } from "@/lib/supabase/types";

const initialState: CannedMessageFormState = null;

export function CannedMessageForm({
  action,
  message,
  submitLabel,
}: {
  action: (prevState: CannedMessageFormState, formData: FormData) => Promise<CannedMessageFormState>;
  message?: CannedStaffMessageRow;
  submitLabel: string;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="card form">
      {message ? <input type="hidden" name="message_id" value={message.id} /> : null}

      <div className="fld">
        <label htmlFor="label">Label</label>
        <input
          id="label"
          name="label"
          defaultValue={message?.label ?? ""}
          required
          maxLength={100}
          placeholder="Shown in the staff dropdown, e.g. 'Content removed'"
          className="in"
        />
      </div>

      <div className="fld">
        <label htmlFor="body">Message body</label>
        <textarea
          id="body"
          name="body"
          rows={5}
          maxLength={4000}
          defaultValue={message?.body ?? ""}
          required
          placeholder="Sent to the player exactly as written."
          className="in"
        />
      </div>

      <div className="fld">
        <label htmlFor="sort_order">Sort order</label>
        <input id="sort_order" name="sort_order" type="number" defaultValue={message?.sort_order ?? 0} className="in num" />
        <p className="hint">Lower numbers appear first in the staff dropdown.</p>
      </div>

      <div className="fld">
        <label className="chk">
          <input type="checkbox" name="is_active" defaultChecked={message?.is_active ?? true} />
          <span>
            <b>Active</b>
            <small>Visible in the staff dropdown</small>
          </span>
        </label>
      </div>

      {state?.error ? <p className="err">{state.error}</p> : null}

      <button type="submit" disabled={isPending} className="btn pri" style={{ marginTop: 14 }}>
        {isPending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
