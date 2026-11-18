import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ShopFolder } from "@/components/shop/shop-folder";
import { isNewListing, isLimitedListing } from "@/lib/shop-status";
import type { ShopListingWithTarget, ShopSection } from "@/lib/supabase/types";

type ListingJoinRow = {
  id: string;
  section: ShopSection;
  listing_type: "item" | "pet";
  description: string | null;
  price_coins: number | null;
  price_gems: number | null;
  starts_at: string;
  ends_at: string | null;
  items: { name: string; image_url: string | null; description: string | null } | null;
  species: { name: string; image_url: string | null } | null;
};

export default async function ShopPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: userRow }, { data: listingsData }] = await Promise.all([
    supabase.from("users").select("coin_balance, gem_balance").eq("id", user.id).single(),
    supabase
      .from("shop_listings")
      .select(
        "id, section, listing_type, description, price_coins, price_gems, starts_at, ends_at, items(name, image_url, description), species(name, image_url)",
      )
      // A listing not yet started, or past its end date, is excluded
      // entirely rather than shown "sold out" — it's meant to just
      // arrive/leave the shop on its own, per the ask.
      .lte("starts_at", new Date().toISOString())
      .or(`ends_at.is.null,ends_at.gt.${new Date().toISOString()}`)
      .order("section")
      .order("sort_order"),
  ]);

  const coinBalance = userRow?.coin_balance ?? 0;
  const gemBalance = userRow?.gem_balance ?? 0;

  const listings = ((listingsData ?? []) as unknown as ListingJoinRow[]).map((row): ShopListingWithTarget => {
    const target = row.listing_type === "item" ? row.items : row.species;
    // The shop shows the item's own description unless an override was
    // typed — species have no description at all, so a pet listing
    // shows nothing unless an override is set.
    const itemDescription = row.listing_type === "item" ? row.items?.description ?? null : null;
    return {
      id: row.id,
      section: row.section,
      listing_type: row.listing_type,
      price_coins: row.price_coins,
      price_gems: row.price_gems,
      ends_at: row.ends_at,
      is_new: isNewListing(row.starts_at),
      is_limited: isLimitedListing(row.starts_at, row.ends_at),
      name: target?.name ?? "(unavailable)",
      description: row.description ?? itemDescription,
      imageUrl: target?.image_url ?? null,
    };
  });

  const sections: Record<ShopSection, ShopListingWithTarget[]> = {
    pets: [],
    food: [],
    den: [],
    specials: [],
  };
  for (const listing of listings) {
    sections[listing.section].push(listing);
  }

  return (
    <main id="main">
      <div className="sheet">
        <div className="panel shop">
          <section className="col sh-top sh-signed" aria-label="Market">
            <div className="sh-top-body">
              <div className="sh-top-text">
                <h1 className="sh-sign">
                  <span>Market</span>
                </h1>
                <p className="sh-intro">
                  Welcome to the Market! Every shop here sells something different, and the stock changes often, so
                  check back to see what&rsquo;s new.
                </p>
                <div className="sh-wcard" role="group" aria-label="Your balance">
                  <p className="sh-w-lab">You have</p>
                  <div className="sh-wvals">
                    <span className="sh-w">
                      <span className="coin" role="img" aria-label="Coins" />
                      <b>{coinBalance}</b>
                    </span>
                    <span className="sh-w">
                      <span className="coin gem" role="img" aria-label="Gems" />
                      <b>{gemBalance}</b>
                    </span>
                  </div>
                </div>
                {/* The design's "Get more" link points at a /shop/coins
                    real-money purchase flow that doesn't exist in this
                    app — left as plain text rather than a dead link. */}
                <p className="sh-more">More ways to get coins and gems are coming soon.</p>
              </div>
              <div className="sh-top-art">
                {/* eslint-disable-next-line @next/next/no-img-element -- placeholder shopkeeper art, swapped later per the design's own README */}
                <img
                  className="sh-keeper-img"
                  src="/img/placeholder-shopkeeper.png"
                  alt="The shopkeeper, a green cat behind the shop counter"
                />
              </div>
            </div>
          </section>

          <ShopFolder userId={user.id} coinBalance={coinBalance} gemBalance={gemBalance} sections={sections} />
        </div>
      </div>
    </main>
  );
}
