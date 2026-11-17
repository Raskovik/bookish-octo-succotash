import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { needsOnboarding } from "@/lib/onboarding";

/**
 * Exchanges the OAuth `code` Supabase redirects back with for a session,
 * then sends the user on to their profile. Google's OAuth handshake
 * itself can't be intercepted to enforce an account ban ("cannot log in")
 * — so instead the sign-in is allowed to succeed, and an active account
 * ban is checked for immediately afterward. If found, the session is
 * signed right back out and the player is sent to "/" with the ban's
 * reason/expiry so it can render a clear notice — "cannot log in" means
 * the session never survives past this check, not that the OAuth flow
 * itself was blocked mid-handshake.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: hasAccountBan } = await supabase.rpc("user_has_active_ban", {
          p_user_id: user.id,
          p_ban_type: "account",
        });

        if (hasAccountBan) {
          const { data: ban } = await supabase
            .from("bans")
            .select("reason, expires_at")
            .eq("user_id", user.id)
            .eq("ban_type", "account")
            .is("lifted_at", null)
            .gt("expires_at", new Date().toISOString())
            .order("expires_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          await supabase.auth.signOut();

          const params = new URLSearchParams({ banned: "account", until: ban?.expires_at ?? "" });
          if (ban?.reason) params.set("reason", ban.reason);
          return NextResponse.redirect(`${origin}/?${params.toString()}`);
        }

        if (await needsOnboarding(supabase, user.id)) {
          return NextResponse.redirect(`${origin}/welcome`);
        }
      }

      return NextResponse.redirect(`${origin}/profile`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
