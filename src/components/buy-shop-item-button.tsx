"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CurrencyIcon } from "@/components/currency-icon";

// Same client-RPC-then-refresh shape as ExpandGardenButton/ForTradeToggle —
// buy_shop_item() re-derives and enforces the real price/balance
// server-side, this button's price display is just for the player.
export function BuyShopItemButton({
  userId,
  itemId,
  price,
  canAfford,
}: {
  userId: string;
  itemId: string;
  price: number;
  canAfford: boolean;
}) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setIsPending(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.rpc("buy_shop_item", {
      p_user_id: userId,
      p_item_id: itemId,
      p_quantity: 1,
    });

    setIsPending(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.refresh();
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending || !canAfford}
        className="w-full rounded-md bg-green-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 dark:bg-green-200 dark:text-green-950 dark:hover:bg-green-300"
      >
        {isPending ? (
          "Buying…"
        ) : (
          <>
            Buy — <CurrencyIcon kind="coin" /> {price}
          </>
        )}
      </button>
      {!canAfford ? <p className="text-xs text-stone-500">Not enough coins.</p> : null}
      {error ? <p className="text-xs text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}
