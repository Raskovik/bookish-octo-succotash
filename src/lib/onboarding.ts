import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/**
 * A signed-in player hasn't finished first-sign-in setup (see
 * 0070_account_setup_onboarding.sql) until both steps on /welcome are
 * done: display_name is set (screen 0) and starter_granted is true
 * (screen 1). Checked at every entry point a player could land on
 * mid-onboarding — the auth callback, /login, and / — rather than one
 * central layout, since this app has no global auth-gating middleware
 * (see proxy.ts, which only refreshes the session cookie).
 */
export async function needsOnboarding(supabase: SupabaseClient<Database>, userId: string): Promise<boolean> {
  const { data } = await supabase.from("users").select("display_name, starter_granted").eq("id", userId).single();

  if (!data) return false;
  return data.display_name === null || !data.starter_granted;
}
