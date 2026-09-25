import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { TRADING_ENABLED } from "@/lib/feature-flags";
import { createClient } from "@/lib/supabase/server";
import { petImageUrl, petTypeName } from "@/lib/pet-display";
import type { PetRarity } from "@/lib/supabase/types";

const PAGE_SIZE = 24;
const RARITIES: PetRarity[] = ["common", "uncommon", "rare", "epic", "legendary"];

function isRarity(value: string): value is PetRarity {
  return (RARITIES as string[]).includes(value);
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function BrowseTradesPage(props: PageProps<"/trades/browse">) {
  if (!TRADING_ENABLED) {
    notFound();
  }

  const searchParams = await props.searchParams;
  const tab = first(searchParams.tab) === "items" ? "items" : "pets";
  const q = (first(searchParams.q) ?? "").trim();
  const rarityParam = first(searchParams.rarity);
  const rarity = rarityParam && isRarity(rarityParam) ? rarityParam : null;
  const owner = (first(searchParams.owner) ?? "").trim();
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

  let ownerIds: string[] | null = null;
  if (owner.length > 0) {
    const { data: matchingOwners } = await supabase
      .from("user_profiles")
      .select("id")
      .ilike("display_name", `%${owner}%`);
    ownerIds = (matchingOwners ?? []).map((o) => o.id);
    if (ownerIds.length === 0) {
      ownerIds = ["00000000-0000-0000-0000-000000000000"]; // no matches — force an empty result
    }
  }

  let petRows: {
    id: string;
    rarity: PetRarity;
    custom_name: string | null;
    owner_id: string;
    composited_image_url: string | null;
    species: { name: string; image_url: string | null } | null;
    breed: { name: string } | null;
  }[] = [];
  let itemRows: { item_id: string; owner_id: string; quantity: number; items: { name: string; image_url: string | null; rarity: PetRarity; type: string } | null }[] = [];
  let totalCount = 0;

  if (tab === "pets") {
    let query = supabase
      .from("pets")
      .select("id, rarity, custom_name, owner_id, composited_image_url, species(name, image_url), breed:breeds(name)", {
        count: "exact",
      })
      .eq("is_for_trade", true)
      .neq("owner_id", user.id);

    if (rarity) query = query.eq("rarity", rarity);
    if (ownerIds) query = query.in("owner_id", ownerIds);
    // Only matches legacy (species-based) pets — searching breed names
    // for trait-based pets would need a second, OR'd embedded-table
    // filter PostgREST doesn't support cleanly alongside pagination's
    // exact count. Acceptable gap while trading stays disabled.
    if (q.length > 0) query = query.ilike("species.name", `%${q}%`);

    const { data, count } = await query.order("id", { ascending: true }).range(offset, offset + PAGE_SIZE - 1);
    petRows = (data ?? []) as unknown as typeof petRows;
    totalCount = count ?? 0;
  } else {
    let query = supabase
      .from("user_inventory")
      .select("item_id, owner_id:user_id, quantity, items!inner(name, image_url, rarity, type)", {
        count: "exact",
      })
      .eq("is_for_trade", true)
      .gt("quantity", 0)
      .neq("user_id", user.id);

    if (rarity) query = query.eq("items.rarity", rarity);
    if (ownerIds) query = query.in("user_id", ownerIds);
    if (q.length > 0) query = query.ilike("items.name", `%${q}%`);

    const { data, count } = await query.order("item_id", { ascending: true }).range(offset, offset + PAGE_SIZE - 1);
    itemRows = (data ?? []) as unknown as typeof itemRows;
    totalCount = count ?? 0;
  }

  const ownerIdsToResolve = [
    ...new Set([...petRows.map((p) => p.owner_id), ...itemRows.map((i) => i.owner_id)]),
  ];
  const { data: profiles } = await supabase
    .from("user_profiles")
    .select("id, display_name")
    .in("id", ownerIdsToResolve.length > 0 ? ownerIdsToResolve : ["00000000-0000-0000-0000-000000000000"]);
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const qs = (overrides: Record<string, string | number>) => {
    const params = new URLSearchParams();
    params.set("tab", tab);
    if (q) params.set("q", q);
    if (rarity) params.set("rarity", rarity);
    if (owner) params.set("owner", owner);
    params.set("page", String(page));
    for (const [k, v] of Object.entries(overrides)) {
      if (v === "") params.delete(k);
      else params.set(k, String(v));
    }
    return `?${params.toString()}`;
  };

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Browse trades</h1>
        <p className="text-sm text-stone-500">
          Everything other players have marked available to trade.{" "}
          <Link href="/trades" className="underline">
            Trading Center
          </Link>
        </p>
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
        <input
          name="owner"
          defaultValue={owner}
          placeholder="Owner username"
          className="rounded-md border border-green-300 px-3 py-1.5 text-sm dark:border-stone-700 dark:bg-stone-900"
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
        <button
          type="submit"
          className="rounded-md border border-green-300 px-3 py-1.5 text-sm hover:bg-green-100 dark:border-stone-700 dark:hover:bg-stone-800"
        >
          Filter
        </button>
      </form>

      {tab === "pets" ? (
        petRows.length === 0 ? (
          <p className="text-sm italic text-stone-500">No pets match — try different filters.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4 md:grid-cols-6">
            {petRows.map((pet) => (
              <li
                key={pet.id}
                className="flex flex-col items-center gap-1.5 rounded-lg border border-green-200 p-3 text-center dark:border-stone-800"
              >
                {petImageUrl(pet) ? (
                  <Image
                    src={petImageUrl(pet)!}
                    alt={petTypeName(pet)}
                    width={64}
                    height={64}
                    className="h-16 w-16 rounded border-2 border-blue-600"
                  />
                ) : (
                  <div className="h-16 w-16 rounded bg-green-200 dark:bg-stone-800" />
                )}
                <p className="text-xs font-medium">{pet.custom_name ?? petTypeName(pet)}</p>
                <p className="text-[10px] capitalize text-stone-500">
                  {petTypeName(pet)} · {pet.rarity}
                </p>
                <Link
                  href={`/trades/new?to=${encodeURIComponent(nameById.get(pet.owner_id) ?? "")}&petId=${pet.id}`}
                  className="text-xs text-green-800 hover:underline dark:text-green-300"
                >
                  {nameById.get(pet.owner_id) ?? "Unknown"} · Request
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : itemRows.length === 0 ? (
        <p className="text-sm italic text-stone-500">No items match — try different filters.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4 md:grid-cols-6">
          {itemRows.map((row) => (
            <li
              key={`${row.owner_id}-${row.item_id}`}
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
              <p className="text-[10px] text-stone-500">×{row.quantity}</p>
              <Link
                href={`/trades/new?to=${encodeURIComponent(nameById.get(row.owner_id) ?? "")}&itemId=${row.item_id}`}
                className="text-xs text-green-800 hover:underline dark:text-green-300"
              >
                {nameById.get(row.owner_id) ?? "Unknown"} · Request
              </Link>
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
