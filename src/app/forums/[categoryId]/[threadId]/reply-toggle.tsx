"use client";

import { useState } from "react";

/**
 * Keeps the reply box out of the way until a player actually wants to
 * reply — the form only mounts (and the BBCode toolbar/textarea only
 * render) once they click the button. Matches topic.html's
 * `<p class="fm-replyrow"><a class="btn btn-orange" href="#reply">Reply</a></p>`.
 */
export function ReplyToggle({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  if (open) return <>{children}</>;

  return (
    <p className="fm-replyrow">
      <button type="button" className="btn btn-orange" onClick={() => setOpen(true)}>
        Reply
      </button>
    </p>
  );
}
