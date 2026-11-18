// A shop listing's availability and tags are computed from starts_at/
// ends_at at read time, never stored — see 0082_admin_redesign_schema.sql
// (shop_listings dropped is_active/is_new). Shared by the player /shop
// page and every admin shop-listings page so the rules live in one place.

export type ShopListingStatus = "scheduled" | "live" | "ended";

const NEW_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;
const LIMITED_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

export function shopListingStatus(startsAt: string, endsAt: string | null, now: Date = new Date()): ShopListingStatus {
  if (now < new Date(startsAt)) return "scheduled";
  if (endsAt && now >= new Date(endsAt)) return "ended";
  return "live";
}

// "New" = arrived within the last 3 days (arrival day + 3).
export function isNewListing(startsAt: string, now: Date = new Date()): boolean {
  const ageMs = now.getTime() - new Date(startsAt).getTime();
  return ageMs >= 0 && ageMs <= NEW_WINDOW_MS;
}

// "Limited" = has an end date and the listing's whole window is 14 days
// or fewer — not just "ends eventually".
export function isLimitedListing(startsAt: string, endsAt: string | null): boolean {
  if (!endsAt) return false;
  return new Date(endsAt).getTime() - new Date(startsAt).getTime() <= LIMITED_WINDOW_MS;
}
