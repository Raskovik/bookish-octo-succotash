"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PetPickerModal, ItemPickerModal, type PickerPet, type PickerItem } from "@/components/picker-modal";
import { petImageUrl, petTypeName } from "@/lib/pet-display";
import { CurrencyIcon } from "@/components/currency-icon";
import type { ItemWithQuantity, PetWithSpecies } from "@/lib/supabase/types";

type ModalTarget = "myPets" | "myItems" | "theirPets" | "theirItems" | null;

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

function SelectionChips({
  pets,
  items,
  petSource,
  itemSource,
  onRemovePet,
  onRemoveItem,
}: {
  pets: Set<string>;
  items: Record<string, number>;
  petSource: PickerPet[];
  itemSource: PickerItem[];
  onRemovePet: (id: string) => void;
  onRemoveItem: (id: string) => void;
}) {
  const chips: { key: string; label: string; imageUrl: string | null; onRemove: () => void }[] = [];

  for (const id of pets) {
    const pet = petSource.find((p) => p.id === id);
    if (pet) chips.push({ key: `pet-${id}`, label: pet.name, imageUrl: pet.imageUrl, onRemove: () => onRemovePet(id) });
  }
  for (const [id, qty] of Object.entries(items)) {
    if (qty <= 0) continue;
    const item = itemSource.find((i) => i.id === id);
    if (item)
      chips.push({
        key: `item-${id}`,
        label: `${item.name} ×${qty}`,
        imageUrl: item.imageUrl,
        onRemove: () => onRemoveItem(id),
      });
  }

  if (chips.length === 0) {
    return <p className="text-sm italic text-stone-500">Nothing added yet.</p>;
  }

  return (
    <ul className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <li
          key={chip.key}
          className="flex items-center gap-1.5 rounded-full border border-green-300 py-1 pl-1 pr-2 text-xs dark:border-stone-700"
        >
          {chip.imageUrl ? (
            <Image src={chip.imageUrl} alt="" width={20} height={20} className="h-5 w-5 rounded" />
          ) : null}
          {chip.label}
          <button type="button" onClick={chip.onRemove} className="text-stone-500 hover:text-red-600">
            ×
          </button>
        </li>
      ))}
    </ul>
  );
}

