"use client";

import { useActionState } from "react";
import { submitDevCode, type LockdownFormState } from "./actions";

const initialState: LockdownFormState = null;

export function LockdownForm({ next }: { next: string }) {
  const [state, formAction, isPending] = useActionState(submitDevCode, initialState);

  return (
    <form action={formAction} className="flex w-full max-w-xs flex-col gap-3">
      <input type="hidden" name="next" value={next} />
      <label htmlFor="code" className="sr-only">
        Developer code
      </label>
      <input
        id="code"
        name="code"
        type="password"
        inputMode="numeric"
        autoFocus
        required
        placeholder="Developer code"
        className="rounded-md border border-green-300 px-3 py-2 text-center text-sm tracking-widest dark:border-stone-700 dark:bg-stone-900"
      />
      {state?.error ? <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-green-800 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60 dark:bg-green-200 dark:text-green-950 dark:hover:bg-green-300"
      >
        {isPending ? "Checking…" : "Enter"}
      </button>
    </form>
  );
}
