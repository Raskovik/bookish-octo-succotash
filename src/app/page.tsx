import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// ?banned=account&until=...&reason=... is set by /auth/callback when an
// account-banned player tries to sign in — the OAuth handshake itself
// can't be intercepted, so the session is allowed, checked, then
// immediately signed back out and redirected here with these params
// before this page ever renders a "you're signed in" state for them.
export default async function Home(props: PageProps<"/">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const searchParams = await props.searchParams;
  const banned = first(searchParams.banned);
  const until = first(searchParams.until);
  const reason = first(searchParams.reason);

  if (banned === "account") {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
        <h1 className="max-w-xl text-3xl font-semibold tracking-tight text-red-700 dark:text-red-400">
          Your account is banned
        </h1>
        <p className="max-w-md text-lg text-stone-600 dark:text-stone-400">
          You can&apos;t sign in right now.
          {until ? ` This ban is in effect until ${new Date(until).toLocaleString()}.` : ""}
        </p>
        {reason ? (
          <p className="max-w-md rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            &ldquo;{reason}&rdquo;
          </p>
        ) : null}
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
      <Image
        src="/ui/furgarden-hero.png"
        alt="Furgarden — coming soon"
        width={2274}
        height={1080}
        priority
        className="h-auto w-full max-w-2xl rounded-xl shadow-sm"
      />
      <h1 className="max-w-xl text-4xl font-semibold tracking-tight">
        Adopt, hatch, and trade virtual pets
      </h1>
      <p className="max-w-md text-lg text-stone-600 dark:text-stone-400">
        Send your pets on expeditions, tend a garden, and build your
        collection.
      </p>
      <Link
        href={user ? "/profile" : "/login"}
        className="rounded-md bg-green-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-green-700 dark:bg-green-200 dark:text-green-950 dark:hover:bg-green-300"
      >
        {user ? "Go to your profile" : "Sign in with Google"}
      </Link>
    </main>
  );
}
