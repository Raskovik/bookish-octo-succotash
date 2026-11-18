"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { SpeciesFormState } from "./actions";
import type { BreedRow, SpeciesRow } from "@/lib/supabase/types";
import { ImageField } from "@/components/admin/image-field";
import { SaveBar } from "@/components/admin/save-bar";

const initialState: SpeciesFormState = null;

export function SpeciesForm({
  action,
  species,
  breeds,
  isNew,
  cancelHref,
}: {
  action: (prevState: SpeciesFormState, formData: FormData) => Promise<SpeciesFormState>;
  species?: Pick<SpeciesRow, "id" | "model_number" | "breed_id" | "image_url">;
  breeds: Pick<BreedRow, "id" | "name">[];
  isNew: boolean;
  cancelHref: string;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const formId = "species-form";

  return (
    <>
      <form id={formId} action={formAction} className="flex max-w-md flex-col gap-5">
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

        <ImageField fileFieldName="image_file" urlFieldName="image_url" defaultUrl={species?.image_url} />

        {state?.error ? (
          <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
        ) : null}
      </form>
      <SaveBar formId={formId} cancelHref={cancelHref} isNew={isNew} isPending={isPending} />
    </>
  );
}
