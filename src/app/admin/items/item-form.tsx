"use client";

import { useActionState } from "react";
import type { ItemFormState } from "./actions";
import type { ItemRarity, ItemRow, ItemType } from "@/lib/supabase/types";
import { ImageField } from "@/components/admin/image-field";
import { SaveBar } from "@/components/admin/save-bar";

const ITEM_TYPES: ItemType[] = ["ingredient", "cosmetic", "potion", "seed", "fertilizer"];
const ITEM_RARITIES: ItemRarity[] = ["common", "uncommon", "rare", "epic", "legendary"];

const initialState: ItemFormState = null;

export function ItemForm({
  action,
  item,
  isNew,
  cancelHref,
}: {
  action: (prevState: ItemFormState, formData: FormData) => Promise<ItemFormState>;
  item?: Pick<
    ItemRow,
    "id" | "name" | "type" | "rarity" | "image_url" | "description" | "sell_value" | "food_value"
  >;
  isNew: boolean;
  cancelHref: string;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const formId = "item-form";

  return (
    <>
      <form id={formId} action={formAction} className="flex max-w-md flex-col gap-5">
        {item ? <input type="hidden" name="item_id" value={item.id} /> : null}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className="text-sm font-medium">
            Name
          </label>
          <input
            id="name"
            name="name"
            defaultValue={item?.name ?? ""}
            required
            className="rounded-md border border-green-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="type" className="text-sm font-medium">
            Type
          </label>
          <select
            id="type"
            name="type"
            defaultValue={item?.type ?? "ingredient"}
            className="rounded-md border border-green-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
          >
            {ITEM_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="rarity" className="text-sm font-medium">
            Rarity
          </label>
          <select
            id="rarity"
            name="rarity"
            defaultValue={item?.rarity ?? "common"}
            className="rounded-md border border-green-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
          >
            {ITEM_RARITIES.map((rarity) => (
              <option key={rarity} value={rarity}>
                {rarity}
              </option>
            ))}
          </select>
        </div>

        <ImageField fileFieldName="image_file" urlFieldName="image_url" defaultUrl={item?.image_url} />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="sell_value" className="text-sm font-medium">
            Sell value
          </label>
          <input
            id="sell_value"
            name="sell_value"
            type="number"
            min={0}
            step={1}
            defaultValue={item?.sell_value ?? 0}
            required
            className="rounded-md border border-green-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="food_value" className="text-sm font-medium">
            Food points (per unit)
          </label>
          <input
            id="food_value"
            name="food_value"
            type="number"
            min={0}
            step={1}
            defaultValue={item?.food_value ?? ""}
            placeholder="Blank = can't be turned into food points"
            className="rounded-md border border-green-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
          />
          <p className="text-xs text-stone-500">
            Leave blank to keep this item out of /items&apos; &quot;Food points&quot; action.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="description" className="text-sm font-medium">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            defaultValue={item?.description ?? ""}
            placeholder="Shown on /items' detail panel, and as the shop listing's description unless overridden there"
            className="rounded-md border border-green-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
          />
        </div>

        {state?.error ? (
          <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
        ) : null}
      </form>
      <SaveBar formId={formId} cancelHref={cancelHref} isNew={isNew} isPending={isPending} />
    </>
  );
}
