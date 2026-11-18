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
      <form id={formId} action={formAction} className="form">
        {zone ? <input type="hidden" name="zone_id" value={zone.id} /> : null}

        <div className="fld">
          <label htmlFor="name">Name</label>
          <input id="name" name="name" defaultValue={zone?.name ?? ""} required className="in" />
        </div>

        <div className="fld">
          <label htmlFor="description">Description</label>
          <textarea id="description" name="description" defaultValue={zone?.description ?? ""} rows={3} className="in" />
        </div>

        <ImageField fileFieldName="image_file" urlFieldName="image_url" defaultUrl={zone?.image_url} label="Zone image" />

        <div className="fh">Expedition rewards</div>
        <p className="hint">
          Each trip pays a random amount of coins between the base and base+variance, plus a flat amount of XP.
        </p>
        <div className="grid4">
          <div>
            <label htmlFor="reward_coins_base">Base coins</label>
            <input
              id="reward_coins_base"
              name="reward_coins_base"
              type="number"
              min={0}
              step={1}
              defaultValue={zone?.reward_coins_base ?? 10}
              required
              className="in num"
            />
          </div>
          <div>
            <label htmlFor="reward_coins_variance">Coin variance</label>
            <input
              id="reward_coins_variance"
              name="reward_coins_variance"
              type="number"
              min={0}
              step={1}
              defaultValue={zone?.reward_coins_variance ?? 10}
              required
              className="in num"
            />
          </div>
          <div>
            <label htmlFor="reward_xp">XP per trip</label>
            <input
              id="reward_xp"
              name="reward_xp"
              type="number"
              min={0}
              step={1}
              defaultValue={zone?.reward_xp ?? 10}
              required
              className="in num"
            />
          </div>
        </div>

        <div className="fld">
          <label className="chk">
            <input type="checkbox" name="is_active" defaultChecked={zone?.is_active ?? true} />
            <span>
              <b>Active</b>
              <small>Visible on the expeditions map</small>
            </span>
          </label>
        </div>

        {state?.error ? <p className="err">{state.error}</p> : null}
      </form>
      <SaveBar formId={formId} cancelHref={cancelHref} isNew={isNew} isPending={isPending} />
    </>
  );
}
