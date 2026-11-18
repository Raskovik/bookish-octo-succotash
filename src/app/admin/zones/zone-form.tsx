"use client";

import { useActionState } from "react";
import type { ZoneFormState } from "./actions";
import type { ZoneRow } from "@/lib/supabase/types";
import { ImageField } from "@/components/admin/image-field";
import { SaveBar } from "@/components/admin/save-bar";

const initialState: ZoneFormState = null;

export function ZoneForm({
  action,
  zone,
  isNew,
  cancelHref,
}: {
  action: (prevState: ZoneFormState, formData: FormData) => Promise<ZoneFormState>;
  zone?: Pick<
    ZoneRow,
    "id" | "name" | "description" | "image_url" | "is_active" | "reward_coins_base" | "reward_coins_variance" | "reward_xp"
  >;
  isNew: boolean;
  cancelHref: string;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const formId = "zone-form";

  return (
    <>
      <form id={formId} action={formAction} className="flex max-w-md flex-col gap-5">
        {zone ? <input type="hidden" name="zone_id" value={zone.id} /> : null}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className="text-sm font-medium">
            Name
          </label>
          <input
            id="name"
            name="name"
            defaultValue={zone?.name ?? ""}
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
            defaultValue={zone?.description ?? ""}
            rows={3}
            className="resize-y rounded-md border border-green-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
          />
        </div>

        <ImageField fileFieldName="image_file" urlFieldName="image_url" defaultUrl={zone?.image_url} label="Zone image" />

        <fieldset className="flex flex-col gap-3 rounded-md border border-green-200 p-3 dark:border-stone-800">
          <legend className="px-1 text-sm font-medium">Expedition rewards</legend>
          <p className="text-xs text-stone-500">
            Each trip pays a random amount of coins between the base and base+variance, plus a flat amount of XP.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="reward_coins_base" className="text-xs text-stone-500">
                Base coins
              </label>
              <input
                id="reward_coins_base"
                name="reward_coins_base"
                type="number"
                min={0}
                step={1}
                defaultValue={zone?.reward_coins_base ?? 10}
                required
                className="rounded-md border border-green-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="reward_coins_variance" className="text-xs text-stone-500">
                Coin variance
              </label>
              <input
                id="reward_coins_variance"
                name="reward_coins_variance"
                type="number"
                min={0}
                step={1}
                defaultValue={zone?.reward_coins_variance ?? 10}
                required
                className="rounded-md border border-green-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="reward_xp" className="text-xs text-stone-500">
                XP per trip
              </label>
              <input
                id="reward_xp"
                name="reward_xp"
                type="number"
                min={0}
                step={1}
                defaultValue={zone?.reward_xp ?? 10}
                required
                className="rounded-md border border-green-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
              />
            </div>
          </div>
        </fieldset>

        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            name="is_active"
            defaultChecked={zone?.is_active ?? true}
            className="h-4 w-4 rounded border-green-300 dark:border-stone-700"
          />
          Active (visible on the expeditions map)
        </label>

        {state?.error ? (
          <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
        ) : null}
      </form>
      <SaveBar formId={formId} cancelHref={cancelHref} isNew={isNew} isPending={isPending} />
    </>
  );
}
