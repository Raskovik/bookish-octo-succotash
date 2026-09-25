"use client";

import { useActionState, useState } from "react";
import type { EyeTypeFormState } from "./actions";
import type { EyeTypeRow, TraitRarity } from "@/lib/supabase/types";

const TRAIT_RARITIES: TraitRarity[] = ["common", "uncommon", "rare"];
const initialState: EyeTypeFormState = null;

export function EyeTypeForm({
  action,
  eyeType,
  breedOptions,
  submitLabel,
}: {
  action: (prevState: EyeTypeFormState, formData: FormData) => Promise<EyeTypeFormState>;
  eyeType?: EyeTypeRow;
  breedOptions: { id: string; name: string }[];
  submitLabel: string;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [url, setUrl] = useState(eyeType?.layer_url ?? "");

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-5">
      {eyeType ? <input type="hidden" name="eye_type_id" value={eyeType.id} /> : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="breed_id" className="text-sm font-medium">
          Breed
        </label>
        <select
          id="breed_id"
          name="breed_id"
          defaultValue={eyeType?.breed_id ?? ""}
          required
          className="rounded-md border border-green-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
        >
          <option value="" disabled>
            — Select a breed —
          </option>
          {breedOptions.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-sm font-medium">
          Name
        </label>
        <input
          id="name"
          name="name"
          defaultValue={eyeType?.name ?? ""}
          required
          className="rounded-md border border-green-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="layer_url" className="text-sm font-medium">
          Overlay layer URL
        </label>
        <div className="flex items-center gap-3">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element -- arbitrary admin-pasted URL
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
            id="layer_url"
            name="layer_url"
            defaultValue={eyeType?.layer_url ?? ""}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            className="flex-1 rounded-md border border-green-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="rarity_tier" className="text-sm font-medium">
          Rarity tier
        </label>
        <select
          id="rarity_tier"
          name="rarity_tier"
          defaultValue={eyeType?.rarity_tier ?? "common"}
          className="rounded-md border border-green-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
        >
          {TRAIT_RARITIES.map((tier) => (
            <option key={tier} value={tier}>
              {tier}
            </option>
          ))}
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          name="is_active"
          defaultChecked={eyeType?.is_active ?? true}
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
