import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ShopFolder } from "@/components/shop/shop-folder";
import type { ShopListingWithTarget, ShopSection } from "@/lib/supabase/types";

type ListingJoinRow = {
  id: string;
  section: ShopSection;
  listing_type: "item" | "pet";
  description: string | null;
  price_coins: number | null;
  price_gems: number | null;
  is_new: boolean;
  ends_at: string | null;
  items: { name: string; image_url: string | null } | null;
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
        "id, section, listing_type, description, price_coins, price_gems, is_new, ends_at, items(name, image_url), species(name, image_url)",
      )
      .eq("is_active", true)
      // ends_at in the past is excluded entirely rather than shown
      // "sold out" — a limited-time listing is meant to just leave the
      // shop on its own once its time is up, per the ask.
      .or(`ends_at.is.null,ends_at.gt.${new Date().toISOString()}`)
      .order("section")
      .order("sort_order"),
  ]);

  const coinBalance = userRow?.coin_balance ?? 0;
  const gemBalance = userRow?.gem_balance ?? 0;

  const listings = ((listingsData ?? []) as unknown as ListingJoinRow[]).map((row): ShopListingWithTarget => {
    const target = row.listing_type === "item" ? row.items : row.species;
    return {
      id: row.id,
      section: row.section,
      listing_type: row.listing_type,
      price_coins: row.price_coins,
      price_gems: row.price_gems,
      is_new: row.is_new,
      ends_at: row.ends_at,
      name: target?.name ?? "(unavailable)",
      description: row.description,
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
