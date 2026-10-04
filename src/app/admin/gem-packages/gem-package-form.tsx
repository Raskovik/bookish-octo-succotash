"use client";

import { useActionState } from "react";
import type { GemPackageFormState } from "./actions";
import type { GemPackageRow } from "@/lib/supabase/types";

const initialState: GemPackageFormState = null;

export function GemPackageForm({
  action,
  gemPackage,
  submitLabel,
}: {
  action: (prevState: GemPackageFormState, formData: FormData) => Promise<GemPackageFormState>;
  gemPackage?: GemPackageRow;
  submitLabel: string;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-5">
      {gemPackage ? <input type="hidden" name="package_id" value={gemPackage.id} /> : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-sm font-medium">
          Name
        </label>
        <input
          id="name"
          name="name"
          defaultValue={gemPackage?.name ?? ""}
          required
          maxLength={80}
          placeholder="e.g. 'Starter Pack', 'Best Value'"
          className="rounded-md border border-green-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="gem_amount" className="text-sm font-medium">
          Gem amount
        </label>
        <input
          id="gem_amount"
          name="gem_amount"
          type="number"
          min={1}
          step={1}
          defaultValue={gemPackage?.gem_amount ?? ""}
          required
          className="w-32 rounded-md border border-green-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="price_dollars" className="text-sm font-medium">
          Price (USD)
        </label>
        <input
          id="price_dollars"
          name="price_dollars"
          type="number"
          min={0.01}
          step={0.01}
          defaultValue={gemPackage ? (gemPackage.price_cents / 100).toFixed(2) : ""}
          required
          placeholder="4.99"
          className="w-32 rounded-md border border-green-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="sort_order" className="text-sm font-medium">
          Sort order
        </label>
        <input
          id="sort_order"
          name="sort_order"
          type="number"
          defaultValue={gemPackage?.sort_order ?? 0}
          className="w-24 rounded-md border border-green-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
        />
        <p className="text-xs text-stone-500">Lower numbers appear first on the Get Gems page.</p>
      </div>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          name="is_active"
          defaultChecked={gemPackage?.is_active ?? true}
          className="h-4 w-4 rounded border-green-300 dark:border-stone-700"
        />
        Active (visible on the Get Gems page)
      </label>

      {state?.error ? <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p> : null}

      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-md bg-green-800 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60 dark:bg-green-200 dark:text-green-950 dark:hover:bg-green-300"
      >
        {isPending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
