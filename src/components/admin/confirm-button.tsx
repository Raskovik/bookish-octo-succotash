"use client";

import { useRef, useState } from "react";

/**
 * A button that opens a native `<dialog>` confirmation before running
 * `onConfirm` — same `<dialog>`/`showModal()` pattern already used
 * site-wide (marketplace buy dialogs, username-card, …). `confirmWord`
 * turns on the "type X to confirm" variant (e.g. deleting an account);
 * omit it for a plain Cancel/Confirm dialog.
 */
export function ConfirmButton({
  label,
  title,
  body,
  confirmLabel = "Confirm",
  danger = false,
  confirmWord,
  onConfirm,
  className,
}: {
  label: string;
  title: string;
  body?: string;
  confirmLabel?: string;
  danger?: boolean;
  confirmWord?: string;
  onConfirm: () => void | Promise<void>;
  className?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [typedWord, setTypedWord] = useState("");
  const [isPending, setIsPending] = useState(false);

  const canConfirm = !confirmWord || typedWord.trim().toLowerCase() === confirmWord.toLowerCase();

  return (
    <>
      <button
        type="button"
        className={
          className ??
          `rounded-md border px-2.5 py-1 text-xs font-medium ${
            danger
              ? "border-red-300 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
              : "border-green-300 hover:bg-green-100 dark:border-stone-700 dark:hover:bg-stone-800"
          }`
        }
        onClick={() => {
          setTypedWord("");
          dialogRef.current?.showModal();
        }}
      >
        {label}
      </button>
      <dialog
        ref={dialogRef}
        className="rounded-lg border border-green-200 p-0 backdrop:bg-black/40 dark:border-stone-800"
      >
        <div className="flex w-80 flex-col gap-3 p-5">
          <h2 className="text-base font-semibold">{title}</h2>
          {body ? <p className="text-sm text-stone-600 dark:text-stone-400">{body}</p> : null}
          {confirmWord ? (
            <label className="flex flex-col gap-1 text-sm">
              Type <b>{confirmWord}</b> to confirm
              <input
                autoFocus
                value={typedWord}
                onChange={(e) => setTypedWord(e.target.value)}
                autoComplete="off"
                className="rounded-md border border-green-300 px-3 py-1.5 text-sm dark:border-stone-700 dark:bg-stone-900"
              />
            </label>
          ) : null}
          <div className="mt-1 flex justify-end gap-2">
            <button
              type="button"
              className="rounded-md border border-green-300 px-3 py-1.5 text-sm dark:border-stone-700"
              onClick={() => dialogRef.current?.close()}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!canConfirm || isPending}
              className={`rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 ${
                danger ? "bg-red-700 hover:bg-red-600" : "bg-green-800 hover:bg-green-700"
              }`}
              onClick={async () => {
                setIsPending(true);
                try {
                  await onConfirm();
                  dialogRef.current?.close();
                } finally {
                  setIsPending(false);
                }
              }}
            >
              {isPending ? "Working…" : confirmLabel}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
