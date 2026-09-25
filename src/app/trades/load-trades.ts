import type { createClient } from "@/lib/supabase/server";
import { petImageUrl, petTypeName } from "@/lib/pet-display";
import type { TradeItemLine, TradePetLine, TradeWithParticipants } from "@/lib/supabase/types";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

// Shared by /trades (the inbox list) and /trades/[id] (one trade's detail
// page) — both need the same participant-name + pet/item detail
// resolution, just over a different set of trade ids. `users` only lets a
// player see their OWN row (see 0001), so participant names are resolved
// via the public `user_profiles` view instead of embedding `users`
// directly, which RLS would otherwise strip out for the other
// participant.
export async function loadTrades(
  supabase: SupabaseClient,
  tradeIds: string[],
): Promise<TradeWithParticipants[]> {
  if (tradeIds.length === 0) {
    return [];
  }

  const { data: tradesData } = await supabase
    .from("trades")
    .select(
      "id, status, note, initiator_id, recipient_id, initiator_coins, initiator_gems, recipient_coins, recipient_gems, created_at, resolved_at",
    )
    .in("id", tradeIds)
    .order("created_at", { ascending: false });

  const trades = tradesData ?? [];
  if (trades.length === 0) {
    return [];
  }

  const participantIds = [
    ...new Set(trades.flatMap((t) => [t.initiator_id, t.recipient_id])),
  ];

  const [{ data: profilesData }, { data: tradePetsData }, { data: tradeItemsData }] =
    await Promise.all([
      supabase.from("user_profiles").select("id, display_name").in("id", participantIds),
      supabase
        .from("trade_pets")
        .select(
          "trade_id, side, pet_id, pets(rarity, custom_name, composited_image_url, species(name, image_url), breed:breeds(name))",
        )
        .in("trade_id", tradeIds),
      supabase
        .from("trade_items")
        .select("trade_id, side, item_id, quantity, items(name, image_url)")
        .in("trade_id", tradeIds),
    ]);

  const nameById = new Map((profilesData ?? []).map((p) => [p.id, p.display_name]));

  const petsByTrade = new Map<string, TradePetLine[]>();
  for (const row of (tradePetsData ?? []) as unknown as {
    trade_id: string;
    side: TradePetLine["side"];
    pet_id: string;
    pets: {
      rarity: TradePetLine["rarity"];
      custom_name: string | null;
      composited_image_url: string | null;
      species: { name: string; image_url: string | null } | null;
      breed: { name: string } | null;
    } | null;
  }[]) {
    const list = petsByTrade.get(row.trade_id) ?? [];
    list.push({
      side: row.side,
      petId: row.pet_id,
      speciesName: row.pets ? petTypeName(row.pets) : "Unknown pet",
      imageUrl: row.pets ? petImageUrl(row.pets) : null,
      rarity: row.pets?.rarity ?? "common",
      customName: row.pets?.custom_name ?? null,
    });
    petsByTrade.set(row.trade_id, list);
  }

  const itemsByTrade = new Map<string, TradeItemLine[]>();
  for (const row of (tradeItemsData ?? []) as unknown as {
    trade_id: string;
    side: TradeItemLine["side"];
    item_id: string;
    quantity: number;
    items: { name: string; image_url: string | null } | null;
  }[]) {
    const list = itemsByTrade.get(row.trade_id) ?? [];
    list.push({
      side: row.side,
      itemId: row.item_id,
      name: row.items?.name ?? "Unknown item",
      imageUrl: row.items?.image_url ?? null,
      quantity: row.quantity,
    });
    itemsByTrade.set(row.trade_id, list);
  }

  return trades.map((trade) => ({
    id: trade.id,
    status: trade.status,
    note: trade.note,
    initiator_coins: trade.initiator_coins,
    initiator_gems: trade.initiator_gems,
    recipient_coins: trade.recipient_coins,
    recipient_gems: trade.recipient_gems,
    created_at: trade.created_at,
    resolved_at: trade.resolved_at,
    initiatorId: trade.initiator_id,
    recipientId: trade.recipient_id,
    initiatorName: nameById.get(trade.initiator_id) ?? "Unknown player",
    recipientName: nameById.get(trade.recipient_id) ?? "Unknown player",
    pets: petsByTrade.get(trade.id) ?? [],
    items: itemsByTrade.get(trade.id) ?? [],
  }));
}
