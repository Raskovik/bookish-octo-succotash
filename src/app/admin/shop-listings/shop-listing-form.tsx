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
      <form id={formId} action={formAction} className="form">
        {listing ? <input type="hidden" name="listing_id" value={listing.id} /> : null}

        <div className="fld">
          <span className="lbl">Sells</span>
          <div style={{ display: "flex", gap: 16, fontSize: 14 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 400 }}>
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
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 400 }}>
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
          <div className="fld">
            <span className="lbl">Item</span>
            <SearchablePicker
              name="item_id"
              placeholder="Search items…"
              options={itemOptions}
              defaultSelected={defaultItem}
              onSelect={setSelectedItem}
            />
          </div>
        ) : (
          <div className="fld">
            <span className="lbl">Species</span>
            <SearchablePicker
              name="species_id"
              placeholder="Search species…"
              options={speciesOptions}
              defaultSelected={defaultSpecies}
            />
            <p className="hint">
              Buying this listing mints a brand-new pet of this species for the buyer — it&apos;s never taken from
              another player.
            </p>
          </div>
        )}

        <div className="fld">
          <label htmlFor="description">Shop description override</label>
          <textarea
            id="description"
            name="description"
            rows={2}
            value={descriptionOverride}
            onChange={(e) => setDescriptionOverride(e.target.value)}
            placeholder={
              listingType === "item" ? "Blank = uses the item's own description" : "Blank = no description shown"
            }
            className="in"
          />
          <p className="hint">Shown in the shop: {shownDescription ? `"${shownDescription}"` : "(nothing)"}</p>
        </div>

        <div className="fld">
          <label htmlFor="section">Shop section</label>
          {listingType === "pet" ? (
            <>
              <input type="hidden" name="section" value="pets" />
              <p className="in" style={{ background: "var(--greenbg)" }}>
                Pets — set automatically for pet models
              </p>
            </>
          ) : (
            <select id="section" name="section" value={section} onChange={(e) => setSection(e.target.value as ShopSection)} className="in">
              {ITEM_SECTIONS.map((s) => (
                <option key={s} value={s}>
                  {s === "food" ? "Food" : "Special"}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="grid4" style={{ gridTemplateColumns: "repeat(2, minmax(0,1fr))" }}>
          <div>
            <label htmlFor="price_coins">Coin price</label>
            <input
              id="price_coins"
              name="price_coins"
              type="number"
              min={0}
              step={1}
              defaultValue={listing?.price_coins ?? ""}
              placeholder="Blank = not buyable with coins"
              className="in"
            />
          </div>
          <div>
            <label htmlFor="price_gems">Gem price</label>
            <input
              id="price_gems"
              name="price_gems"
              type="number"
              min={0}
              step={1}
              defaultValue={listing?.price_gems ?? ""}
              placeholder="Blank = not buyable with gems"
              className="in"
            />
          </div>
        </div>
        <p className="hint">Set either or both, at least one above zero — a player buying will choose which to pay with.</p>

        <div className="grid4" style={{ gridTemplateColumns: "repeat(2, minmax(0,1fr))" }}>
          <div>
            <label htmlFor="starts_at">Arrives</label>
            <input id="starts_at" name="starts_at" type="date" defaultValue={toInputValue(listing?.starts_at ?? null)} className="in" />
            <p className="hint">Blank = available immediately.</p>
          </div>
          <div>
            <label htmlFor="ends_at">Leaves</label>
            <input id="ends_at" name="ends_at" type="date" defaultValue={toInputValue(listing?.ends_at ?? null)} className="in" />
            <p className="hint">Blank = stays indefinitely. A short window here shows players a &quot;Limited&quot; tag.</p>
          </div>
        </div>

        {state?.error ? <p className="err">{state.error}</p> : null}
      </form>
      <SaveBar formId={formId} cancelHref={cancelHref} isNew={isNew} isPending={isPending} />
    </>
  );
}
