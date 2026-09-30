import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TRADING_ENABLED } from "@/lib/feature-flags";
import { loadTrades } from "../load-trades";
import { TradeSideSummary } from "./trade-side-summary";
import { RespondForm } from "./respond-form";
import { CancelTradeButton } from "./cancel-trade-button";
import type { ItemWithQuantity, PetWithSpecies } from "@/lib/supabase/types";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  completed: "Completed",
  declined: "Declined",
  cancelled: "Cancelled",
};

export default async function TradeDetailPage(props: PageProps<"/trades/[id]">) {
  if (!TRADING_ENABLED) {
    notFound();
  }

  const { id } = await props.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [trade] = await loadTrades(supabase, [id]);

  if (!trade || (trade.initiatorId !== user.id && trade.recipientId !== user.id)) {
    notFound();
  }

  const isInitiator = trade.initiatorId === user.id;
  const isRecipient = trade.recipientId === user.id;
  const counterpartName = isInitiator ? trade.recipientName : trade.initiatorName;
  const isPending = trade.status === "pending";

  let pets: PetWithSpecies[] = [];
  let inventory: ItemWithQuantity[] = [];
  let coinBalance = 0;
  let gemBalance = 0;

  if (isRecipient && isPending) {
    const [{ data: petsData }, { data: inventoryData }, { data: profile }] = await Promise.all([
      supabase
        .from("pets")
        .select(
          "id, rarity, color_variant, folder_id, custom_name, is_for_trade, created_at, species(name, image_url)",
        )
        .eq("owner_id", user.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("user_inventory")
        .select("quantity, is_for_trade, item:items(id, name, image_url, rarity, type)")
        .eq("user_id", user.id)
        .gt("quantity", 0)
        .order("item_id", { ascending: true }),
      supabase.from("users").select("coin_balance, gem_balance").eq("id", user.id).single(),
    ]);

    pets = (petsData ?? []) as unknown as PetWithSpecies[];
    inventory = (inventoryData ?? []) as unknown as ItemWithQuantity[];
    coinBalance = profile?.coin_balance ?? 0;
    gemBalance = profile?.gem_balance ?? 0;
  }

  const recipientHeading = isPending
    ? isRecipient
      ? "What they're asking you for"
      : `What you're asking ${trade.recipientName} for`
    : isRecipient
      ? "You gave"
      : `${trade.recipientName} gave`;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Trade with {counterpartName}
        </h1>
        <p className="text-sm text-stone-500">
          {STATUS_LABELS[trade.status] ?? trade.status} · proposed{" "}
          {new Date(trade.created_at).toLocaleDateString()}
        </p>
      </div>

      {trade.note ? (
        <p className="rounded-lg border border-green-200 p-3 text-sm italic dark:border-stone-800">
          &ldquo;{trade.note}&rdquo;
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <TradeSideSummary
          trade={trade}
          side="initiator"
          heading={isInitiator ? "You're offering" : `${trade.initiatorName} is offering`}
        />
        <TradeSideSummary trade={trade} side="recipient" heading={recipientHeading} />
      </div>

      {isPending && isRecipient ? (
        <RespondForm
          userId={user.id}
          tradeId={trade.id}
          pets={pets}
          inventory={inventory}
          coinBalance={coinBalance}
          gemBalance={gemBalance}
          requestedPetIds={trade.pets.filter((p) => p.side === "recipient").map((p) => p.petId)}
          requestedItemQuantities={Object.fromEntries(
            trade.items.filter((i) => i.side === "recipient").map((i) => [i.itemId, i.quantity]),
          )}
          requestedCoins={trade.recipient_coins}
          requestedGems={trade.recipient_gems}
        />
      ) : null}

      {isPending && isInitiator ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-stone-500">
            Waiting for {trade.recipientName} to respond.
          </p>
          <CancelTradeButton userId={user.id} tradeId={trade.id} />
        </div>
      ) : null}
    </main>
  );
}
