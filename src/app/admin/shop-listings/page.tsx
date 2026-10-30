import Image from "next/image";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { deleteShopListing } from "./actions";
import type { ShopListingRow } from "@/lib/supabase/types";

type ListingRow = Pick<
  ShopListingRow,
  "id" | "section" | "listing_type" | "price_coins" | "price_gems" | "is_new" | "ends_at" | "is_active"
> & {
  items: { name: string; image_url: string | null } | null;
  species: { name: string; image_url: string | null } | null;
};

export default async function AdminShopListingsPage() {
  const { supabase } = await requireAdmin();

  const { data: listingsData } = await supabase
    .from("shop_listings")
    .select("id, section, listing_type, price_coins, price_gems, is_new, ends_at, is_active, items(name, image_url), species(name, image_url)")
    .order("section")
    .order("sort_order");

  const listings = (listingsData ?? []) as unknown as ListingRow[];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">Shop listings</h2>
        <Link
          href="/admin/shop-listings/new"
          className="rounded-md bg-green-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 dark:bg-green-200 dark:text-green-950 dark:hover:bg-green-300"
        >
          + New listing
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border border-green-200 dark:border-stone-800">
        <table className="w-full text-sm">
          <thead className="bg-green-100 text-left text-xs uppercase tracking-wide text-stone-500 dark:bg-stone-900">
            <tr>
              <th className="px-4 py-2">Sells</th>
              <th className="px-4 py-2">Section</th>
              <th className="px-4 py-2">Price</th>
              <th className="px-4 py-2">Tags</th>
              <th className="px-4 py-2">Leaves at</th>
              <th className="px-4 py-2">Active</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {listings.map((listing) => {
              const target = listing.listing_type === "item" ? listing.items : listing.species;
              const expired = listing.ends_at !== null && new Date(listing.ends_at) <= new Date();
              return (
                <tr
                  key={listing.id}
                  className="border-t border-green-200 hover:bg-green-50 dark:border-stone-800 dark:hover:bg-stone-900"
                >
                  <td className="px-4 py-2">
                    <Link href={`/admin/shop-listings/${listing.id}`} className="flex items-center gap-2 hover:underline">
                      {target?.image_url ? (
                        <Image src={target.image_url} alt="" width={24} height={24} className="h-6 w-6 rounded" />
                      ) : null}
                      {target?.name ?? "(deleted)"}
                      <span className="text-xs text-stone-400">({listing.listing_type})</span>
                    </Link>
                  </td>
                  <td className="px-4 py-2">{listing.section}</td>
                  <td className="px-4 py-2">
                    {[
                      listing.price_coins !== null ? `${listing.price_coins} coins` : null,
                      listing.price_gems !== null ? `${listing.price_gems} gems` : null,
                    ]
                      .filter(Boolean)
                      .join(" / ")}
                  </td>
                  <td className="px-4 py-2">
                    {listing.is_new ? <span className="mr-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700 dark:bg-orange-950 dark:text-orange-300">New</span> : null}
                    {listing.ends_at !== null ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                        Limited
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {listing.ends_at ? (
                      <span className={expired ? "text-red-600 dark:text-red-400" : ""}>
                        {new Date(listing.ends_at).toLocaleString()}
                        {expired ? " (expired)" : ""}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-2">{listing.is_active ? "Yes" : "No"}</td>
                  <td className="px-4 py-2 text-right">
                    <form action={deleteShopListing}>
                      <input type="hidden" name="listing_id" value={listing.id} />
                      <button type="submit" className="text-xs text-red-600 hover:underline dark:text-red-400">
                        Delete
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
            {listings.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-stone-500">
                  No shop listings yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
