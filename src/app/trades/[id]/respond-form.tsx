"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PetPickerModal, ItemPickerModal, type PickerPet, type PickerItem } from "@/components/picker-modal";
import { petImageUrl, petTypeName } from "@/lib/pet-display";
import { CurrencyIcon } from "@/components/currency-icon";
import type { ItemWithQuantity, PetWithSpecies } from "@/lib/supabase/types";

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

export function RespondForm({
  userId,
  tradeId,
  pets,
  inventory,
  coinBalance,
  gemBalance,
  requestedPetIds,
  requestedItemQuantities,
  requestedCoins,
  requestedGems,
}: {
  userId: string;
  tradeId: string;
  pets: PetWithSpecies[];
  inventory: ItemWithQuantity[];
  coinBalance: number;
  gemBalance: number;
  requestedPetIds: string[];
  requestedItemQuantities: Record<string, number>;
  requestedCoins: number;
  requestedGems: number;
}) {
  const router = useRouter();
  const pickerPets = toPickerPets(pets);
  const pickerItems = toPickerItems(inventory);

  // Pre-filled from what was requested, but only for pets/items the
  // recipient still actually owns in enough quantity — a stale request
  // (they already spent/traded something) shouldn't silently offer more
  // than they have; respond_to_trade re-validates this for real anyway,
  // this just keeps the pre-fill honest.
  const [selectedPetIds, setSelectedPetIds] = useState<Set<string>>(
    () => new Set(requestedPetIds.filter((id) => pickerPets.some((p) => p.id === id))),
  );
  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const [id, qty] of Object.entries(requestedItemQuantities)) {
      const match = pickerItems.find((i) => i.id === id);
      if (match) initial[id] = Math.min(qty, match.maxQuantity);
    }
    return initial;
  });
  const [coins, setCoins] = useState(Math.min(requestedCoins, coinBalance));
  const [gems, setGems] = useState(Math.min(requestedGems, gemBalance));

  const [modalTarget, setModalTarget] = useState<"pets" | "items" | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function togglePet(id: string) {
    setSelectedPetIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function setItemQuantity(id: string, quantity: number, max: number) {
    setItemQuantities((prev) => ({ ...prev, [id]: Math.max(0, Math.min(quantity, max)) }));
  }

  async function respond(accept: boolean) {
    setIsPending(true);
    setError(null);

    const itemIds = Object.entries(itemQuantities).filter(([, q]) => q > 0).map(([id]) => id);
    const itemQtys = itemIds.map((id) => itemQuantities[id]);

    const supabase = createClient();
    const { error } = await supabase.rpc("respond_to_trade", {
      p_user_id: userId,
      p_trade_id: tradeId,
      p_accept: accept,
      p_pet_ids: accept ? [...selectedPetIds] : [],
      p_item_ids: accept ? itemIds : [],
      p_item_quantities: accept ? itemQtys : [],
      p_coins: accept ? coins : 0,
      p_gems: accept ? gems : 0,
    });

    setIsPending(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.refresh();
  }

  const requestedNothing =
    requestedPetIds.length === 0 &&
    Object.values(requestedItemQuantities).every((q) => q === 0) &&
    requestedCoins === 0 &&
    requestedGems === 0;

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-green-200 p-4 dark:border-stone-800">
      <h3 className="text-sm font-semibold">Respond to this trade</h3>
      {requestedNothing ? (
        <p className="text-xs text-stone-500">
          Nothing specific was requested — accepting below gives it as a gift, or add something
          from your own collection first.
        </p>
      ) : (
        <p className="text-xs text-stone-500">
          Pre-filled with what was requested — remove or add anything before accepting.
        </p>
      )}

      <div className="flex gap-4">
        <label className="flex items-center gap-2 text-sm">
          <CurrencyIcon kind="coin" />
          <input
            type="number"
            min={0}
            max={coinBalance}
            value={coins}
            onChange={(e) => setCoins(Math.max(0, Math.min(Number(e.target.value) || 0, coinBalance)))}
            className="w-24 rounded-md border border-green-300 px-2 py-1 dark:border-stone-700 dark:bg-stone-900"
          />
          <span className="text-xs text-stone-500">/ {coinBalance}</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <CurrencyIcon kind="gem" />
          <input
            type="number"
            min={0}
            max={gemBalance}
            value={gems}
            onChange={(e) => setGems(Math.max(0, Math.min(Number(e.target.value) || 0, gemBalance)))}
            className="w-24 rounded-md border border-green-300 px-2 py-1 dark:border-stone-700 dark:bg-stone-900"
          />
          <span className="text-xs text-stone-500">/ {gemBalance}</span>
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        {[...selectedPetIds].map((id) => {
          const pet = pickerPets.find((p) => p.id === id);
          if (!pet) return null;
          return (
            <span
              key={id}
              className="flex items-center gap-1.5 rounded-full border border-green-300 py-1 pl-1 pr-2 text-xs dark:border-stone-700"
            >
              {pet.imageUrl ? (
                <Image src={pet.imageUrl} alt="" width={20} height={20} className="h-5 w-5 rounded" />
              ) : null}
              {pet.name}
              <button type="button" onClick={() => togglePet(id)} className="text-stone-500 hover:text-red-600">
                ×
              </button>
            </span>
          );
        })}
        {Object.entries(itemQuantities)
          .filter(([, q]) => q > 0)
          .map(([id, qty]) => {
            const item = pickerItems.find((i) => i.id === id);
            if (!item) return null;
            return (
              <span
                key={id}
                className="flex items-center gap-1.5 rounded-full border border-green-300 py-1 pl-1 pr-2 text-xs dark:border-stone-700"
              >
                {item.imageUrl ? (
                  <Image src={item.imageUrl} alt="" width={20} height={20} className="h-5 w-5 rounded" />
                ) : null}
                {item.name} ×{qty}
                <button
                  type="button"
                  onClick={() => setItemQuantity(id, 0, 0)}
                  className="text-stone-500 hover:text-red-600"
                >
                  ×
                </button>
              </span>
            );
          })}
        {selectedPetIds.size === 0 && Object.values(itemQuantities).every((q) => q === 0) ? (
          <span className="text-sm italic text-stone-500">Nothing added.</span>
        ) : null}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setModalTarget("pets")}
          className="rounded-md border border-green-300 px-3 py-1.5 text-xs hover:bg-green-100 dark:border-stone-700 dark:hover:bg-stone-800"
        >
          + Add pet
        </button>
        <button
          type="button"
          onClick={() => setModalTarget("items")}
          className="rounded-md border border-green-300 px-3 py-1.5 text-xs hover:bg-green-100 dark:border-stone-700 dark:hover:bg-stone-800"
        >
          + Add item
        </button>
      </div>

      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => respond(true)}
          disabled={isPending}
          className="rounded-md bg-green-800 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60 dark:bg-green-200 dark:text-green-950 dark:hover:bg-green-300"
        >
          {isPending ? "Working…" : "Accept trade"}
        </button>
        <button
          type="button"
          onClick={() => respond(false)}
          disabled={isPending}
          className="rounded-md border border-red-300 px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-60 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
        >
          Decline
        </button>
      </div>

      {modalTarget === "pets" ? (
        <PetPickerModal
          title="Add your pets"
          pets={pickerPets}
          selectedIds={selectedPetIds}
          onToggle={togglePet}
          onClose={() => setModalTarget(null)}
          emptyText="You don't have any pets."
        />
      ) : null}
      {modalTarget === "items" ? (
        <ItemPickerModal
          title="Add your items"
          items={pickerItems}
          quantities={itemQuantities}
          onSetQuantity={setItemQuantity}
          onClose={() => setModalTarget(null)}
          emptyText="You don't have any items."
        />
      ) : null}
    </div>
  );
}
