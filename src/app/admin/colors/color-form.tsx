"use client";

import { useActionState, useState } from "react";
import type { ColorFormState } from "./actions";
import type { ColorRow, TraitRarity } from "@/lib/supabase/types";

const TRAIT_RARITIES: TraitRarity[] = ["common", "uncommon", "rare"];
const initialState: ColorFormState = null;

export function ColorForm({
  action,
  color,
  submitLabel,
}: {
  action: (prevState: ColorFormState, formData: FormData) => Promise<ColorFormState>;
  color?: ColorRow;
  submitLabel: string;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [hex, setHex] = useState(color?.hex_swatch ?? "#4d7c0f");

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-5">
      {color ? <input type="hidden" name="color_id" value={color.id} /> : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-sm font-medium">
          Name
        </label>
        <input
          id="name"
          name="name"
          defaultValue={color?.name ?? ""}
          required
          className="rounded-md border border-green-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="hex_swatch" className="text-sm font-medium">
          Hex swatch
        </label>
        <div className="flex items-center gap-3">
          <span
            className="h-8 w-8 shrink-0 rounded-full border border-black/10"
            style={{ backgroundColor: /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : "transparent" }}
          />
          <input
            id="hex_swatch"
            name="hex_swatch"
            defaultValue={color?.hex_swatch ?? "#4d7c0f"}
            onChange={(e) => setHex(e.target.value)}
            placeholder="#4d7c0f"
            required
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
          defaultValue={color?.rarity_tier ?? "common"}
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
          defaultChecked={color?.is_active ?? true}
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