export function TradeBuilderForm({
  userId,
  initialRecipientName,
  initialPetId,
  initialItemId,
  pets,
  inventory,
  coinBalance,
  gemBalance,
}: {
  userId: string;
  initialRecipientName: string;
  initialPetId?: string;
  initialItemId?: string;
  pets: PetWithSpecies[];
  inventory: ItemWithQuantity[];
  coinBalance: number;
  gemBalance: number;
}) {
  const router = useRouter();
  const [recipientName, setRecipientName] = useState(initialRecipientName);
  const [recipientId, setRecipientId] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const [theirPets, setTheirPets] = useState<PickerPet[]>([]);
  const [theirItems, setTheirItems] = useState<PickerItem[]>([]);

  const [selectedPetIds, setSelectedPetIds] = useState<Set<string>>(new Set());
  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>({});
  const [coins, setCoins] = useState(0);
  const [gems, setGems] = useState(0);

  const [requestedPetIds, setRequestedPetIds] = useState<Set<string>>(new Set());
  const [requestedItemQuantities, setRequestedItemQuantities] = useState<Record<string, number>>({});
  const [requestedCoins, setRequestedCoins] = useState(0);
  const [requestedGems, setRequestedGems] = useState(0);

  const [note, setNote] = useState("");
  const [modalTarget, setModalTarget] = useState<ModalTarget>(null);
  const [isPending, setIsPending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const myPickerPets = toPickerPets(pets);
  const myPickerItems = toPickerItems(inventory);

  async function resolveRecipient(name: string) {
    const trimmed = name.trim();
    if (trimmed.length === 0) return;

    setIsResolving(true);
    setResolveError(null);
    const supabase = createClient();

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("id, display_name")
      .ilike("display_name", trimmed)
      .maybeSingle();

    if (!profile) {
      setIsResolving(false);
      setResolveError(`No player found named "${trimmed}".`);
      setRecipientId(null);
      return;
    }
    if (profile.id === userId) {
      setIsResolving(false);
      setResolveError("You can't trade with yourself.");
      setRecipientId(null);
      return;
    }

    const [{ data: theirPetsData }, { data: theirItemsData }] = await Promise.all([
      supabase
        .from("pets")
        .select("id, rarity, custom_name, composited_image_url, species(name, image_url), breed:breeds(name)")
        .eq("owner_id", profile.id)
        .eq("is_for_trade", true),
      supabase
        .from("user_inventory")
        .select("quantity, item:items(id, name, image_url, rarity, type)")
        .eq("user_id", profile.id)
        .eq("is_for_trade", true)
        .gt("quantity", 0),
    ]);

    const petList = toPickerPets(((theirPetsData ?? []) as unknown) as PetWithSpecies[]);
    const itemList = toPickerItems(((theirItemsData ?? []) as unknown) as ItemWithQuantity[]);
    setTheirPets(petList);
    setTheirItems(itemList);
    setRecipientId(profile.id);
    setIsResolving(false);

    if (initialPetId && petList.some((p) => p.id === initialPetId)) {
      setRequestedPetIds((prev) => new Set(prev).add(initialPetId));
    }
    if (initialItemId) {
      const match = itemList.find((i) => i.id === initialItemId);
      if (match) {
        setRequestedItemQuantities((prev) => ({ ...prev, [initialItemId]: 1 }));
      }
    }
  }

  useEffect(() => {
    if (initialRecipientName.trim().length === 0) return;
    // Deferred a tick so the effect body itself never synchronously
    // calls setState (resolveRecipient's first line does, before its
    // first await) — react-hooks/set-state-in-effect flags that.
    const timer = setTimeout(() => void resolveRecipient(initialRecipientName), 0);
    return () => clearTimeout(timer);
    // Only run once, for the initial ?to= value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function togglePet(id: string, which: "mine" | "theirs") {
    const setter = which === "mine" ? setSelectedPetIds : setRequestedPetIds;
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function setQty(id: string, qty: number, max: number, which: "mine" | "theirs") {
    const clamped = Math.max(0, Math.min(qty, max));
    const setter = which === "mine" ? setItemQuantities : setRequestedItemQuantities;
    setter((prev) => ({ ...prev, [id]: clamped }));
  }

  async function handleSubmit() {
    setSubmitError(null);

    if (!recipientId) {
      setSubmitError("Find who you want to trade with first.");
      return;
    }

    const itemIds = Object.entries(itemQuantities).filter(([, q]) => q > 0).map(([id]) => id);
    const itemQtys = itemIds.map((id) => itemQuantities[id]);
    const requestedItemIds = Object.entries(requestedItemQuantities)
      .filter(([, q]) => q > 0)
      .map(([id]) => id);
    const requestedItemQtys = requestedItemIds.map((id) => requestedItemQuantities[id]);

    if (
      selectedPetIds.size === 0 &&
      itemIds.length === 0 &&
      coins === 0 &&
      gems === 0
    ) {
      setSubmitError("Add at least one pet, item, coin, or gem to your offer.");
      return;
    }

    setIsPending(true);
    const supabase = createClient();

    const { data: tradeId, error: rpcError } = await supabase.rpc("create_trade", {
      p_initiator_id: userId,
      p_recipient_id: recipientId,
      p_pet_ids: [...selectedPetIds],
      p_item_ids: itemIds,
      p_item_quantities: itemQtys,
      p_coins: coins,
      p_gems: gems,
      p_note: note.trim() || null,
      p_requested_pet_ids: [...requestedPetIds],
      p_requested_item_ids: requestedItemIds,
      p_requested_item_quantities: requestedItemQtys,
      p_requested_coins: requestedCoins,
      p_requested_gems: requestedGems,
    });

    setIsPending(false);

    if (rpcError || !tradeId) {
      setSubmitError(rpcError?.message ?? "Could not create the trade.");
      return;
    }

    router.push(`/trades/${tradeId}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="recipient" className="text-sm font-medium">
          Trade with (username)
        </label>
        <div className="flex gap-2">
          <input
            id="recipient"
            value={recipientName}
            onChange={(e) => {
              setRecipientName(e.target.value);
              setRecipientId(null);
            }}
            placeholder="Their display name"
            className="flex-1 rounded-md border border-green-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
          />
          <button
            type="button"
            onClick={() => resolveRecipient(recipientName)}
            disabled={isResolving}
            className="rounded-md border border-green-300 px-4 py-2 text-sm hover:bg-green-100 disabled:opacity-60 dark:border-stone-700 dark:hover:bg-stone-800"
          >
            {isResolving ? "Finding…" : "Find"}
          </button>
        </div>
        {resolveError ? <p className="text-sm text-red-600 dark:text-red-400">{resolveError}</p> : null}
        {recipientId ? (
          <p className="text-sm text-green-700 dark:text-green-400">
            Trading with {recipientName.trim()}
          </p>
        ) : (
          <p className="text-xs text-stone-500">
            Or browse{" "}
            <Link href="/trades/browse" className="underline">
              what&apos;s for trade
            </Link>{" "}
            to find someone.
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-lg border border-green-200 p-4 dark:border-stone-800">
          <h3 className="text-sm font-semibold">You give</h3>
          <div className="flex gap-4">
            <label className="flex items-center gap-1.5 text-sm">
              <CurrencyIcon kind="coin" />
              <input
                type="number"
                min={0}
                max={coinBalance}
                value={coins}
                onChange={(e) => setCoins(Math.max(0, Math.min(Number(e.target.value) || 0, coinBalance)))}
                className="w-20 rounded-md border border-green-300 px-2 py-1 dark:border-stone-700 dark:bg-stone-900"
              />
            </label>
            <label className="flex items-center gap-1.5 text-sm">
              <CurrencyIcon kind="gem" />
              <input
                type="number"
                min={0}
                max={gemBalance}
                value={gems}
                onChange={(e) => setGems(Math.max(0, Math.min(Number(e.target.value) || 0, gemBalance)))}
                className="w-20 rounded-md border border-green-300 px-2 py-1 dark:border-stone-700 dark:bg-stone-900"
              />
            </label>
          </div>
          <SelectionChips
            pets={selectedPetIds}
            items={itemQuantities}
            petSource={myPickerPets}
            itemSource={myPickerItems}
            onRemovePet={(id) => togglePet(id, "mine")}
            onRemoveItem={(id) => setQty(id, 0, 0, "mine")}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setModalTarget("myPets")}
              className="rounded-md border border-green-300 px-3 py-1.5 text-xs hover:bg-green-100 dark:border-stone-700 dark:hover:bg-stone-800"
            >
              + Add pet
            </button>
            <button
              type="button"
              onClick={() => setModalTarget("myItems")}
              className="rounded-md border border-green-300 px-3 py-1.5 text-xs hover:bg-green-100 dark:border-stone-700 dark:hover:bg-stone-800"
            >
              + Add item
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-green-200 p-4 dark:border-stone-800">
          <h3 className="text-sm font-semibold">You want</h3>
          {!recipientId ? (
            <p className="text-sm italic text-stone-500">
              Find a player first to see what they&apos;ll trade.
            </p>
          ) : (
            <>
              <div className="flex gap-4">
                <label className="flex items-center gap-1.5 text-sm">
                  <CurrencyIcon kind="coin" />
                  <input
                    type="number"
                    min={0}
                    value={requestedCoins}
                    onChange={(e) => setRequestedCoins(Math.max(0, Number(e.target.value) || 0))}
                    className="w-20 rounded-md border border-green-300 px-2 py-1 dark:border-stone-700 dark:bg-stone-900"
                  />
                </label>
                <label className="flex items-center gap-1.5 text-sm">
                  <CurrencyIcon kind="gem" />
                  <input
                    type="number"
                    min={0}
                    value={requestedGems}
                    onChange={(e) => setRequestedGems(Math.max(0, Number(e.target.value) || 0))}
                    className="w-20 rounded-md border border-green-300 px-2 py-1 dark:border-stone-700 dark:bg-stone-900"
                  />
                </label>
              </div>
              <SelectionChips
                pets={requestedPetIds}
                items={requestedItemQuantities}
                petSource={theirPets}
                itemSource={theirItems}
                onRemovePet={(id) => togglePet(id, "theirs")}
                onRemoveItem={(id) => setQty(id, 0, 0, "theirs")}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setModalTarget("theirPets")}
                  className="rounded-md border border-green-300 px-3 py-1.5 text-xs hover:bg-green-100 dark:border-stone-700 dark:hover:bg-stone-800"
                >
                  + Add their pet
                </button>
                <button
                  type="button"
                  onClick={() => setModalTarget("theirItems")}
                  className="rounded-md border border-green-300 px-3 py-1.5 text-xs hover:bg-green-100 dark:border-stone-700 dark:hover:bg-stone-800"
                >
                  + Add their item
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="note" className="text-sm font-medium">
          Note (optional)
        </label>
        <textarea
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={300}
          rows={2}
          placeholder="Anything else you'd like them to know"
          className="resize-y rounded-md border border-green-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
        />
      </div>

      {submitError ? <p className="text-sm text-red-600 dark:text-red-400">{submitError}</p> : null}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isPending}
        className="self-start rounded-md bg-green-800 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60 dark:bg-green-200 dark:text-green-950 dark:hover:bg-green-300"
      >
        {isPending ? "Sending…" : "Send trade offer"}
      </button>

      {modalTarget === "myPets" ? (
        <PetPickerModal
          title="Add your pets"
          pets={myPickerPets}
          selectedIds={selectedPetIds}
          onToggle={(id) => togglePet(id, "mine")}
          onClose={() => setModalTarget(null)}
          emptyText="You don't have any pets."
        />
      ) : null}
      {modalTarget === "myItems" ? (
        <ItemPickerModal
          title="Add your items"
          items={myPickerItems}
          quantities={itemQuantities}
          onSetQuantity={(id, qty, max) => setQty(id, qty, max, "mine")}
          onClose={() => setModalTarget(null)}
          emptyText="You don't have any items."
        />
      ) : null}
      {modalTarget === "theirPets" ? (
        <PetPickerModal
          title="Add pets they've marked for trade"
          pets={theirPets}
          selectedIds={requestedPetIds}
          onToggle={(id) => togglePet(id, "theirs")}
          onClose={() => setModalTarget(null)}
          emptyText="They haven't marked any pets for trade."
        />
      ) : null}
      {modalTarget === "theirItems" ? (
        <ItemPickerModal
          title="Add items they've marked for trade"
          items={theirItems}
          quantities={requestedItemQuantities}
          onSetQuantity={(id, qty, max) => setQty(id, qty, max, "theirs")}
          onClose={() => setModalTarget(null)}
          emptyText="They haven't marked any items for trade."
        />
      ) : null}
    </div>
  );
}
