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
    <div className="sticky bottom-0 z-10 mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-green-200 bg-white p-4 shadow-[0_-6px_18px_rgba(0,0,0,0.07)] dark:border-stone-800 dark:bg-stone-950">
      <button
        type="submit"
        form={formId}
        disabled={isPending || (!isNew && !dirty)}
        className="rounded-md bg-green-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-45 dark:bg-green-200 dark:text-green-950"
      >
        {isPending ? "Saving…" : isNew ? "Create" : "Save changes"}
      </button>
      <Link href={cancelHref} className="rounded-md border border-green-300 px-4 py-2 text-sm dark:border-stone-700">
        {isNew ? "Cancel" : "Back"}
      </Link>
      <span className={`flex-1 text-sm font-medium ${dirty ? "text-orange-600 dark:text-orange-400" : "text-stone-500"}`}>
        {isNew ? "Not saved yet" : dirty ? "You have unsaved changes" : "All changes saved"}
      </span>
      {deleteSlot}
    </div>
  );
}
