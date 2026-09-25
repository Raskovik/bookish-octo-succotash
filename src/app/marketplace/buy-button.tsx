"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CurrencyIcon } from "@/components/currency-icon";
import type { ListingCurrency } from "@/lib/supabase/types";

export function BuyButton({
  userId,
  listingId,
  priceCoins,
  priceGems,
  coinBalance,
  gemBalance,
}: {
  userId: string;
  listingId: string;
  priceCoins: number | null;
  priceGems: number | null;
  coinBalance: number;
  gemBalance: number;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState<ListingCurrency | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleBuy(currency: ListingCurrency) {
    setIsPending(true);
    setMessage(null);

    const supabase = createClient();
    const { data, error } = await supabase.rpc("buy_listing", {
      p_buyer_id: userId,
      p_listing_id: listingId,
      p_currency: currency,
    });

    setIsPending(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    if (data?.status === "unavailable") {
      setMessage(data.reason);
      router.refresh();
      return;
    }

    router.refresh();
  }

  if (message) {
    return <p className="text-xs text-red-600 dark:text-red-400">{message}</p>;
  }

  if (confirming) {
    return (
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => handleBuy(confirming)}
          disabled={isPending}
          className="rounded-md bg-green-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-60 dark:bg-green-200 dark:text-green-950 dark:hover:bg-green-300"
        >
          {isPending ? "Buying…" : "Confirm"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(null)}
          disabled={isPending}
          className="rounded-md border border-green-300 px-3 py-1.5 text-xs hover:bg-green-100 dark:border-stone-700 dark:hover:bg-stone-800"
        >
          Cancel
        </button>
      </div>
    );
  }

  const canAffordCoins = priceCoins !== null && coinBalance >= priceCoins;
  const canAffordGems = priceGems !== null && gemBalance >= priceGems;

  return (
    <div className="flex gap-2">
      {priceCoins !== null ? (
        <button
          type="button"
          onClick={() => setConfirming("coins")}
          disabled={!canAffordCoins}
          title={canAffordCoins ? undefined : "Not enough coins"}
          className="rounded-md bg-green-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-green-200 dark:text-green-950 dark:hover:bg-green-300"
        >
          Buy — <CurrencyIcon kind="coin" /> {priceCoins}
        </button>
      ) : null}
      {priceGems !== null ? (
        <button
          type="button"
          onClick={() => setConfirming("gems")}
          disabled={!canAffordGems}
          title={canAffordGems ? undefined : "Not enough gems"}
          className="rounded-md bg-green-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-green-200 dark:text-green-950 dark:hover:bg-green-300"
        >
          Buy — <CurrencyIcon kind="gem" /> {priceGems}
        </button>
      ) : null}
    </div>
  );
}
