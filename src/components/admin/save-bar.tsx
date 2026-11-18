"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Sticky Save/Back bar for an admin edit form — disabled until the form
 * actually changes, with a "Leave without saving?" warning if you try
 * to navigate away dirty. Drops in as a sibling of the `<form id={formId}>`
 * it watches (listens for input/change bubbling up from it), so it
 * doesn't need the form itself converted into a controlled component.
 */
export function SaveBar({
  formId,
  cancelHref,
  isNew,
  isPending,
  deleteSlot,
}: {
  formId: string;
  cancelHref: string;
  isNew: boolean;
  isPending: boolean;
  deleteSlot?: React.ReactNode;
}) {
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const form = document.getElementById(formId);
    if (!form) return;
    const markDirty = () => setDirty(true);
    form.addEventListener("input", markDirty);
    form.addEventListener("change", markDirty);
    return () => {
      form.removeEventListener("input", markDirty);
      form.removeEventListener("change", markDirty);
    };
  }, [formId]);

  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (dirty) e.preventDefault();
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

  return (
    <div className="bar">
      <button type="submit" form={formId} disabled={isPending || (!isNew && !dirty)} className="btn pri">
        {isPending ? "Saving…" : isNew ? "Create" : "Save changes"}
      </button>
      <Link href={cancelHref} className="btn">
        {isNew ? "Cancel" : "Back"}
      </Link>
      <span className={`st${dirty ? " dirty" : ""}`}>
        {isNew ? "Not saved yet" : dirty ? "You have unsaved changes" : "All changes saved"}
      </span>
      {deleteSlot}
    </div>
  );
}
