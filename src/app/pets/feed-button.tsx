"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Utensils } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// Resets the pet's energy decay clock to now() via feed_pet()
// (0046_pet_energy.sql) — free, no cost or cooldown in this first pass.
// Same client-calls-the-RPC-directly pattern as ForTradeToggle/
// PetNameEditor (pets has never had a client UPDATE policy).
export function FeedButton({ userId, petId }: { userId: string; petId: string }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setIsPending(true);
    setError(null);

    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("feed_pet", {
      p_user_id: userId,
      p_pet_id: petId,
    });

    setIsPending(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    router.refresh();
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="inline-flex items-center justify-center gap-1.5 rounded-full bg-green-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Utensils size={14} />
        {isPending ? "Feeding…" : "Feed"}
      </button>
      {error ? <p className="text-xs text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}
