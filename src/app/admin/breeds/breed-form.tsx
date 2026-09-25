"use client";

import { useActionState, useState } from "react";
import type { BreedFormState } from "./actions";
import type { BreedRow } from "@/lib/supabase/types";

const initialState: BreedFormState = null;

// URL-only (no file upload) with a live thumbnail, same idea as garden
// plants' StageImageField — this is the game's own body-shape catalog.
function LayerImageField({
  fieldName,
  label,
  defaultValue,
}: {
  fieldName: string;
  label: string;
  defaultValue: string;
}) {
  const [url, setUrl] = useState(defaultValue);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fieldName} className="text-sm font-medium">
        {label}
      </label>
      <div className="flex items-center gap-3">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element -- arbitrary admin-pasted URL, not a next/image-optimizable local asset
          <img
            src={url}
            alt=""
            className="h-14 w-14 rounded border border-green-300 object-cover dark:border-stone-700"
            onError={(e) => {
              e.currentTarget.style.visibility = "hidden";
            }}
          />
        ) : (
          <div className="h-14 w-14 rounded border border-dashed border-green-300 dark:border-stone-700" />
        )}
        <input
          id={fieldName}
          name={fieldName}
          defaultValue={defaultValue}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
          className="flex-1 rounded-md border border-green-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
        />
      </div>
    </div>
  );
}

export function BreedForm({
  action,
  breed,
  submitLabel,
}: {
  action: (prevState: BreedFormState, formData: FormData) => Promise<BreedFormState>;
  breed?: BreedRow;
  submitLabel: string;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-5">
      {breed ? <input type="hidden" name="breed_id" value={breed.id} /> : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-sm font-medium">
          Name
        </label>
        <input
          id="name"
          name="name"
          defaultValue={breed?.name ?? ""}
          required
          className="rounded-md border border-green-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="description" className="text-sm font-medium">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          defaultValue={breed?.description ?? ""}
          rows={3}
          className="rounded-md border border-green-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
        />
      </div>

      <LayerImageField fieldName="base_layer_url" label="Base line-art URL" defaultValue={breed?.base_layer_url ?? ""} />
      <LayerImageField
        fieldName="mask_layer_url"
        label="Region mask URL (R=primary, G=secondary, B=tertiary)"
        defaultValue={breed?.mask_layer_url ?? ""}
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="rarity_weight" className="text-sm font-medium">
          Rarity weight
        </label>
        <input
          id="rarity_weight"
          name="rarity_weight"
          type="number"
          min={1}
          step={1}
          defaultValue={breed?.rarity_weight ?? 1}
          required
          className="rounded-md border border-green-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
        />
        <p className="text-xs text-stone-500">
          Not used by anything yet — reserved for a future wild-breed roll. Starter pets and breeding both use a fixed
          breed today.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          name="is_active"
          defaultChecked={breed?.is_active ?? true}
          className="h-4 w-4 rounded border-green-300 dark:border-stone-700"
        />
        Active
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
