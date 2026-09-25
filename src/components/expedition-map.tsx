"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ExpeditionCountdown } from "@/components/expedition-countdown";
import { ClaimRewardModal } from "@/components/claim-reward-modal";
import { petTypeName } from "@/lib/pet-display";
import type {
  ActiveExpeditionSummary,
  ExplorableZone,
  OwnedPotion,
  PetWithSpecies,
} from "@/lib/supabase/types";

// Single sitewide map background — not zone-specific, so it isn't stored
// per-row in the database (see zones.map_x/y/width/height for the
// per-zone hotspot placement over this image).
const MAP_IMAGE_URL =
  "https://placehold.co/1200x800/1a2e1a/FFFFFF/png?text=Expedition+Map+%28Placeholder%29";

export function ExpeditionMap({
  zones,
  pets,
  activeExpeditions,
  ownedPotions,
}: {
  zones: ExplorableZone[];
  pets: PetWithSpecies[];
  activeExpeditions: ActiveExpeditionSummary[];
  ownedPotions: OwnedPotion[];
}) {
  const router = useRouter();
  const [hoveredZoneId, setHoveredZoneId] = useState<string | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [selectedPetId, setSelectedPetId] = useState<string>("");
  const [selectedPotionId, setSelectedPotionId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claimTarget, setClaimTarget] = useState<{ expeditionId: string; zoneName: string } | null>(
    null,
  );

  // The sent pet stays busy, and its zone stays locked, through
  // awaiting_claim too — see the one-expedition-per-zone comment on
  // start_expedition in supabase/migrations/0004_expedition_claim_flow.sql.
  const busyPetIds = useMemo(
    () => new Set(activeExpeditions.map((e) => e.pet_id)),
    [activeExpeditions],
  );

  // At most one entry per zone, enforced server-side — a Map is just a
  // convenient zone_id -> expedition lookup, not modeling "many per zone".
  const activeByZone = useMemo(() => {
    const map = new Map<string, ActiveExpeditionSummary>();
    for (const exp of activeExpeditions) {
      map.set(exp.zone_id, exp);
    }
    return map;
  }, [activeExpeditions]);

  const petsById = useMemo(() => new Map(pets.map((p) => [p.id, p])), [pets]);
  const availablePets = pets.filter((p) => !busyPetIds.has(p.id));

  const selectedZone = zones.find((z) => z.id === selectedZoneId) ?? null;
  const selectedZoneActive = selectedZoneId ? activeByZone.get(selectedZoneId) : undefined;
  const activePet = selectedZoneActive ? petsById.get(selectedZoneActive.pet_id) : undefined;
  const activePetTypeName = activePet ? petTypeName(activePet) : "Your pet";

  function openZone(zoneId: string) {
    setSelectedZoneId(zoneId);
    setError(null);
    setSelectedPotionId("");
    const firstAvailable = pets.find((p) => !busyPetIds.has(p.id));
    setSelectedPetId(firstAvailable?.id ?? "");
  }

  async function handleStart() {
    if (!selectedZoneId || !selectedPetId) return;
    setIsSubmitting(true);
    setError(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Your session expired — please sign in again.");
      setIsSubmitting(false);
      return;
    }

    const { error: rpcError } = await supabase.rpc("start_expedition", {
      p_user_id: user.id,
      p_pet_id: selectedPetId,
      p_zone_id: selectedZoneId,
      p_potion_item_id: selectedPotionId || null,
    });

    setIsSubmitting(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    setSelectedZoneId(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="relative aspect-[3/2] w-full overflow-hidden rounded-lg border border-green-200 dark:border-stone-800">
        <Image
          src={MAP_IMAGE_URL}
          alt="Expedition map"
          fill
          sizes="(min-width: 896px) 800px, 100vw"
          className="object-cover"
          priority
        />
        {zones.map((zone) => {
          const active = activeByZone.get(zone.id);
          if (zone.map_x === null || zone.map_y === null || zone.map_width === null || zone.map_height === null) {
            return null;
          }
          return (
            <button
              key={zone.id}
              type="button"
              onClick={() => openZone(zone.id)}
              onMouseEnter={() => setHoveredZoneId(zone.id)}
              onMouseLeave={() => setHoveredZoneId(null)}
              onFocus={() => setHoveredZoneId(zone.id)}
              onBlur={() => setHoveredZoneId(null)}
              aria-label={`View ${zone.name}`}
              className="absolute overflow-hidden rounded focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-white"
              style={{
                left: `${zone.map_x}%`,
                top: `${zone.map_y}%`,
                width: `${zone.map_width}%`,
                height: `${zone.map_height}%`,
              }}
            >
              {zone.image_url ? (
                <Image
                  src={zone.image_url}
                  alt=""
                  fill
                  sizes="400px"
                  className={`object-cover transition-opacity duration-200 ${
                    hoveredZoneId === zone.id || selectedZoneId === zone.id
                      ? "opacity-90"
                      : "opacity-0"
                  }`}
                />
              ) : null}
              <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1 py-0.5 text-xs font-medium text-white">
                {zone.name}
              </span>
              {active?.status === "awaiting_claim" ? (
                <span className="absolute right-1 top-1 animate-pulse rounded bg-emerald-600 px-1.5 py-0.5 text-xs font-medium text-white">
                  Ready!
                </span>
              ) : active ? (
                <span className="absolute right-1 top-1 rounded bg-black/70 px-1.5 py-0.5">
                  <ExpeditionCountdown resolvesAt={active.resolves_at} compact />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {selectedZone ? (
        <section className="flex flex-col gap-4 rounded-lg border border-green-200 p-4 dark:border-stone-800">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                {selectedZone.name}{" "}
                <span className="text-sm font-normal text-stone-500">Tier {selectedZone.tier}</span>
              </h2>
              <p className="text-sm text-stone-500">
                {selectedZone.description ??
                  "This box is meant to hold this zone's flavor description."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedZoneId(null)}
              className="text-sm text-stone-500 hover:underline"
            >
              Close
            </button>
          </div>

          {selectedZone.pool.length > 0 ? (
            <div>
              <h3 className="text-sm font-medium">You might get:</h3>
              <ul className="mt-2 flex flex-wrap gap-3">
                {selectedZone.pool.map((entry) => (
                  <li key={entry.id} className="flex flex-col items-center gap-1 text-center">
                    {entry.image_url ? (
                      <Image
                        src={entry.image_url}
                        alt={entry.name}
                        width={56}
                        height={56}
                        className="h-14 w-14 rounded border-2 border-green-600"
                      />
                    ) : (
                      <div className="h-14 w-14 rounded bg-green-200 dark:bg-stone-800" />
                    )}
                    <span className="text-xs">{entry.name}</span>
                    <span className="text-xs capitalize text-stone-500">{entry.rarity}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {selectedZoneActive?.status === "awaiting_claim" ? (
            <div className="flex flex-col items-start gap-2 rounded-md bg-emerald-50 p-3 text-sm dark:bg-emerald-950">
              <p className="font-medium">{activePetTypeName} has returned!</p>
              <button
                type="button"
                onClick={() =>
                  setClaimTarget({
                    expeditionId: selectedZoneActive.id,
                    zoneName: selectedZone.name,
                  })
                }
                className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600"
              >
                Claim reward
              </button>
            </div>
          ) : selectedZoneActive ? (
            <div className="flex items-center justify-between gap-2 rounded-md bg-green-100 p-3 text-sm dark:bg-stone-900">
              <span>{activePetTypeName} is exploring here</span>
              <ExpeditionCountdown resolvesAt={selectedZoneActive.resolves_at} />
            </div>
          ) : availablePets.length === 0 ? (
            <p className="text-sm text-stone-500 italic">
              All of your pets are already out on an expedition.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="pet-select" className="text-sm font-medium">
                  Send which pet?
                </label>
                <select
                  id="pet-select"
                  value={selectedPetId}
                  onChange={(e) => setSelectedPetId(e.target.value)}
                  className="rounded-md border border-green-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
                >
                  {availablePets.map((pet) => (
                    <option key={pet.id} value={pet.id}>
                      {pet.custom_name ?? petTypeName(pet)} ({pet.rarity})
                    </option>
                  ))}
                </select>
              </div>

              {ownedPotions.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="potion-select" className="text-sm font-medium">
                    Use a potion? (optional — consumed either way, never guarantees an
                    outcome)
                  </label>
                  <select
                    id="potion-select"
                    value={selectedPotionId}
                    onChange={(e) => setSelectedPotionId(e.target.value)}
                    className="rounded-md border border-purple-600 bg-white px-3 py-2 text-sm dark:bg-stone-900"
                  >
                    <option value="">No potion</option>
                    {ownedPotions.map((potion) => (
                      <option key={potion.itemId} value={potion.itemId}>
                        {potion.name} (×{potion.quantity})
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

              <button
                type="button"
                onClick={handleStart}
                disabled={isSubmitting || !selectedPetId}
                className="self-start rounded-md bg-green-800 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60 dark:bg-green-200 dark:text-green-950 dark:hover:bg-green-300"
              >
                {isSubmitting ? "Starting…" : "Start expedition"}
              </button>
            </div>
          )}
        </section>
      ) : (
        <p className="text-sm text-stone-500">
          Hover an area to preview it, then click to see details and send a pet.
        </p>
      )}

      {claimTarget ? (
        <ClaimRewardModal
          expeditionId={claimTarget.expeditionId}
          zoneName={claimTarget.zoneName}
          onClose={() => setClaimTarget(null)}
        />
      ) : null}
    </div>
  );
}
