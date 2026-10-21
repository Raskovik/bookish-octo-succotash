"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { GamePanel, GameButton, IconButton } from "@/components/game-ui";
import type { PetRarity } from "@/lib/supabase/types";

// Normalized shapes the modal renders — callers adapt whatever query
// result they have (own collection vs. another player's pool) into
// these before opening the picker, so the modal itself doesn't need to
// know which source it's browsing. Originally built for trading (see
// src/app/trades/, currently hidden behind TRADING_ENABLED), reused by
// the marketplace's sell flow — kept here rather than under either
// feature's folder so neither depends on the other.
export type PickerPet = {
  id: string;
  name: string;
  imageUrl: string | null;
  rarity: PetRarity;
};

export type PickerItem = {
  id: string;
  name: string;
  imageUrl: string | null;
  rarity: PetRarity;
  maxQuantity: number;
};

const RARITIES: PetRarity[] = ["common", "uncommon", "rare", "epic", "legendary"];

function useFilteredList<T extends { name: string; rarity: PetRarity }>(list: T[]) {
  const [search, setSearch] = useState("");
  const [rarity, setRarity] = useState<PetRarity | "all">("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return list.filter((entry) => {
      if (rarity !== "all" && entry.rarity !== rarity) return false;
      if (q.length > 0 && !entry.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [list, search, rarity]);

  return { search, setSearch, rarity, setRarity, filtered };
}

function FilterBar({
  search,
  setSearch,
  rarity,
  setRarity,
}: {
  search: string;
  setSearch: (v: string) => void;
  rarity: PetRarity | "all";
  setRarity: (v: PetRarity | "all") => void;
}) {
  return (
    <div className="flex gap-2">
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name…"
        className="flex-1 rounded-md border border-green-300 px-3 py-1.5 text-sm dark:border-stone-700 dark:bg-stone-900"
      />
      <select
        value={rarity}
        onChange={(e) => setRarity(e.target.value as PetRarity | "all")}
        className="rounded-md border border-green-300 px-2 py-1.5 text-sm capitalize dark:border-stone-700 dark:bg-stone-900"
      >
        <option value="all">All rarities</option>
        {RARITIES.map((r) => (
          <option key={r} value={r} className="capitalize">
            {r}
          </option>
        ))}
      </select>
    </div>
  );
}

function ModalShell({
  title,
  onClose,
  footer,
  children,
}: {
  title: string;
  onClose: () => void;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <GamePanel
        className="max-h-[85vh] w-full max-w-2xl"
        contentClassName="gap-3 p-4 overflow-hidden dark:bg-stone-900"
        title={title}
        right={<IconButton icon={X} label="Close" variant="danger" size={32} onClick={onClose} />}
      >
        <div className="flex-1 overflow-y-auto">{children}</div>
        <div className="flex items-center justify-between border-t-2 border-amber-200 pt-3 dark:border-stone-800">
          {footer}
        </div>
      </GamePanel>
    </div>
  );
}

export function PetPickerModal({
  title,
  pets,
  selectedIds,
  onToggle,
  onClose,
  emptyText,
}: {
  title: string;
  pets: PickerPet[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onClose: () => void;
  emptyText: string;
}) {
  const { search, setSearch, rarity, setRarity, filtered } = useFilteredList(pets);

  return (
    <ModalShell
      title={title}
      onClose={onClose}
      footer={
        <>
          <span className="text-sm text-stone-500">{selectedIds.size} selected</span>
          <GameButton type="button" onClick={onClose}>
            Done
          </GameButton>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <FilterBar search={search} setSearch={setSearch} rarity={rarity} setRarity={setRarity} />
        {filtered.length === 0 ? (
          <p className="py-6 text-center text-sm italic text-stone-500">{emptyText}</p>
        ) : (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {filtered.map((pet) => {
              const selected = selectedIds.has(pet.id);
              return (
                <li key={pet.id}>
                  <button
                    type="button"
                    onClick={() => onToggle(pet.id)}
                    className={`flex w-full flex-col items-center gap-1 rounded-lg border-2 p-2 text-center ${
                      selected
                        ? "border-green-800 bg-green-100 dark:border-green-200 dark:bg-stone-800"
                        : "border-transparent hover:bg-green-100/60 dark:hover:bg-stone-800/60"
                    }`}
                  >
                    {pet.imageUrl ? (
                      <Image
                        src={pet.imageUrl}
                        alt={pet.name}
                        width={56}
                        height={56}
                        className="h-14 w-14 rounded"
                      />
                    ) : (
                      <div className="h-14 w-14 rounded bg-green-200 dark:bg-stone-800" />
                    )}
                    <span className="text-xs">{pet.name}</span>
                    <span className="text-[10px] capitalize text-stone-500">{pet.rarity}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </ModalShell>
  );
}

export function ItemPickerModal({
  title,
  items,
  quantities,
  onSetQuantity,
  onClose,
  emptyText,
}: {
  title: string;
  items: PickerItem[];
  quantities: Record<string, number>;
  onSetQuantity: (id: string, quantity: number, max: number) => void;
  onClose: () => void;
  emptyText: string;
}) {
  const { search, setSearch, rarity, setRarity, filtered } = useFilteredList(items);
  const selectedCount = Object.values(quantities).filter((q) => q > 0).length;

  return (
    <ModalShell
      title={title}
      onClose={onClose}
      footer={
        <>
          <span className="text-sm text-stone-500">{selectedCount} item types selected</span>
          <GameButton type="button" onClick={onClose}>
            Done
          </GameButton>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <FilterBar search={search} setSearch={setSearch} rarity={rarity} setRarity={setRarity} />
        {filtered.length === 0 ? (
          <p className="py-6 text-center text-sm italic text-stone-500">{emptyText}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {filtered.map((item) => (
              <li key={item.id} className="flex items-center gap-3">
                {item.imageUrl ? (
                  <Image
                    src={item.imageUrl}
                    alt={item.name}
                    width={36}
                    height={36}
                    className="h-9 w-9 rounded"
                  />
                ) : (
                  <div className="h-9 w-9 rounded bg-green-200 dark:bg-stone-800" />
                )}
                <span className="flex-1 text-sm">{item.name}</span>
                <input
                  type="number"
                  min={0}
                  max={item.maxQuantity}
                  value={quantities[item.id] ?? 0}
                  onChange={(e) =>
                    onSetQuantity(item.id, Number(e.target.value) || 0, item.maxQuantity)
                  }
                  className="w-16 rounded-md border border-green-300 px-2 py-1 text-sm dark:border-stone-700 dark:bg-stone-900"
                />
                <span className="text-xs text-stone-500">/ {item.maxQuantity}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ModalShell>
  );
}
