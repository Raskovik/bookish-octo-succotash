import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BuyGemsButton } from "@/components/buy-gems-button";
import { CurrencyIcon } from "@/components/currency-icon";

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function GemsPage(props: PageProps<"/gems">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const searchParams = await props.searchParams;
  const cancelled = first(searchParams.cancelled) === "1";

  const [{ data: packagesData }, { data: userRow }] = await Promise.all([
    supabase
      .from("gem_packages")
      .select("id, name, gem_amount, price_cents, is_active")
      .eq("is_active", true)
      .order("sort_order"),
    supabase.from("users").select("gem_balance").eq("id", user.id).single(),
  ]);

  const packages = packagesData ?? [];
  const gemBalance = userRow?.gem_balance ?? 0;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Get Gems</h1>
          <p className="text-sm text-stone-500">
            Buy gems with real money, or trade for them with other players on{" "}
            <Link href="/trades" className="underline">
              Trades
            </Link>
            .
          </p>
        </div>
        <p className="whitespace-nowrap rounded-md border border-green-300 bg-white/80 px-3 py-1.5 text-sm font-medium dark:border-stone-700 dark:bg-stone-900/80">
          <CurrencyIcon kind="gem" /> {gemBalance}
        </p>
      </div>

      {cancelled ? (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          Checkout was cancelled — no charge was made.
        </p>
      ) : null}

      {packages.length === 0 ? (
        <p className="text-sm italic text-stone-500">No gem packages for sale right now — check back later.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {packages.map((pkg) => (
            <li
              key={pkg.id}
              className="flex flex-col items-center gap-2 rounded-lg border border-green-200 p-4 text-center dark:border-stone-800"
            >
              <p className="text-lg font-semibold">
                <CurrencyIcon kind="gem" size={20} /> {pkg.gem_amount}
              </p>
              <p className="text-sm text-stone-500">{pkg.name}</p>
              <p className="text-sm font-medium">{formatPrice(pkg.price_cents)}</p>
              <BuyGemsButton packageId={pkg.id} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
