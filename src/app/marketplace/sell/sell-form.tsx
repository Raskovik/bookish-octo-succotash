"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PetPickerModal, ItemPickerModal, type PickerPet, type PickerItem } from "@/components/picker-modal";
import { petImageUrl, petTypeName } from "@/lib/pet-display";
import type { ItemWithQuantity, ListingDurationDays, PetWithSpecies } from "@/lib/supabase/types";

const DURATIONS: { value: ListingDurationDays; label: string }[] = [
  { value: 1, label: "1 day" },
  { value: 3, label: "3 days" },
  { value: 7, label: "7 days" },
  { value: 14, label: "14 days" },
  { value: 30, label: "30 days" },
];

function toPickerPets(pets: PetWithSpecies[]): PickerPet[] {
  return pets.map((p) => ({
    id: p.id,
    name: p.custom_name ?? petTypeName(p),
    imageUrl: petImageUrl(p),
    rarity: p.rarity,
  }));
}

function toPickerItems(inventory: ItemWithQuantity[]): PickerItem[] {
  return inventory
    .filter((entry) => entry.item)
    .map((entry) => ({
      id: entry.item!.id,
      name: entry.item!.name,
      imageUrl: entry.item!.image_url,
      rarity: entry.item!.rarity,
      maxQuantity: entry.quantity,
    }));
}

