"use client";

import { useActionState, useState } from "react";
import { SearchablePicker, type PickerOption } from "@/components/admin/searchable-picker";
import type { ShopListingFormState } from "./actions";
import type { ShopListingRow, ShopListingType, ShopSection } from "@/lib/supabase/types";

const SHOP_SECTIONS: ShopSection[] = ["pets", "food", "den", "specials"];

const initialState: ShopListingFormState = null;

// <input type="datetime-local"> wants "YYYY-MM-DDTHH:mm" in the
// viewer's local time, not an ISO string — this is the one conversion
// point, both directions (toInputValue for the default, the browser
// handles the reverse on submit since the action just does `new
// Date(value)`, which parses that local-time string back correctly).
function toInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ShopListingForm({
  action,
  listing,
  itemOptions,
  speciesOptions,
  defaultItem,
  defaultSpecies,
  submitLabel,
}: {
  action: (prevState: ShopListingFormState, formData: FormData) => Promise<ShopListingFormState>;
  listing?: ShopListingRow;
  itemOptions: PickerOption[];
  speciesOptions: PickerOption[];
  defaultItem?: PickerOption | null;
  defaultSpecies?: PickerOption | null;
  submitLabel: string;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [listingType, setListingType] = useState<ShopListingType>(listing?.listing_type ?? "item");

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-5">
      {listing ? <input type="hidden" name="listing_id" value={listing.id} /> : null}

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Sells</span>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="listing_type"
              value="item"
              checked={listingType === "item"}
              onChange={() => setListingType("item")}
            />
            An existing item
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="listing_type"
              value="pet"
              checked={listingType === "pet"}
              onChange={() => setListingType("pet")}
            />
            A newly-spawned pet
          </label>
        </div>
      </div>

      {listingType === "item" ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Item</span>
          <SearchablePicker name="item_id" placeholder="Search items…" options={itemOptions} defaultSelected={defaultItem} />
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Species</span>
          <SearchablePicker
            name="species_id"
            placeholder="Search species…"
            options={speciesOptions}
            defaultSelected={defaultSpecies}
          />
          <p className="text-xs text-stone-500">
            Buying this listing mints a brand-new pet of this species for the buyer — it&apos;s never taken from
            another player.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="description" className="text-sm font-medium">
          Shop blurb
        </label>
        <textarea
          id="description"
          name="description"
          rows={2}
          defaultValue={listing?.description ?? ""}
          placeholder="One line shown under the name in the shop — optional"
          className="rounded-md border border-green-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="section" className="text-sm font-medium">
          Shop section
        </label>
        <select
          id="section"
          name="section"
          defaultValue={listing?.section ?? "specials"}
          className="rounded-md border border-green-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
        >
          {SHOP_SECTIONS.map((section) => (
            <option key={section} value={section}>
              {section}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-4">
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor="price_coins" className="text-sm font-medium">
            Coin price
          </label>
          <input
            id="price_coins"
            name="price_coins"
            type="number"
            min={0}
            step={1}
            defaultValue={listing?.price_coins ?? ""}
            placeholder="Blank = not buyable with coins"
            className="rounded-md border border-green-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
          />
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor="price_gems" className="text-sm font-medium">
            Gem price
          </label>
          <input
            id="price_gems"
            name="price_gems"
            type="number"
            min={0}
            step={1}
            defaultValue={listing?.price_gems ?? ""}
            placeholder="Blank = not buyable with gems"
            className="rounded-md border border-green-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
          />
        </div>
      </div>
      <p className="text-xs text-stone-500">Set either or both — a player buying will choose which to pay with.</p>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="ends_at" className="text-sm font-medium">
          Leaves the shop at
        </label>
        <input
          id="ends_at"
          name="ends_at"
          type="datetime-local"
          defaultValue={toInputValue(listing?.ends_at ?? null)}
          className="rounded-md border border-green-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
        />
        <p className="text-xs text-stone-500">
          Blank = stays until you turn it off. Shown to players with a &quot;Limited&quot; tag once set.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          name="is_new"
          defaultChecked={listing?.is_new ?? false}
          className="h-4 w-4 rounded border-green-300 dark:border-stone-700"
        />
        Show a &quot;New&quot; tag
      </label>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          name="is_active"
          defaultChecked={listing?.is_active ?? true}
          className="h-4 w-4 rounded border-green-300 dark:border-stone-700"
        />
        Active (visible in /shop)
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
