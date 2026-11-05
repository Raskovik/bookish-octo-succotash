import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MarketplaceItemsPane, type ItemListingRow } from "./items-pane";
import { MarketplacePetsPane, type PetListingRow } from "./pets-pane";
import { statTier } from "@/lib/pet-combat";
import type { ItemType } from "@/lib/supabase/types";

const PAGE_SIZE = 24;
// Fetch cap for sorts that can't be expressed as a single ORDER BY on
// marketplace_listings itself (price-per-item, or anything living on the
// joined items/pets row) — paginate those in JS instead of at the
// database level. Plenty for this game's scale; see README notes on
// sort below.
const CLIENT_SORT_FETCH_CAP = 500;

const ITEM_CATEGORIES: { value: string; label: string; type: ItemType }[] = [
  { value: "Ingredients", label: "Ingredients", type: "ingredient" },
  { value: "Potions", label: "Potions", type: "potion" },
  { value: "Cosmetics", label: "Cosmetics", type: "cosmetic" },
];

const ITEM_SORTS = ["new", "low", "high", "each", "left", "name"] as const;
const PET_SORTS = ["new", "low", "high", "left", "level", "str", "spd", "def"] as const;
type ItemSort = (typeof ITEM_SORTS)[number];
type PetSort = (typeof PET_SORTS)[number];

