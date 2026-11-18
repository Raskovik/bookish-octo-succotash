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
      <form id={formId} action={formAction} className="form">
        {species ? <input type="hidden" name="species_id" value={species.id} /> : null}

        {species ? (
          <div className="fld">
            <span className="lbl">Model number</span>
            <p className="hint">
              {species.model_number ?? "Custom"} — assigned automatically, this and the display name can&apos;t be
              changed here.
            </p>
          </div>
        ) : (
          <p className="hint">
            The model number (and the name shown everywhere it&apos;s used) is assigned automatically once you save.
          </p>
        )}

        <div className="fld">
          <label htmlFor="breed_id">Breed</label>
          <select id="breed_id" name="breed_id" defaultValue={species?.breed_id ?? ""} required className="in">
            <option value="" disabled>
              Choose a breed…
            </option>
            {breeds.map((breed) => (
              <option key={breed.id} value={breed.id}>
                {breed.name}
              </option>
            ))}
          </select>
          <p className="hint">
            The lineart/animal group this model uses — manage the list under <Link href="/admin/breeds">Breeds</Link>.
          </p>
        </div>

        <ImageField fileFieldName="image_file" urlFieldName="image_url" defaultUrl={species?.image_url} />

        {state?.error ? <p className="err">{state.error}</p> : null}
      </form>
      <SaveBar formId={formId} cancelHref={cancelHref} isNew={isNew} isPending={isPending} />
    </>
  );
}
