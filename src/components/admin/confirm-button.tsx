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
        className={className ?? `btn sm${danger ? " danger" : ""}`}
        onClick={() => {
          setTypedWord("");
          dialogRef.current?.showModal();
        }}
      >
        {label}
      </button>
      <dialog ref={dialogRef}>
        <div className="dg">
          <h2>{title}</h2>
          {body ? <p>{body}</p> : null}
          {confirmWord ? (
            <label className="fld">
              Type <b>{confirmWord}</b> to confirm
              <input autoFocus value={typedWord} onChange={(e) => setTypedWord(e.target.value)} autoComplete="off" className="in" />
            </label>
          ) : null}
          <div className="dgb">
            <button type="button" className="btn" onClick={() => dialogRef.current?.close()}>
              Cancel
            </button>
            <button
              type="button"
              disabled={!canConfirm || isPending}
              className={`btn${danger ? " danger solid" : " pri"}`}
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
