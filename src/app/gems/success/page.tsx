import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Stripe redirects here right after a successful payment — but the
// webhook (which actually credits the gems) can land a moment later, so
// this page doesn't assume success itself, it just checks whether
// gem_purchases already has the row. RLS (user_id = auth.uid()) already
// scopes this lookup to the signed-in player's own purchases, so there's
// no need to double-check ownership here.
export default async function GemsSuccessPage(props: PageProps<"/gems/success">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const searchParams = await props.searchParams;
  const sessionId = first(searchParams.session_id);

  const { data: purchase } = sessionId
    ? await supabase
        .from("gem_purchases")
        .select("gem_amount")
        .eq("stripe_checkout_session_id", sessionId)
        .maybeSingle()
    : { data: null };

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      {purchase ? (
        <>
          <h1 className="text-2xl font-semibold tracking-tight">You&apos;re all set!</h1>
          <p className="text-stone-600 dark:text-stone-400">
            {purchase.gem_amount} gems have been added to your account.
          </p>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-semibold tracking-tight">Payment received</h1>
          <p className="text-stone-600 dark:text-stone-400">
            Your gems are on the way — this usually takes just a few seconds. Refresh in a moment if your
            balance doesn&apos;t show it yet.
          </p>
        </>
      )}
      <Link
        href="/gems"
        className="rounded-md bg-green-800 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 dark:bg-green-200 dark:text-green-950 dark:hover:bg-green-300"
      >
        Back to Get Gems
      </Link>
    </main>
  );
}
