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
    <>
      <div className="crumbs">
        <Link href="/admin">Dashboard</Link>
        <i>/</i>
        <span>Shop listings</span>
      </div>
      <div className="ph">
        <h1>Shop listings</h1>
        <div className="pha">
          <Link href="/admin/shop-listings/new" className="btn pri">
            + New listing
          </Link>
        </div>
      </div>
      <p className="desc" style={{ marginBottom: 14 }}>What the shop sells right now, and for how much.</p>

      <div className="card">
        <div className="tw">
          <table className="tbl">
            <thead>
              <tr>
                <th>Sells</th>
                <th>Section</th>
                <th>Price</th>
                <th>Status</th>
                <th>Tags</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {listings.map((listing) => {
                const target = listing.listing_type === "item" ? listing.items : listing.species;
                const name = target?.name ?? "(deleted)";
                const status = shopListingStatus(listing.starts_at, listing.ends_at, now);
                return (
                  <tr key={listing.id}>
                    <td>
                      <Link href={`/admin/shop-listings/${listing.id}`} className="rl">
                        {target?.image_url ? (
                          <span className="th xs">
                            <Image src={target.image_url} alt="" width={26} height={26} />
                          </span>
                        ) : null}
                        {name}
                        <span className="muted" style={{ fontWeight: 400 }}>
                          ({listing.listing_type})
                        </span>
                      </Link>
                    </td>
                    <td style={{ textTransform: "capitalize" }}>{listing.section}</td>
                    <td>
                      {[
                        listing.price_coins !== null ? `${listing.price_coins} coins` : null,
                        listing.price_gems !== null ? `${listing.price_gems} gems` : null,
                      ]
                        .filter(Boolean)
                        .join(" / ")}
                    </td>
                    <td>
                      <ShopStatusBadge status={status} />
                    </td>
                    <td className="stg">
                      {isNewListing(listing.starts_at, now) ? <Badge color="green">New</Badge> : null}
                      {isLimitedListing(listing.starts_at, listing.ends_at) ? <Badge color="orange">Limited</Badge> : null}
                    </td>
                    <td className="act">
                      <DeleteListingButton listingId={listing.id} listingName={name} />
                    </td>
                  </tr>
                );
              })}
              {listings.length === 0 ? (
                <tr className="empty">
                  <td colSpan={6}>No shop listings yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
