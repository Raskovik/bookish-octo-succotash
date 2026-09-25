"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CurrencyIcon } from "@/components/currency-icon";

export function ExpandDenButton({
  userId,
  cost,
  canAfford,
}: {
  userId: string;
  cost: number;
  canAfford: boolean;
}) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setIsPending(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.rpc("expand_den", { p_user_id: userId });

    setIsPending(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.refresh();
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending || !canAfford}
        className="self-start rounded-md border border-green-300 px-4 py-2 text-sm hover:bg-green-100 disabled:opacity-50 dark:border-stone-700 dark:hover:bg-stone-900"
      >
        {isPending ? (
          "Expanding…"
        ) : (
          <>
            Expand den (+25 slots) — <CurrencyIcon kind="coin" /> {cost}
          </>
        )}
      </button>
      {!canAfford ? (
        <p className="text-xs text-stone-500">Not enough coins for the next expansion yet.</p>
      ) : null}
      {error ? <p className="text-xs text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}
