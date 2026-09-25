"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ExpeditionCountdown } from "@/components/expedition-countdown";
import { petImageUrl } from "@/lib/pet-display";
import { CurrencyIcon } from "@/components/currency-icon";
import { BREEDING_COST } from "@/config";
import type { ActiveBreedingAttempt, BreedablePet, EggReveal } from "@/lib/supabase/types";

function TraitRow({ label, name, rarityTier, hex }: { label: string; name: string; rarityTier?: string; hex?: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-stone-500">{label}</span>
      <span className="flex items-center gap-2">
        {hex ? <span className="h-3.5 w-3.5 rounded-full border border-black/10" style={{ backgroundColor: hex }} /> : null}
        {name}
        {rarityTier ? <span className="text-xs capitalize text-stone-500">({rarityTier})</span> : null}
      </span>
    </div>
  );
}

export function BreedingNest({
  userId,
  pets,
  coinBalance,
  denSize,
  activeAttempt,
  parentNames,
  eggReveal,
}: {
  userId: string;
  pets: BreedablePet[];
  coinBalance: number;
  denSize: number;
  activeAttempt: ActiveBreedingAttempt | null;
  parentNames: { a: string; b: string } | null;
  eggReveal: EggReveal | null;
}) {
  const router = useRouter();
  const [petAId, setPetAId] = useState("");
  const [petBId, setPetBId] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const petA = pets.find((p) => p.id === petAId) ?? null;
  const petB = pets.find((p) => p.id === petBId) ?? null;
  const canAffordBreeding = coinBalance >= BREEDING_COST;
  const eligible =
    petA &&
    petB &&
    petA.id !== petB.id &&
    petA.breed?.id &&
    petA.breed.id === petB.breed?.id &&
    petA.gender &&
    petB.gender &&
    petA.gender !== petB.gender;

  async function handleStart() {
    if (!petA || !petB) return;
    setIsPending(true);
    setError(null);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("start_breeding", {
      p_user_id: userId,
      p_pet_a_id: petA.id,
      p_pet_b_id: petB.id,
    });
    setIsPending(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    router.refresh();
  }

  async function handleClaim(keep: boolean) {
    if (!activeAttempt) return;
    setIsPending(true);
    setError(null);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("claim_egg", {
      p_user_id: userId,
      p_attempt_id: activeAttempt.id,
      p_keep: keep,
    });
    setIsPending(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    router.refresh();
  }

  if (activeAttempt?.status === "in_progress") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-green-200 p-8 text-center dark:border-stone-800">
        <p className="text-lg font-medium">
          {parentNames?.a ?? "A pet"} and {parentNames?.b ?? "a pet"} are nesting…
        </p>
        <ExpeditionCountdown resolvesAt={activeAttempt.resolves_at} />
      </div>
    );
  }

  if (activeAttempt?.status === "awaiting_claim") {
    const denFull = pets.length >= denSize;
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-green-200 p-8 text-center dark:border-stone-800">
        <p className="text-lg font-semibold tracking-tight">An egg is ready to hatch!</p>
        {eggReveal ? (
          <div className="flex w-full max-w-xs flex-col gap-2 rounded-lg bg-green-50 p-4 text-left dark:bg-stone-900">
            <TraitRow label="Breed" name={eggReveal.breed?.name ?? "Unknown"} />
            <TraitRow label="Gender" name={eggReveal.pending_gender ?? "—"} />
            {eggReveal.primaryColor ? (
              <TraitRow
                label="Primary color"
                name={eggReveal.primaryColor.name}
                rarityTier={eggReveal.primaryColor.rarity_tier}
                hex={eggReveal.primaryColor.hex_swatch}
              />
            ) : null}
            {eggReveal.secondaryColor ? (
              <TraitRow
                label="Secondary color"
                name={eggReveal.secondaryColor.name}
                rarityTier={eggReveal.secondaryColor.rarity_tier}
                hex={eggReveal.secondaryColor.hex_swatch}
              />
            ) : null}
            {eggReveal.tertiaryColor ? (
              <TraitRow
                label="Tertiary color"
                name={eggReveal.tertiaryColor.name}
                rarityTier={eggReveal.tertiaryColor.rarity_tier}
                hex={eggReveal.tertiaryColor.hex_swatch}
              />
            ) : null}
            {eggReveal.pattern ? (
              <TraitRow label="Pattern" name={eggReveal.pattern.name} rarityTier={eggReveal.pattern.rarity_tier} />
            ) : null}
            {eggReveal.eyeType ? (
              <TraitRow label="Eyes" name={eggReveal.eyeType.name} rarityTier={eggReveal.eyeType.rarity_tier} />
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-stone-500">Loading…</p>
        )}
        {denFull ? <p className="text-xs text-amber-700 dark:text-amber-400">Your den is full — expand it or release this egg.</p> : null}
        {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
        <div className="flex w-full max-w-xs gap-3">
          <button
            type="button"
            onClick={() => handleClaim(true)}
            disabled={isPending || denFull}
            className="flex-1 rounded-md bg-green-800 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60 dark:bg-green-200 dark:text-green-950 dark:hover:bg-green-300"
          >
            {isPending ? "…" : "Keep it"}
          </button>
          <button
            type="button"
            onClick={() => handleClaim(false)}
            disabled={isPending}
            className="flex-1 rounded-md border border-green-300 px-4 py-2 text-sm hover:bg-green-100 disabled:opacity-60 dark:border-stone-700 dark:hover:bg-stone-800"
          >
            {isPending ? "…" : "Release it"}
          </button>
        </div>
      </div>
    );
  }

  if (pets.length < 2) {
    return (
      <p className="text-sm text-stone-500 italic">
        You need at least two trait-based pets to breed. Pets from before the breeding system (still shown with their
        old species art) can&apos;t breed yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-green-200 p-6 dark:border-stone-800">
      <div className="grid grid-cols-2 gap-4">
        {(
          [
            ["Pet A", petAId, setPetAId, petA],
            ["Pet B", petBId, setPetBId, petB],
          ] as const
        ).map(([label, value, setValue, selected]) => (
          <div key={label} className="flex flex-col items-center gap-2">
            <label className="text-sm font-medium">{label}</label>
            {selected && petImageUrl(selected) ? (
              <Image
                src={petImageUrl(selected)!}
                alt={selected.custom_name ?? ""}
                width={80}
                height={80}
                className="h-20 w-20 rounded-lg border-2 border-blue-600 object-cover"
              />
            ) : (
              <div className="h-20 w-20 rounded-lg bg-green-200 dark:bg-stone-800" />
            )}
            <select
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full rounded-md border border-green-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
            >
              <option value="">— Select a pet —</option>
              {pets.map((pet) => (
                <option key={pet.id} value={pet.id}>
                  {pet.custom_name ?? pet.breed?.name ?? "Unnamed"} ({pet.gender ?? "?"})
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {petA && petB && !eligible ? (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          {petA.id === petB.id
            ? "Pick two different pets."
            : petA.breed?.id !== petB.breed?.id
              ? "Both pets must be the same breed."
              : "Breeding needs one male and one female pet."}
        </p>
      ) : null}

      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

      <button
        type="button"
        onClick={handleStart}
        disabled={!eligible || isPending || !canAffordBreeding}
        className="self-start rounded-md bg-green-800 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60 dark:bg-green-200 dark:text-green-950 dark:hover:bg-green-300"
      >
        {isPending ? (
          "Starting…"
        ) : (
          <>
            Start breeding — <CurrencyIcon kind="coin" /> {BREEDING_COST}
          </>
        )}
      </button>
      {!canAffordBreeding ? <p className="text-xs text-stone-500">Not enough coins yet.</p> : null}
    </div>
  );
}
