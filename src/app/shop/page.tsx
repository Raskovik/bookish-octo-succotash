import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BuyShopItemButton } from "@/components/buy-shop-item-button";
import { CurrencyIcon } from "@/components/currency-icon";
import type { ItemRow, ShopItem } from "@/lib/supabase/types";

type ShopItemRow = Pick<ItemRow, "id" | "name" | "image_url" | "rarity" | "type" | "shop_price">;

export default async function ShopPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: shopItemsData }, { data: userRow }, { data: inventoryData }] = await Promise.all([
    supabase
      .from("items")
      .select("id, name, image_url, rarity, type, shop_price")
      .not("shop_price", "is", null)
      .eq("is_active", true)
      .order("type")
      .order("name"),
    supabase.from("users").select("coin_balance").eq("id", user.id).single(),
    supabase.from("user_inventory").select("item_id, quantity").eq("user_id", user.id),
  ]);

  const coinBalance = userRow?.coin_balance ?? 0;
  const ownedByItemId = new Map((inventoryData ?? []).map((row) => [row.item_id, row.quantity]));

  const shopItems: ShopItem[] = ((shopItemsData ?? []) as ShopItemRow[]).map((item) => ({
    id: item.id,
    name: item.name,
    image_url: item.image_url,
    rarity: item.rarity,
    type: item.type,
    shopPrice: item.shop_price!,
    quantityOwned: ownedByItemId.get(item.id) ?? 0,
  }));

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Shop</h1>
          <p className="text-sm text-stone-500">Spend your coins on seeds to plant in your garden.</p>
        </div>
        <p className="whitespace-nowrap rounded-md border border-green-300 bg-white/80 px-3 py-1.5 text-sm font-medium dark:border-stone-700 dark:bg-stone-900/80">
          <CurrencyIcon kind="coin" /> {coinBalance}
        </p>
      </div>

      {shopItems.length === 0 ? (
        <p className="text-sm text-stone-500 italic">Nothing for sale right now — check back later.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {shopItems.map((item) => (
            <li
              key={item.id}
              className="flex flex-col items-center gap-2 rounded-lg border border-green-200 p-3 text-center dark:border-stone-800"
            >
              {item.image_url ? (
                <Image
                  src={item.image_url}
                  alt={item.name}
                  width={80}
                  height={80}
                  className="h-20 w-20 rounded border-2 border-green-600"
                />
              ) : (
                <div className="h-20 w-20 rounded bg-green-200 dark:bg-stone-800" />
              )}
              <p className="text-sm font-medium">{item.name}</p>
              <p className="text-xs capitalize text-stone-500">
                {item.type} · {item.rarity}
              </p>
              {item.quantityOwned > 0 ? (
                <p className="text-xs text-stone-500">You have {item.quantityOwned}</p>
              ) : null}
              <BuyShopItemButton
                userId={user.id}
                itemId={item.id}
                price={item.shopPrice}
                canAfford={coinBalance >= item.shopPrice}
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
