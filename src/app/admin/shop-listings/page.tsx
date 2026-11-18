import Image from "next/image";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { ShopStatusBadge, Badge } from "@/components/admin/badges";
import { isLimitedListing, isNewListing, shopListingStatus } from "@/lib/shop-status";
import type { ShopListingRow } from "@/lib/supabase/types";
import { DeleteListingButton } from "./delete-listing-button";

type ListingRow = Pick<
  ShopListingRow,
  "id" | "section" | "listing_type" | "price_coins" | "price_gems" | "starts_at" | "ends_at"
> & {
  items: { name: string; image_url: string | null } | null;
  species: { name: string; image_url: string | null } | null;
};

export default async function AdminShopListingsPage() {
  const { supabase } = await requireAdmin();

  const { data: listingsData } = await supabase
    .from("shop_listings")
    .select("id, section, listing_type, price_coins, price_gems, starts_at, ends_at, items(name, image_url), species(name, image_url)")
    .order("section")
    .order("sort_order");

  const listings = (listingsData ?? []) as unknown as ListingRow[];
  const now = new Date();

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
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Tags</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {listings.map((listing) => {
              const target = listing.listing_type === "item" ? listing.items : listing.species;
              const name = target?.name ?? "(deleted)";
              const status = shopListingStatus(listing.starts_at, listing.ends_at, now);
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
                      {name}
                      <span className="text-xs text-stone-400">({listing.listing_type})</span>
                    </Link>
                  </td>
                  <td className="px-4 py-2 capitalize">{listing.section}</td>
                  <td className="px-4 py-2">
                    {[
                      listing.price_coins !== null ? `${listing.price_coins} coins` : null,
                      listing.price_gems !== null ? `${listing.price_gems} gems` : null,
                    ]
                      .filter(Boolean)
                      .join(" / ")}
                  </td>
                  <td className="px-4 py-2">
                    <ShopStatusBadge status={status} />
                  </td>
                  <td className="px-4 py-2">
                    {isNewListing(listing.starts_at, now) ? <Badge color="green">New</Badge> : null}{" "}
                    {isLimitedListing(listing.starts_at, listing.ends_at) ? <Badge color="orange">Limited</Badge> : null}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <DeleteListingButton listingId={listing.id} listingName={name} />
                  </td>
                </tr>
              );
            })}
            {listings.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-stone-500">
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
