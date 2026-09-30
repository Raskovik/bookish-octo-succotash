"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { ClaimExpeditionResult, ExpeditionRewardReveal } from "@/lib/supabase/types";

/**
 * "What did I get?" popup for a single awaiting_claim expedition. Fetches
 * the reveal itself, on mount, rather than the parent map passing it down
 * — the reward is deliberately not part of the map's initial data load,
 * so it stays a surprise until the player explicitly opens this.
 *
 * Closing without choosing is always safe: the expedition just stays
 * awaiting_claim, and reopening the zone later shows this same popup
 * again — nothing is lost by deferring the decision.
 */
export function ClaimRewardModal({
  expeditionId,
  zoneName,
  onClose,
}: {
  expeditionId: string;
  zoneName: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [reveal, setReveal] = useState<ExpeditionRewardReveal | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bonus, setBonus] = useState<ClaimExpeditionResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    supabase
      .from("expeditions")
      .select(
        "pending_species_id, pending_item_id, species(name, image_url, rarity), items!expeditions_pending_item_id_fkey(name, image_url, rarity)",
      )
      .eq("id", expeditionId)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setLoadError("Couldn't load your reward. Please try again.");
          return;
        }
        setReveal(data as unknown as ExpeditionRewardReveal);
      });

    return () => {
      cancelled = true;
    };
  }, [expeditionId]);

  async function handleChoice(keep: boolean) {
    setIsSubmitting(true);
    setActionError(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setActionError("Your session expired — please sign in again.");
      setIsSubmitting(false);
      return;
    }

    const { data, error } = await supabase.rpc("claim_expedition_reward", {
      p_user_id: user.id,
      p_expedition_id: expeditionId,
      p_keep: keep,
    });

    setIsSubmitting(false);

    if (error) {
      setActionError(error.message);
      return;
    }

    router.refresh();

    const result = data as ClaimExpeditionResult | null;
    if (result?.bonus_kind) {
      // Pause on a "you also got a bonus!" screen instead of closing
      // immediately — router.refresh() has already run, so the
      // underlying page data is current by the time they dismiss this.
      setBonus(result);
      return;
    }

    onClose();
  }

  if (bonus?.bonus_kind) {
    const borderColor = bonus.bonus_kind === "pet" ? "border-blue-600" : "border-green-600";
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Bonus reward"
      >
        <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-lg bg-white p-6 text-center dark:bg-stone-900">
          <p className="text-lg font-semibold tracking-tight">🎉 Double reward!</p>
          <p className="text-sm text-stone-500">You also got a bonus:</p>
          {bonus.bonus_image_url ? (
            <Image
              src={bonus.bonus_image_url}
              alt={bonus.bonus_name ?? ""}
              width={96}
              height={96}
              className={`h-24 w-24 rounded border-2 ${borderColor}`}
            />
          ) : (
            <div className="h-24 w-24 rounded bg-green-200 dark:bg-stone-800" />
          )}
          <p className="font-medium">{bonus.bonus_name}</p>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-md bg-green-800 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 dark:bg-green-200 dark:text-green-950 dark:hover:bg-green-300"
          >
            Nice!
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Expedition reward"
    >
      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-lg bg-white p-6 text-center dark:bg-stone-900">
        <p className="text-sm text-stone-500">Your pet has returned from {zoneName}!</p>

        {loadError ? (
          <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
        ) : !reveal ? (
          <p className="text-sm text-stone-500">Opening…</p>
        ) : reveal.species ? (
          <>
            <h2 className="text-lg font-semibold tracking-tight">You found a pet:</h2>
            {reveal.species.image_url ? (
              <Image
                src={reveal.species.image_url}
                alt={reveal.species.name}
                width={112}
                height={112}
                className="h-28 w-28 rounded border-2 border-blue-600"
              />
            ) : (
              <div className="h-28 w-28 rounded bg-green-200 dark:bg-stone-800" />
            )}
            <p className="font-medium">{reveal.species.name}</p>
            <p className="text-xs capitalize text-stone-500">{reveal.species.rarity}</p>
          </>
        ) : reveal.items ? (
          <>
            <h2 className="text-lg font-semibold tracking-tight">You found an item:</h2>
            {reveal.items.image_url ? (
              <Image
                src={reveal.items.image_url}
                alt={reveal.items.name}
                width={112}
                height={112}
                className="h-28 w-28 rounded border-2 border-green-600"
              />
            ) : (
              <div className="h-28 w-28 rounded bg-green-200 dark:bg-stone-800" />
            )}
            <p className="font-medium">{reveal.items.name}</p>
            <p className="text-xs capitalize text-stone-500">{reveal.items.rarity}</p>
          </>
        ) : (
          <p className="text-sm text-stone-500">
            Nothing this time — your pet came back empty-handed.
          </p>
        )}

        {actionError ? (
          <p className="text-sm text-red-600 dark:text-red-400">{actionError}</p>
        ) : null}

        <div className="flex w-full gap-3">
          {reveal?.species || reveal?.items ? (
            <>
              <button
                type="button"
                onClick={() => handleChoice(true)}
                disabled={isSubmitting}
                className="flex-1 rounded-md bg-green-800 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60 dark:bg-green-200 dark:text-green-950 dark:hover:bg-green-300"
              >
                {isSubmitting ? "…" : "Keep it"}
              </button>
              <button
                type="button"
                onClick={() => handleChoice(false)}
                disabled={isSubmitting}
                className="flex-1 rounded-md border border-green-300 px-4 py-2 text-sm hover:bg-green-100 disabled:opacity-60 dark:border-stone-700 dark:hover:bg-stone-800"
              >
                {isSubmitting ? "…" : "Send it away"}
              </button>
            </>
          ) : reveal ? (
            <button
              type="button"
              onClick={() => handleChoice(false)}
              disabled={isSubmitting}
              className="flex-1 rounded-md bg-green-800 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60 dark:bg-green-200 dark:text-green-950 dark:hover:bg-green-300"
            >
              {isSubmitting ? "…" : "Continue"}
            </button>
          ) : null}
        </div>

        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="text-sm text-stone-500 hover:underline disabled:opacity-60"
        >
          Close for now
        </button>
      </div>
    </div>
  );
}
