"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { updateThreadFlags, deleteThread } from "../../actions";

/**
 * Staff-only (moderator or admin) pin/lock/title/delete controls, behind
 * the "Mod tools" button in the thread header — matches topic.html's
 * `<button class="btn btn-sm btn-cream fm-mod fm-new">Mod tools</button>`.
 * The popover itself isn't in the design package, so it's a plain
 * parchment-styled card (see .fm-admin-pop in furgarden.css), portaled
 * to document.body since .col's overflow:hidden would otherwise clip
 * it. Click-outside-to-close, same pattern as nav-groups.tsx and the
 * BBCode editor's popovers. Was admin-only before 0027_moderation.sql
 * widened pin/lock (and added delete) to moderators.
 */
export function ThreadAdminControls({
  categoryId,
  threadId,
  title,
  isPinned,
  isLocked,
}: {
  categoryId: string;
  threadId: string;
  title: string;
  isPinned: boolean;
  isLocked: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; right: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  function openPopover() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      setPosition({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
    }
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || popoverRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="btn btn-sm btn-cream fm-mod fm-new"
        onClick={() => (open ? setOpen(false) : openPopover())}
      >
        Mod tools
      </button>
      {open && position
        ? createPortal(
            <div ref={popoverRef} className="fm-admin-pop" style={{ top: position.top, right: position.right }}>
              <h4>Moderation</h4>
              <form action={updateThreadFlags} className="fm-form" style={{ padding: 0 }}>
                <input type="hidden" name="category_id" value={categoryId} />
                <input type="hidden" name="thread_id" value={threadId} />
                <label>
                  Title
                  <input type="text" name="title" defaultValue={title} maxLength={200} required />
                </label>
                <label>
                  <input type="checkbox" name="is_pinned" defaultChecked={isPinned} />
                  Pinned
                </label>
                <label>
                  <input type="checkbox" name="is_locked" defaultChecked={isLocked} />
                  Locked
                </label>
                <button type="submit" className="btn btn-sm btn-leaf">
                  Save
                </button>
              </form>
              <hr />
              <form
                action={deleteThread}
                onSubmit={(event) => {
                  if (!confirm("Delete this whole thread and all its posts? This can't be undone.")) {
                    event.preventDefault();
                  }
                }}
              >
                <input type="hidden" name="category_id" value={categoryId} />
                <input type="hidden" name="thread_id" value={threadId} />
                <button type="submit" className="btn btn-sm btn-red">
                  Delete thread
                </button>
              </form>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
