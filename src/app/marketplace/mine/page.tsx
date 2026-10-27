import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadListings } from "../load-listings";
import { ListingCard } from "../listing-card";

export default async function MyListingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await supabase.rpc("resolve_expired_listings");

  const { data: idRows } = await supabase
    .from("marketplace_listings")
    .select("id")
    .or(`seller_id.eq.${user.id},buyer_id.eq.${user.id}`);

  const listings = await loadListings(
    supabase,
    (idRows ?? []).map((r) => r.id),
  );

  const selling = listings.filter((l) => l.sellerId === user.id);
  const purchases = listings.filter((l) => l.buyerId === user.id);

  return (
    <main id="main">
      <div className="sheet">
        <div className="panel flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My listings</h1>
          <p className="text-sm text-stone-500">
            <Link href="/marketplace" className="underline">
              Back to Marketplace
            </Link>
          </p>
        </div>
        <Link
          href="/marketplace/sell"
          className="rounded-md bg-green-800 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 dark:bg-green-200 dark:text-green-950 dark:hover:bg-green-300"
        >
          Sell something
        </Link>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Selling ({selling.length})</h2>
        {selling.length === 0 ? (
          <p className="text-sm italic text-stone-500">You haven&apos;t listed anything yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {selling.map((listing) => (
              <ListingCard key={listing.id} listing={listing} viewerId={user.id} />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Purchases ({purchases.length})</h2>
        {purchases.length === 0 ? (
          <p className="text-sm italic text-stone-500">You haven&apos;t bought anything yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {purchases.map((listing) => (
              <ListingCard key={listing.id} listing={listing} viewerId={user.id} />
            ))}
          </div>
        )}
      </section>
        </div>
      </div>
    </main>
  );
}
