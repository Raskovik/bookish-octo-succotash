import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BuyButton } from "./buy-button";
import { PriceLabel } from "@/components/price-label";
import { CurrencyIcon } from "@/components/currency-icon";
import type { PetRarity } from "@/lib/supabase/types";

const PAGE_SIZE = 24;
const RARITIES: PetRarity[] = ["common", "uncommon", "rare", "epic", "legendary"];

function isRarity(value: string): value is PetRarity {
  return (RARITIES as string[]).includes(value);
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function timeLeftLabel(expiresAt: string): string {
  const msLeft = new Date(expiresAt).getTime() - Date.now();
  if (msLeft <= 0) return "Expiring…";
  const hours = Math.ceil(msLeft / (60 * 60 * 1000));
  if (hours < 24) return `${hours}h left`;
  return `${Math.ceil(hours / 24)}d left`;
}

// A min/max price means "either currency's price falls in range" — a
// gems-only listing shouldn't vanish just because someone typed a price
// filter with coins in mind. Built as a SINGLE combined .or() filter
// (nesting and()/or() when both min and max are set) rather than two
// separate .or() calls: PostgREST query params aren't merged when the
// same key (`or`) appears twice — chaining .or().or() silently drops
// one of the two conditions instead of ANDing them, which is exactly
// what broke this filter the first time around.
function buildPriceOrFilter(
  hasMin: boolean,
  minPrice: number,
  hasMax: boolean,
  maxPrice: number,
): string | null {
  if (hasMin && hasMax) {
    return `and(price_coins.gte.${minPrice},price_coins.lte.${maxPrice}),and(price_gems.gte.${minPrice},price_gems.lte.${maxPrice})`;
  }
  if (hasMin) {
    return `price_coins.gte.${minPrice},price_gems.gte.${minPrice}`;
  }
  if (hasMax) {
    return `price_coins.lte.${maxPrice},price_gems.lte.${maxPrice}`;
  }
  return null;
}

export default async function MarketplacePage(props: PageProps<"/marketplace">) {
  const searchParams = await props.searchParams;
  const tab = first(searchParams.tab) === "items" ? "items" : "pets";
  const q = (first(searchParams.q) ?? "").trim();
  const rarityParam = first(searchParams.rarity);
  const rarity = rarityParam && isRarity(rarityParam) ? rarityParam : null;
  const minPrice = Number(first(searchParams.min) ?? "");
  const maxPrice = Number(first(searchParams.max) ?? "");
  const pageParam = Number(first(searchParams.page) ?? "1");
  const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;
  const offset = (page - 1) * PAGE_SIZE;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await supabase.rpc("resolve_expired_listings");

  const { data: profile } = await supabase
    .from("users")
    .select("coin_balance, gem_balance")
    .eq("id", user.id)
    .single();
  const coinBalance = profile?.coin_balance ?? 0;
  const gemBalance = profile?.gem_balance ?? 0;

  let petRows: {
    id: string;
    price_coins: number | null;
    price_gems: number | null;
    expires_at: string;
    seller_id: string;
    pet_species_name: string | null;
    pet_species_image_url: string | null;
    pet_rarity: PetRarity | null;
    pet_custom_name: string | null;
  }[] = [];
  let itemRows: {
    id: string;
    price_coins: number | null;
    price_gems: number | null;
    expires_at: string;
    seller_id: string;
    item_quantity: number | null;
    items: { name: string; image_url: string | null; rarity: PetRarity; type: string } | null;
  }[] = [];
  let totalCount = 0;

  const hasMin = Number.isFinite(minPrice) && minPrice > 0;
  const hasMax = Number.isFinite(maxPrice) && maxPrice > 0;
  const priceOrFilter = buildPriceOrFilter(hasMin, minPrice, hasMax, maxPrice);

  if (tab === "pets") {
    let query = supabase
      .from("marketplace_listings")
      .select(
        "id, price_coins, price_gems, expires_at, seller_id, pet_species_name, pet_species_image_url, pet_rarity, pet_custom_name",
        { count: "exact" },
      )
      .eq("listing_type", "pet")
      .eq("status", "active");

    if (rarity) query = query.eq("pet_rarity", rarity);
    if (q.length > 0) query = query.ilike("pet_species_name", `%${q}%`);
    if (priceOrFilter) query = query.or(priceOrFilter);

    const { data, count } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    petRows = data ?? [];
    totalCount = count ?? 0;
  } else {
    let query = supabase
      .from("marketplace_listings")
      .select(
        "id, price_coins, price_gems, expires_at, seller_id, item_quantity, items!inner(name, image_url, rarity, type)",
        { count: "exact" },
      )
      .eq("listing_type", "item")
      .eq("status", "active");

    if (rarity) query = query.eq("items.rarity", rarity);
    if (q.length > 0) query = query.ilike("items.name", `%${q}%`);
    if (priceOrFilter) query = query.or(priceOrFilter);

    const { data, count } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    itemRows = (data ?? []) as unknown as typeof itemRows;
    totalCount = count ?? 0;
  }

  const sellerIds = [...new Set([...petRows.map((p) => p.seller_id), ...itemRows.map((i) => i.seller_id)])];
  const { data: profiles } = await supabase
    .from("user_profiles")
    .select("id, display_name")
    .in("id", sellerIds.length > 0 ? sellerIds : ["00000000-0000-0000-0000-000000000000"]);
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const qs = (overrides: Record<string, string | number>) => {
    const params = new URLSearchParams();
    params.set("tab", tab);
    if (q) params.set("q", q);
    if (rarity) params.set("rarity", rarity);
    if (Number.isFinite(minPrice) && minPrice > 0) params.set("min", String(minPrice));
    if (Number.isFinite(maxPrice) && maxPrice > 0) params.set("max", String(maxPrice));
    params.set("page", String(page));
    for (const [k, v] of Object.entries(overrides)) {
      if (v === "") params.delete(k);
      else params.set(k, String(v));
    }
    return `?${params.toString()}`;
  };

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Marketplace</h1>
          <p className="text-sm text-stone-500">
            Buy pets and items other players have listed. <CurrencyIcon kind="coin" /> {coinBalance} ·{" "}
            <CurrencyIcon kind="gem" /> {gemBalance}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/marketplace/mine"
            className="rounded-md border border-green-300 px-4 py-2 text-sm hover:bg-green-100 dark:border-stone-700 dark:hover:bg-stone-800"
          >
            My listings
          </Link>
          <Link
            href="/marketplace/sell"
            className="rounded-md bg-green-800 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 dark:bg-green-200 dark:text-green-950 dark:hover:bg-green-300"
          >
            Sell something
          </Link>
        </div>
      </div>

      <nav className="flex gap-2 border-b border-green-200 dark:border-stone-800">
        <Link
          href={qs({ tab: "pets", page: 1 })}
          className={`border-b-2 px-3 py-2 text-sm ${
            tab === "pets"
              ? "border-green-800 font-medium dark:border-green-200"
              : "border-transparent text-stone-500 hover:text-stone-900 dark:hover:text-white"
          }`}
        >
          Pets
        </Link>
        <Link
          href={qs({ tab: "items", page: 1 })}
          className={`border-b-2 px-3 py-2 text-sm ${
            tab === "items"
              ? "border-green-800 font-medium dark:border-green-200"
              : "border-transparent text-stone-500 hover:text-stone-900 dark:hover:text-white"
          }`}
        >
          Items
        </Link>
      </nav>

      <form className="flex flex-wrap gap-2">
        <input type="hidden" name="tab" value={tab} />
        <input
          name="q"
          defaultValue={q}
          placeholder={tab === "pets" ? "Search species…" : "Search items…"}
          className="flex-1 rounded-md border border-green-300 px-3 py-1.5 text-sm dark:border-stone-700 dark:bg-stone-900"
        />
        <select
          name="rarity"
          defaultValue={rarity ?? ""}
          className="rounded-md border border-green-300 px-2 py-1.5 text-sm capitalize dark:border-stone-700 dark:bg-stone-900"
        >
          <option value="">All rarities</option>
          {RARITIES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <input
          name="min"
          type="number"
          min={0}
          defaultValue={Number.isFinite(minPrice) && minPrice > 0 ? minPrice : ""}
          placeholder="Min 🪙"
          className="w-24 rounded-md border border-green-300 px-2 py-1.5 text-sm dark:border-stone-700 dark:bg-stone-900"
        />
        <input
          name="max"
          type="number"
          min={0}
          defaultValue={Number.isFinite(maxPrice) && maxPrice > 0 ? maxPrice : ""}
          placeholder="Max 🪙"
          className="w-24 rounded-md border border-green-300 px-2 py-1.5 text-sm dark:border-stone-700 dark:bg-stone-900"
        />
        <button
          type="submit"
          className="rounded-md border border-green-300 px-3 py-1.5 text-sm hover:bg-green-100 dark:border-stone-700 dark:hover:bg-stone-800"
        >
          Filter
        </button>
      </form>

      {tab === "pets" ? (
        petRows.length === 0 ? (
          <p className="text-sm italic text-stone-500">No pets for sale — try different filters.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {petRows.map((pet) => (
              <li
                key={pet.id}
                className="flex flex-col items-center gap-1.5 rounded-lg border border-green-200 p-3 text-center dark:border-stone-800"
              >
                {pet.pet_species_image_url ? (
                  <Image
                    src={pet.pet_species_image_url}
                    alt={pet.pet_species_name ?? ""}
                    width={72}
                    height={72}
                    className="h-16 w-16 rounded border-2 border-blue-600"
                  />
                ) : (
                  <div className="h-16 w-16 rounded bg-green-200 dark:bg-stone-800" />
                )}
                <p className="text-xs font-medium">{pet.pet_custom_name ?? pet.pet_species_name}</p>
                <p className="text-[10px] capitalize text-stone-500">
                  {pet.pet_species_name} · {pet.pet_rarity}
                </p>
                <p className="text-[10px] text-stone-500">
                  <PriceLabel priceCoins={pet.price_coins} priceGems={pet.price_gems} />
                </p>
                <p className="text-[10px] text-stone-500">
                  by {nameById.get(pet.seller_id) ?? "Unknown"} · {timeLeftLabel(pet.expires_at)}
                </p>
                <BuyButton
                  userId={user.id}
                  listingId={pet.id}
                  priceCoins={pet.price_coins}
                  priceGems={pet.price_gems}
                  coinBalance={coinBalance}
                  gemBalance={gemBalance}
                />
              </li>
            ))}
          </ul>
        )
      ) : itemRows.length === 0 ? (
        <p className="text-sm italic text-stone-500">No items for sale — try different filters.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {itemRows.map((row) => (
            <li
              key={row.id}
              className="flex flex-col items-center gap-1.5 rounded-lg border border-green-200 p-3 text-center dark:border-stone-800"
            >
              {row.items?.image_url ? (
                <Image
                  src={row.items.image_url}
                  alt={row.items.name}
                  width={56}
                  height={56}
                  className="h-14 w-14 rounded border-2 border-green-600"
                />
              ) : (
                <div className="h-14 w-14 rounded bg-green-200 dark:bg-stone-800" />
              )}
              <p className="text-xs font-medium">{row.items?.name}</p>
              <p className="text-[10px] text-stone-500">×{row.item_quantity}</p>
              <p className="text-[10px] text-stone-500">
                <PriceLabel priceCoins={row.price_coins} priceGems={row.price_gems} />
              </p>
              <p className="text-[10px] text-stone-500">
                by {nameById.get(row.seller_id) ?? "Unknown"} · {timeLeftLabel(row.expires_at)}
              </p>
              <BuyButton
                userId={user.id}
                listingId={row.id}
                priceCoins={row.price_coins}
                priceGems={row.price_gems}
                coinBalance={coinBalance}
                gemBalance={gemBalance}
              />
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-center gap-4 text-sm">
          <Link
            href={qs({ page: page - 1 })}
            aria-disabled={page <= 1}
            className={`rounded-md border border-green-300 px-3 py-1.5 dark:border-stone-700 ${
              page <= 1 ? "pointer-events-none opacity-40" : "hover:bg-green-100 dark:hover:bg-stone-800"
            }`}
          >
            Previous
          </Link>
          <span className="text-stone-500">
            Page {page} of {totalPages}
          </span>
          <Link
            href={qs({ page: page + 1 })}
            aria-disabled={page >= totalPages}
            className={`rounded-md border border-green-300 px-3 py-1.5 dark:border-stone-700 ${
              page >= totalPages
                ? "pointer-events-none opacity-40"
                : "hover:bg-green-100 dark:hover:bg-stone-800"
            }`}
          >
            Next
          </Link>
        </div>
      ) : null}
    </main>
  );
}
