import Image from "next/image";
import { CancelListingButton } from "./cancel-listing-button";
import { PriceLabel } from "@/components/price-label";
import type { MarketplaceListing } from "@/lib/supabase/types";

const STATUS_STYLES: Record<MarketplaceListing["status"], string> = {
  active: "bg-green-200 text-green-900 dark:bg-green-900 dark:text-green-100",
  sold: "bg-green-200 text-green-900 dark:bg-green-900 dark:text-green-100",
  cancelled: "bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300",
  expired: "bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300",
};

function timeLeftLabel(expiresAt: string): string {
  const msLeft = new Date(expiresAt).getTime() - Date.now();
  if (msLeft <= 0) return "Expiring…";
  const hours = Math.ceil(msLeft / (60 * 60 * 1000));
  if (hours < 24) return `Expires in ${hours}h`;
  return `Expires in ${Math.ceil(hours / 24)}d`;
}

export function ListingCard({
  listing,
  viewerId,
}: {
  listing: MarketplaceListing;
  viewerId: string;
}) {
  const isPet = listing.listing_type === "pet";
  const imageUrl = isPet ? listing.pet_species_image_url : listing.itemImageUrl;
  const name = isPet ? (listing.pet_custom_name ?? listing.pet_species_name) : listing.itemName;
  const isSeller = listing.sellerId === viewerId;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-green-200 p-3 dark:border-stone-800">
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt=""
          width={48}
          height={48}
          className={`h-12 w-12 rounded border-2 ${isPet ? "border-blue-600" : "border-green-600"}`}
        />
      ) : (
        <div className="h-12 w-12 rounded bg-green-200 dark:bg-stone-800" />
      )}
      <div className="flex-1">
        <p className="text-sm font-medium">
          {name}
          {!isPet && listing.item_quantity ? ` ×${listing.item_quantity}` : ""}
        </p>
        <p className="text-xs text-stone-500">
          <PriceLabel priceCoins={listing.price_coins} priceGems={listing.price_gems} /> ·{" "}
          {isSeller ? `to ${listing.buyerName ?? "—"}` : `from ${listing.sellerName}`}
        </p>
        {listing.status === "active" ? (
          <p className="text-[10px] text-stone-400">{timeLeftLabel(listing.expires_at)}</p>
        ) : null}
      </div>
      <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[listing.status]}`}>
        {listing.status}
      </span>
      {isSeller && listing.status === "active" ? (
        <CancelListingButton userId={viewerId} listingId={listing.id} />
      ) : null}
    </div>
  );
}
