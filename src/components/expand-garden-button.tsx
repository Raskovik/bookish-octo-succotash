"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CurrencyIcon } from "@/components/currency-icon";

// Same shape as ExpandDenButton — an RPC call + router.refresh(), the
// cost shown here is display-only (expand_garden() re-derives and
// enforces the real cost server-side).
export function ExpandGardenButton({
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
    const { error } = await supabase.rpc("expand_garden", { p_user_id: userId });

    setIsPending(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.refresh();
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending || !canAfford}
        className="rounded-md border border-green-300 bg-white/80 px-4 py-2 text-sm font-medium hover:bg-green-100 disabled:opacity-50 dark:border-stone-700 dark:bg-stone-900/80 dark:hover:bg-stone-800"
      >
        {isPending ? (
          "Expanding…"
        ) : (
          <>
            Unlock row — <CurrencyIcon kind="coin" /> {cost}
          </>
        )}
      </button>
      {!canAfford ? <p className="text-xs text-stone-500">Not enough coins yet.</p> : null}
      {error ? <p className="text-xs text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}
