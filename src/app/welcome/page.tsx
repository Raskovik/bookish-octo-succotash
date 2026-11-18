import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WelcomeApp } from "./welcome-app";

// First sign-in account setup — see 0070_account_setup_onboarding.sql
// and the design handoff's README ("Account setup page"). Resumable at
// either step: a player who finished screen 0 but closed the tab before
// adopting a pet comes back here and lands straight on screen 1, not
// back at screen 0.
export default async function WelcomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: account } = await supabase
    .from("users")
    .select("display_name, starter_granted")
    .eq("id", user.id)
    .single();

  if (!account) {
    redirect("/login");
  }

  if (account.display_name !== null && account.starter_granted) {
    redirect("/profile");
  }

  const { data: starters } = await supabase
    .from("species")
    .select("id, starter_label, starter_blurb, image_url")
    .eq("is_starter_option", true)
    .order("starter_label");

  return (
    <main id="main">
      <div className="sheet">
        <div className="panel">
          <WelcomeApp
            email={user.email ?? ""}
            initialDisplayName={account.display_name}
            starters={(starters ?? []).map((s) => ({
              id: s.id,
              label: s.starter_label ?? "Mystery pet",
              blurb: s.starter_blurb ?? "",
              imageUrl: s.image_url ?? "",
            }))}
          />
        </div>
      </div>
    </main>
  );
}