export function SellForm({
  userId,
  pets,
  inventory,
}: {
  userId: string;
  pets: PetWithSpecies[];
  inventory: ItemWithQuantity[];
}) {
  const router = useRouter();
  const pickerPets = toPickerPets(pets);
  const pickerItems = toPickerItems(inventory);

  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedItemQty, setSelectedItemQty] = useState(0);
  const [priceCoins, setPriceCoins] = useState(0);
  const [priceGems, setPriceGems] = useState(0);
  const [durationDays, setDurationDays] = useState<ListingDurationDays>(7);
  const [modalOpen, setModalOpen] = useState<"pets" | "items" | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedPet = selectedPetId ? pickerPets.find((p) => p.id === selectedPetId) : null;
  const selectedItem = selectedItemId ? pickerItems.find((i) => i.id === selectedItemId) : null;

  function choosePet(id: string) {
    setSelectedItemId(null);
    setSelectedItemQty(0);
    setSelectedPetId((prev) => (prev === id ? null : id));
  }

  function chooseItemQuantity(id: string, qty: number, max: number) {
    const clamped = Math.max(0, Math.min(qty, max));
    setSelectedPetId(null);
    if (clamped === 0) {
      setSelectedItemId(null);
      setSelectedItemQty(0);
    } else {
      setSelectedItemId(id);
      setSelectedItemQty(clamped);
    }
  }

  async function handleSubmit() {
    setError(null);

    if (priceCoins <= 0 && priceGems <= 0) {
      setError("Set a coin price, a gem price, or both — at least 1.");
      return;
    }
    if (!selectedPetId && !selectedItemId) {
      setError("Choose a pet or an item to sell first.");
      return;
    }

    setIsPending(true);
    const supabase = createClient();
    const coinsArg = priceCoins > 0 ? priceCoins : null;
    const gemsArg = priceGems > 0 ? priceGems : null;

    const { data: listingId, error: rpcError } = selectedPetId
      ? await supabase.rpc("create_pet_listing", {
          p_seller_id: userId,
          p_pet_id: selectedPetId,
          p_price_coins: coinsArg,
          p_price_gems: gemsArg,
          p_duration_days: durationDays,
        })
      : await supabase.rpc("create_item_listing", {
          p_seller_id: userId,
          p_item_id: selectedItemId!,
          p_quantity: selectedItemQty,
          p_price_coins: coinsArg,
          p_price_gems: gemsArg,
          p_duration_days: durationDays,
        });

    setIsPending(false);

    if (rpcError || !listingId) {
      setError(rpcError?.message ?? "Could not create the listing.");
      return;
    }

    router.push("/marketplace/mine");
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">What are you selling?</span>
        {selectedPet ? (
          <div className="flex items-center gap-3 rounded-lg border border-green-300 p-3 dark:border-stone-700">
            {selectedPet.imageUrl ? (
              <Image src={selectedPet.imageUrl} alt="" width={48} height={48} className="h-12 w-12 rounded border-2 border-blue-600" />
            ) : null}
            <span className="flex-1 text-sm">{selectedPet.name}</span>
            <button type="button" onClick={() => setSelectedPetId(null)} className="text-sm text-stone-500 hover:text-red-600">
              Remove
            </button>
          </div>
        ) : selectedItem ? (
          <div className="flex items-center gap-3 rounded-lg border border-green-300 p-3 dark:border-stone-700">
            {selectedItem.imageUrl ? (
              <Image src={selectedItem.imageUrl} alt="" width={48} height={48} className="h-12 w-12 rounded border-2 border-green-600" />
            ) : null}
            <span className="flex-1 text-sm">
              {selectedItem.name} × {selectedItemQty}
            </span>
            <button
              type="button"
              onClick={() => {
                setSelectedItemId(null);
                setSelectedItemQty(0);
              }}
              className="text-sm text-stone-500 hover:text-red-600"
            >
              Remove
            </button>
          </div>
        ) : (
          <p className="text-sm italic text-stone-500">Nothing chosen yet.</p>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setModalOpen("pets")}
            className="rounded-md border border-green-300 px-3 py-1.5 text-xs hover:bg-green-100 dark:border-stone-700 dark:hover:bg-stone-800"
          >
            Choose a pet
          </button>
          <button
            type="button"
            onClick={() => setModalOpen("items")}
            className="rounded-md border border-green-300 px-3 py-1.5 text-xs hover:bg-green-100 dark:border-stone-700 dark:hover:bg-stone-800"
          >
            Choose an item
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Price</span>
        <p className="text-xs text-stone-500">
          Set a coin price, a gem price, or both — buyers pick whichever they&apos;d rather pay
          with.
        </p>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            🪙
            <input
              type="number"
              min={0}
              value={priceCoins}
              onChange={(e) => setPriceCoins(Math.max(0, Number(e.target.value) || 0))}
              className="w-24 rounded-md border border-green-300 px-2 py-1 dark:border-stone-700 dark:bg-stone-900"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            💎
            <input
              type="number"
              min={0}
              value={priceGems}
              onChange={(e) => setPriceGems(Math.max(0, Number(e.target.value) || 0))}
              className="w-24 rounded-md border border-green-300 px-2 py-1 dark:border-stone-700 dark:bg-stone-900"
            />
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="duration" className="text-sm font-medium">
          Listing duration
        </label>
        <select
          id="duration"
          value={durationDays}
          onChange={(e) => setDurationDays(Number(e.target.value) as ListingDurationDays)}
          className="w-40 rounded-md border border-green-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
        >
          {DURATIONS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-stone-500">
          The listing automatically unlists itself if nobody buys it in time.
        </p>
      </div>

      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isPending}
        className="self-start rounded-md bg-green-800 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60 dark:bg-green-200 dark:text-green-950 dark:hover:bg-green-300"
      >
        {isPending ? "Listing…" : "List for sale"}
      </button>

      {modalOpen === "pets" ? (
        <PetPickerModal
          title="Choose a pet to sell"
          pets={pickerPets}
          selectedIds={selectedPetId ? new Set([selectedPetId]) : new Set()}
          onToggle={choosePet}
          onClose={() => setModalOpen(null)}
          emptyText="You don't have any pets."
        />
      ) : null}
      {modalOpen === "items" ? (
        <ItemPickerModal
          title="Choose an item to sell"
          items={pickerItems}
          quantities={selectedItemId ? { [selectedItemId]: selectedItemQty } : {}}
          onSetQuantity={chooseItemQuantity}
          onClose={() => setModalOpen(null)}
          emptyText="You don't have any items."
        />
      ) : null}
    </div>
  );
}