function isItemSort(v: string): v is ItemSort {
  return (ITEM_SORTS as readonly string[]).includes(v);
}
function isPetSort(v: string): v is PetSort {
  return (PET_SORTS as readonly string[]).includes(v);
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// A min/max price means "either currency's price falls in range" unless
// a currency filter narrows it to one — a gems-only listing shouldn't
// vanish just because someone typed a price filter with coins in mind.
// Built as a SINGLE combined .or() filter (nesting and()/or() when both
// min and max are set) rather than two separate .or() calls: PostgREST
// query params aren't merged when the same key (`or`) appears twice —
// chaining .or().or() silently drops one of the two conditions instead
// of ANDing them, which is exactly what broke this filter the first
// time around.
function buildPriceOrFilter(
  cur: "coin" | "gem" | "",
  hasMin: boolean,
  minPrice: number,
  hasMax: boolean,
  maxPrice: number,
): string | null {
  const cols = cur === "coin" ? ["price_coins"] : cur === "gem" ? ["price_gems"] : ["price_coins", "price_gems"];
  if (hasMin && hasMax) {
    return cols.map((c) => `and(${c}.gte.${minPrice},${c}.lte.${maxPrice})`).join(",");
  }
  if (hasMin) {
    return cols.map((c) => `${c}.gte.${minPrice}`).join(",");
  }
  if (hasMax) {
    return cols.map((c) => `${c}.lte.${maxPrice}`).join(",");
  }
  return null;
}

function timeLeftLabel(expiresAt: string): { label: string; soon: boolean } {
  const msLeft = new Date(expiresAt).getTime() - Date.now();
  if (msLeft <= 0) return { label: "Expiring…", soon: true };
  const hours = Math.ceil(msLeft / (60 * 60 * 1000));
  if (hours < 24) return { label: `${hours} hour${hours === 1 ? "" : "s"} left`, soon: true };
  const days = Math.ceil(hours / 24);
  return { label: `${days} day${days === 1 ? "" : "s"} left`, soon: false };
}

export default async function MarketplacePage(props: PageProps<"/marketplace">) {
  const searchParams = await props.searchParams;
  const tab = first(searchParams.tab) === "pets" ? "pets" : "items";
  const q = (first(searchParams.q) ?? "").trim();
  const catParam = first(searchParams.cat) ?? "";
  const cat = ITEM_CATEGORIES.find((c) => c.value === catParam) ?? null;
  const curParam = first(searchParams.cur);
  const cur = curParam === "coin" || curParam === "gem" ? curParam : "";
  const minPrice = Number(first(searchParams.min) ?? "");
  const maxPrice = Number(first(searchParams.max) ?? "");
  const sortParam = first(searchParams.sort) ?? "new";
  const itemSort: ItemSort = isItemSort(sortParam) ? sortParam : "new";
  const petSort: PetSort = isPetSort(sortParam) ? sortParam : "new";
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

  const hasMin = Number.isFinite(minPrice) && minPrice > 0;
  const hasMax = Number.isFinite(maxPrice) && maxPrice > 0;
  const priceOrFilter = buildPriceOrFilter(cur, hasMin, minPrice, hasMax, maxPrice);

  let itemRows: ItemListingRow[] = [];
  let petRows: PetListingRow[] = [];
  let totalCount = 0;
  let itemsTabCount = 0;
  let petsTabCount = 0;

  if (tab === "items") {
    let query = supabase
      .from("marketplace_listings")
      .select(
        "id, price_coins, price_gems, expires_at, seller_id, item_quantity, items!inner(id, name, image_url, rarity, type)",
        { count: "exact" },
      )
      .eq("listing_type", "item")
      .eq("status", "active");

    if (cat) query = query.eq("items.type", cat.type);
    if (q.length > 0) query = query.ilike("items.name", `%${q}%`);
    if (cur) query = query.not(cur === "coin" ? "price_coins" : "price_gems", "is", null);
    if (priceOrFilter) query = query.or(priceOrFilter);

    const needsClientSort = itemSort === "each" || itemSort === "name";
    if (itemSort === "left") {
      query = query.order("expires_at", { ascending: true });
    } else if (itemSort === "low") {
      query = query.order("price_coins", { ascending: true }).order("price_gems", { ascending: true });
    } else if (itemSort === "high") {
      query = query
        .order("price_coins", { ascending: false, nullsFirst: false })
        .order("price_gems", { ascending: false });
    } else if (!needsClientSort) {
      query = query.order("created_at", { ascending: false });
    } else {
      query = query.order("created_at", { ascending: false }).limit(CLIENT_SORT_FETCH_CAP);
    }

    if (!needsClientSort) {
      query = query.range(offset, offset + PAGE_SIZE - 1);
    }

    const { data, count } = await query;
    type RawItemRow = {
      id: string;
      price_coins: number | null;
      price_gems: number | null;
      expires_at: string;
      seller_id: string;
      item_quantity: number | null;
      items: { id: string; name: string; image_url: string | null; rarity: string; type: ItemType } | null;
    };
    const raw = (data ?? []) as unknown as RawItemRow[];
    let mapped: ItemListingRow[] = raw
      .filter((r) => r.items)
      .map((r) => ({
        id: r.id,
        name: r.items!.name,
        imageUrl: r.items!.image_url,
        category: ITEM_CATEGORIES.find((c) => c.type === r.items!.type)?.label ?? r.items!.type,
        quantity: r.item_quantity ?? 1,
        priceCoins: r.price_coins,
        priceGems: r.price_gems,
        expiresAt: r.expires_at,
        sellerId: r.seller_id,
        sellerDisplayId: 0,
        sellerName: "",
        isMine: r.seller_id === user.id,
      }));

    if (needsClientSort) {
      if (itemSort === "each") {
        mapped.sort((a, b) => {
          const aGem = a.priceCoins === null;
          const bGem = b.priceCoins === null;
          if (aGem !== bGem) return aGem ? 1 : -1;
          const aEach = (a.priceCoins ?? a.priceGems ?? 0) / a.quantity;
          const bEach = (b.priceCoins ?? b.priceGems ?? 0) / b.quantity;
          return aEach - bEach;
        });
      } else {
        mapped.sort((a, b) => a.name.localeCompare(b.name));
      }
      totalCount = mapped.length;
      mapped = mapped.slice(offset, offset + PAGE_SIZE);
    } else {
      totalCount = count ?? 0;
    }
    itemRows = mapped;
  } else {
    let query = supabase
      .from("marketplace_listings")
      .select(
        "id, price_coins, price_gems, expires_at, seller_id, pet_species_name, pet_species_image_url, pet_custom_name, pets!inner(level, roll_strength, roll_speed, roll_defence)",
        { count: "exact" },
      )
      .eq("listing_type", "pet")
      .eq("status", "active");

    if (q.length > 0) query = query.or(`pet_species_name.ilike.%${q}%,pet_custom_name.ilike.%${q}%`);
    if (cur) query = query.not(cur === "coin" ? "price_coins" : "price_gems", "is", null);
    if (priceOrFilter) query = query.or(priceOrFilter);

    const needsClientSort = petSort === "level" || petSort === "str" || petSort === "spd" || petSort === "def";
    if (petSort === "left") {
      query = query.order("expires_at", { ascending: true });
    } else if (petSort === "low") {
      query = query.order("price_coins", { ascending: true }).order("price_gems", { ascending: true });
    } else if (petSort === "high") {
      query = query
        .order("price_coins", { ascending: false, nullsFirst: false })
        .order("price_gems", { ascending: false });
    } else if (!needsClientSort) {
      query = query.order("created_at", { ascending: false });
    } else {
      query = query.order("created_at", { ascending: false }).limit(CLIENT_SORT_FETCH_CAP);
    }

    if (!needsClientSort) {
      query = query.range(offset, offset + PAGE_SIZE - 1);
    }

    const { data, count } = await query;
    type RawPetRow = {
      id: string;
      price_coins: number | null;
      price_gems: number | null;
      expires_at: string;
      seller_id: string;
      pet_species_name: string | null;
      pet_species_image_url: string | null;
      pet_custom_name: string | null;
      pets: { level: number; roll_strength: number; roll_speed: number; roll_defence: number } | null;
    };
    const raw = (data ?? []) as unknown as RawPetRow[];
    let mapped: PetListingRow[] = raw
      .filter((r) => r.pets)
      .map((r) => {
        const pet = r.pets!;
        const allTen = pet.roll_strength >= 10 && pet.roll_speed >= 10 && pet.roll_defence >= 10;
        return {
          id: r.id,
          name: r.pet_custom_name ?? r.pet_species_name ?? "Pet",
          speciesName: r.pet_species_name ?? "",
          imageUrl: r.pet_species_image_url,
          level: pet.level,
          strength: pet.roll_strength,
          speed: pet.roll_speed,
          defence: pet.roll_defence,
          strTier: statTier(pet.roll_strength, allTen),
          spdTier: statTier(pet.roll_speed, allTen),
          defTier: statTier(pet.roll_defence, allTen),
          priceCoins: r.price_coins,
          priceGems: r.price_gems,
          expiresAt: r.expires_at,
          sellerId: r.seller_id,
          sellerDisplayId: 0,
          sellerName: "",
          isMine: r.seller_id === user.id,
        };
      });

    if (needsClientSort) {
      const key = petSort === "level" ? "level" : petSort === "str" ? "strength" : petSort === "spd" ? "speed" : "defence";
      mapped.sort((a, b) => b[key] - a[key]);
      totalCount = mapped.length;
      mapped = mapped.slice(offset, offset + PAGE_SIZE);
    } else {
      totalCount = count ?? 0;
    }
    petRows = mapped;
  }

  // Tab counts (for the "Items 14"/"Pets 8" badges) — cheap head-only
  // counts, independent of whichever tab's full rows were just fetched.
  const [{ count: itemsCount }, { count: petsCount }] = await Promise.all([
    supabase
      .from("marketplace_listings")
      .select("id", { count: "exact", head: true })
      .eq("listing_type", "item")
      .eq("status", "active"),
    supabase
      .from("marketplace_listings")
      .select("id", { count: "exact", head: true })
      .eq("listing_type", "pet")
      .eq("status", "active"),
  ]);
  itemsTabCount = itemsCount ?? 0;
  petsTabCount = petsCount ?? 0;

  const sellerIds = [...new Set([...itemRows.map((r) => r.sellerId), ...petRows.map((r) => r.sellerId)])];
  const { data: profiles } = await supabase
    .from("user_profiles")
    .select("id, display_id, display_name")
    .in("id", sellerIds.length > 0 ? sellerIds : ["00000000-0000-0000-0000-000000000000"]);
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  for (const row of itemRows) {
    const p = profileById.get(row.sellerId);
    row.sellerDisplayId = p?.display_id ?? 0;
    row.sellerName = p?.display_name ?? "Unknown";
  }
  for (const row of petRows) {
    const p = profileById.get(row.sellerId);
    row.sellerDisplayId = p?.display_id ?? 0;
    row.sellerName = p?.display_name ?? "Unknown";
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const qs = (overrides: Record<string, string | number>) => {
    const params = new URLSearchParams();
    params.set("tab", tab);
    if (q) params.set("q", q);
    if (cat) params.set("cat", cat.value);
    if (cur) params.set("cur", cur);
    if (hasMin) params.set("min", String(minPrice));
    if (hasMax) params.set("max", String(maxPrice));
    const sort = tab === "items" ? itemSort : petSort;
    if (sort !== "new") params.set("sort", sort);
    params.set("page", String(page));
    for (const [k, v] of Object.entries(overrides)) {
      if (v === "") params.delete(k);
      else params.set(k, String(v));
    }
    return `?${params.toString()}`;
  };

  return (
    <main id="main">
      <div className="sheet">
        <div className="panel">
          <div className="mk-top">
            <div>
              <h1 className="mk-h1">Marketplace</h1>
              <p className="mk-sub">
                Buy pets and items other players have listed.{" "}
                <span className="mk-wal">
                  <span className="coin" aria-hidden="true" />
                  <b>{coinBalance}</b>
                </span>{" "}
                <span className="mk-wal">
                  <span className="coin gem" aria-hidden="true" />
                  <b>{gemBalance}</b>
                </span>
              </p>
            </div>
            <div className="mk-act">
              <Link className="btn btn-sm btn-cream" href="/marketplace/listings">
                My listings
              </Link>
              <Link className="btn btn-sm btn-orange" href="/marketplace/sell">
                Sell something
              </Link>
            </div>
          </div>

          <div className="sh-ftabs mk-tabs" role="tablist" aria-label="Marketplace sections">
            <Link
              href={qs({ tab: "items", page: 1 })}
              className="sh-ft"
              role="tab"
              aria-selected={tab === "items"}
            >
              Items<em>{itemsTabCount}</em>
            </Link>
            <Link href={qs({ tab: "pets", page: 1 })} className="sh-ft" role="tab" aria-selected={tab === "pets"}>
              Pets<em>{petsTabCount}</em>
            </Link>
          </div>

          <div className="sh-fpage mk-panes">
            {tab === "items" ? (
              <MarketplaceItemsPane
                rows={itemRows}
                userId={user.id}
                coinBalance={coinBalance}
                gemBalance={gemBalance}
                categories={ITEM_CATEGORIES}
                filters={{ q, cat: cat?.value ?? "", cur, min: hasMin ? minPrice : "", max: hasMax ? maxPrice : "", sort: itemSort }}
                page={page}
                totalPages={totalPages}
                pageHref={(p) => qs({ page: p })}
                timeLeftLabel={timeLeftLabel}
              />
            ) : (
              <MarketplacePetsPane
                rows={petRows}
                userId={user.id}
                coinBalance={coinBalance}
                gemBalance={gemBalance}
                filters={{ q, cur, min: hasMin ? minPrice : "", max: hasMax ? maxPrice : "", sort: petSort }}
                page={page}
                totalPages={totalPages}
                pageHref={(p) => qs({ page: p })}
                timeLeftLabel={timeLeftLabel}
              />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
