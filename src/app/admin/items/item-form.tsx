"use client";

import { useActionState } from "react";
import type { ItemFormState } from "./actions";
import type { ItemRow, ItemType } from "@/lib/supabase/types";
import { ImageField } from "@/components/admin/image-field";
import { SaveBar } from "@/components/admin/save-bar";

const ITEM_TYPES: ItemType[] = ["ingredient", "cosmetic", "potion", "seed", "fertilizer"];

const initialState: ItemFormState = null;

export function ItemForm({
  action,
  item,
  isNew,
  cancelHref,
  obtainableSection,
}: {
  action: (prevState: ItemFormState, formData: FormData) => Promise<ItemFormState>;
  item?: Pick<ItemRow, "id" | "name" | "type" | "image_url" | "description" | "sell_value" | "food_value">;
  isNew: boolean;
  cancelHref: string;
  // Server-rendered "Where it can be obtained" section (see
  // getObtainableSources) — part of this same form card in the reference
  // design, not a separate .sub.card below it, so it's a slot here rather
  // than its own element on the edit page.
  obtainableSection?: React.ReactNode;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const formId = "item-form";

  return (
    <>
      <form id={formId} action={formAction} className="card form">
        {item ? <input type="hidden" name="item_id" value={item.id} /> : null}

        <div className="fld">
          <label htmlFor="name">Name</label>
          <input id="name" name="name" defaultValue={item?.name ?? ""} required className="in" />
        </div>

        <div className="fld">
          <label htmlFor="type">Type</label>
          <select id="type" name="type" defaultValue={item?.type ?? "ingredient"} className="in">
            {ITEM_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <ImageField fileFieldName="image_file" urlFieldName="image_url" defaultUrl={item?.image_url} />

        <div className="fld">
          <label htmlFor="sell_value">Sell value</label>
          <input id="sell_value" name="sell_value" type="number" min={0} step={1} defaultValue={item?.sell_value ?? 0} required className="in num" />
        </div>

        <div className="fld">
          <label htmlFor="food_value">Food points (per unit)</label>
          <input
            id="food_value"
            name="food_value"
            type="number"
            min={0}
            step={1}
            defaultValue={item?.food_value ?? ""}
            placeholder="Blank = can't be turned into food points"
            className="in num"
          />
          <p className="hint">Leave blank to keep this item out of /items&apos; &quot;Food points&quot; action.</p>
        </div>

        <div className="fld">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            name="description"
            rows={3}
            defaultValue={item?.description ?? ""}
            placeholder="Shown on /items' detail panel, and as the shop listing's description unless overridden there"
            className="in"
          />
        </div>

        {obtainableSection}

        {state?.error ? <p className="err">{state.error}</p> : null}
      </form>
      <SaveBar formId={formId} cancelHref={cancelHref} isNew={isNew} isPending={isPending} backLabel="items" />
    </>
  );
}
