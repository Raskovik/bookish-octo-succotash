import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * A service-role Supabase client — bypasses RLS entirely and satisfies
 * protect_privileged_user_fields' `auth.role() = 'service_role'` escape
 * hatch (see 0002_pets_and_tutorial_expedition.sql). Used ONLY by the
 * Stripe webhook route (api/stripe/webhook/route.ts), which has no
 * player session to authenticate as — its security boundary is the
 * webhook signature check, not RLS. Never import this from anywhere a
 * player's own request flows through; every other part of the app uses
 * lib/supabase/server.ts's cookie-scoped client instead.
 *
 * Plain @supabase/supabase-js, not @supabase/ssr — there's no cookie
 * store to manage here, just a fixed API key.
 */
export function createServiceClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set.");
  }

  return createSupabaseClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
