"use client";

import { useActionState, useState } from "react";
import { SearchablePicker, type PickerOption } from "@/components/admin/searchable-picker";
import type { ShopListingFormState } from "./actions";
import type { ShopListingRow, ShopListingType, ShopSection } from "@/lib/supabase/types";
import { SaveBar } from "@/components/admin/save-bar";

const ITEM_SECTIONS: ShopSection[] = ["food", "specials"];

const initialState: ShopListingFormState = null;

// <input type="date"> wants "YYYY-MM-DD" — the one conversion point for
// both fields (the server action parses it back at midnight UTC).
function toInputValue(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export function ShopListingForm({
  action,
  listing,
  itemOptions,
  speciesOptions,
  defaultItem,
  defaultSpecies,
  isNew,
  cancelHref,
}: {
  action: (prevState: ShopListingFormState, formData: FormData) => Promise<ShopListingFormState>;
  listing?: Pick<ShopListingRow, "id" | "section" | "listing_type" | "price_coins" | "price_gems" | "starts_at" | "ends_at" | "description">;
  itemOptions: PickerOption[];
  speciesOptions: PickerOption[];
  defaultItem?: PickerOption | null;
  defaultSpecies?: PickerOption | null;
  isNew: boolean;
  cancelHref: string;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [listingType, setListingType] = useState<ShopListingType>(listing?.listing_type ?? "item");
  const [section, setSection] = useState<ShopSection>(listing?.section ?? "specials");
  const [selectedItem, setSelectedItem] = useState<PickerOption | null>(defaultItem ?? null);
  const [descriptionOverride, setDescriptionOverride] = useState(listing?.description ?? "");
  const formId = "shop-listing-form";

  const fallbackDescription = listingType === "item" ? selectedItem?.description ?? null : null;
  const shownDescription = descriptionOverride.trim().length > 0 ? descriptionOverride : fallbackDescription;

  return (
    <>
      <form id={formId} action={formAction} className="flex max-w-md flex-col gap-5">
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
                onChange={() => {
                  setListingType("item");
                  if (section === "pets") setSection("specials");
                }}
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
            <SearchablePicker
              name="item_id"
              placeholder="Search items…"
              options={itemOptions}
              defaultSelected={defaultItem}
              onSelect={setSelectedItem}
            />
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
            Shop description override
          </label>
          <textarea
            id="description"
            name="description"
            rows={2}
            value={descriptionOverride}
            onChange={(e) => setDescriptionOverride(e.target.value)}
            placeholder={
              listingType === "item" ? "Blank = uses the item's own description" : "Blank = no description shown"
            }
            className="rounded-md border border-green-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
          />
          <p className="text-xs text-stone-500">
            Shown in the shop: {shownDescription ? `"${shownDescription}"` : "(nothing)"}
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="section" className="text-sm font-medium">
            Shop section
          </label>
          {listingType === "pet" ? (
            <>
              <input type="hidden" name="section" value="pets" />
              <p className="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900">
                Pets — set automatically for pet models
              </p>
            </>
          ) : (
            <select
              id="section"
              name="section"
              value={section}
              onChange={(e) => setSection(e.target.value as ShopSection)}
              className="rounded-md border border-green-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
            >
              {ITEM_SECTIONS.map((s) => (
                <option key={s} value={s}>
                  {s === "food" ? "Food" : "Special"}
                </option>
              ))}
            </select>
          )}
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
        <p className="text-xs text-stone-500">
          Set either or both, at least one above zero — a player buying will choose which to pay with.
        </p>

        <div className="flex gap-4">
          <div className="flex flex-1 flex-col gap-1.5">
            <label htmlFor="starts_at" className="text-sm font-medium">
              Arrives
            </label>
            <input
              id="starts_at"
              name="starts_at"
              type="date"
              defaultValue={toInputValue(listing?.starts_at ?? null)}
              className="rounded-md border border-green-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
            />
            <p className="text-xs text-stone-500">Blank = available immediately.</p>
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <label htmlFor="ends_at" className="text-sm font-medium">
              Leaves
            </label>
            <input
              id="ends_at"
              name="ends_at"
              type="date"
              defaultValue={toInputValue(listing?.ends_at ?? null)}
              className="rounded-md border border-green-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
            />
            <p className="text-xs text-stone-500">
              Blank = stays indefinitely. A short window here shows players a &quot;Limited&quot; tag.
            </p>
          </div>
        </div>

        {state?.error ? <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p> : null}
      </form>
      <SaveBar formId={formId} cancelHref={cancelHref} isNew={isNew} isPending={isPending} />
    </>
  );
}
