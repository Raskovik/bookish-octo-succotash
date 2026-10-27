import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GoogleSignInButton } from "./google-sign-in-button";

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/profile");
  }

  return (
    <main id="main">
      <div className="sheet">
        <div className="panel flex flex-col items-center justify-center gap-6 text-center">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Sign in</h1>
        <p className="max-w-sm text-stone-600 dark:text-stone-400">
          Adopt pets, run expeditions, and trade with other players. Sign in
          with your Google account to get started — no password required.
        </p>
      </div>
      <GoogleSignInButton />
        </div>
      </div>
    </main>
  );
}
