"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { SpeciesFormState } from "./actions";
import type { BreedRow, SpeciesRow } from "@/lib/supabase/types";

const initialState: SpeciesFormState = null;

export function SpeciesForm({
  action,
  species,
  breeds,
  submitLabel,
}: {
  action: (prevState: SpeciesFormState, formData: FormData) => Promise<SpeciesFormState>;
  species?: SpeciesRow;
  breeds: Pick<BreedRow, "id" | "name">[];
  submitLabel: string;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-5">
      {species ? <input type="hidden" name="species_id" value={species.id} /> : null}

      {species ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Model number</span>
          <p className="text-sm text-stone-500">
            {species.model_number ?? "Custom"} — assigned automatically, this and the display name
            can&apos;t be changed here.
          </p>
        </div>
      ) : (
        <p className="text-xs text-stone-500">
          The model number (and the name shown everywhere it&apos;s used) is assigned automatically
          once you save.
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="breed_id" className="text-sm font-medium">
          Breed
        </label>
        <select
          id="breed_id"
          name="breed_id"
          defaultValue={species?.breed_id ?? ""}
          required
          className="rounded-md border border-green-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
        >
          <option value="" disabled>
            Choose a breed…
          </option>
          {breeds.map((breed) => (
            <option key={breed.id} value={breed.id}>
              {breed.name}
            </option>
          ))}
        </select>
        <p className="text-xs text-stone-500">
          The lineart/animal group this model uses — manage the list under{" "}
          <Link href="/admin/breeds" className="underline">
            Breeds
          </Link>
          .
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Image</span>
        <div className="flex items-center gap-3">
          {previewUrl || species?.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- previewUrl is a local blob: URL, which next/image can't optimize
            <img
              src={previewUrl ?? species!.image_url!}
              alt=""
              className="h-16 w-16 rounded border border-green-300 object-cover dark:border-stone-700"
            />
          ) : (
            <div className="h-16 w-16 rounded border border-dashed border-green-300 dark:border-stone-700" />
          )}
          <div className="flex flex-col gap-1">
            <input
              id="image_file"
              name="image_file"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(e) => {
                const file = e.target.files?.[0];
                setPreviewUrl(file ? URL.createObjectURL(file) : null);
              }}
              className="text-sm"
            />
            <p className="text-xs text-stone-500">PNG, JPEG, WebP, or GIF — up to 5 MB.</p>
          </div>
        </div>
        <label htmlFor="image_url" className="mt-1 text-xs text-stone-500">
          Or paste an image URL instead (used only if no file is uploaded above)
        </label>
        <input
          id="image_url"
          name="image_url"
          defaultValue={species?.image_url ?? ""}
          placeholder="https://…"
          className="rounded-md border border-green-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
        />
      </div>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          name="is_active"
          defaultChecked={species?.is_active ?? true}
          className="h-4 w-4 rounded border-green-300 dark:border-stone-700"
        />
        Active (visible in zone pet pools)
      </label>

      {state?.error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      ) : null}

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
