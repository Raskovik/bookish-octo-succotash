import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { DEV_LOCKDOWN_ENABLED } from "@/config";
import { DEV_LOCKDOWN_COOKIE_NAME, DEV_LOCKDOWN_COOKIE_VALUE } from "@/lib/dev-lockdown";

export function proxy(request: NextRequest) {
  if (DEV_LOCKDOWN_ENABLED) {
    const { pathname } = request.nextUrl;
    // /lockdown itself, and the OAuth round-trip (/auth/*), are exempt.
    // /auth/callback in particular MUST always be reachable regardless of
    // whether this visitor's browser happens to have the dev cookie —
    // Google redirects back here with a one-time, short-lived
    // authorization code, and bouncing that request to /lockdown instead
    // of letting it reach the real route silently discards the code,
    // breaking sign-in entirely rather than just gating content. There's
    // nothing to protect by gating this path anyway — it's plumbing, not
    // a page with anything to see.
    const isExempt = pathname === "/lockdown" || pathname.startsWith("/auth/");
    const hasDevAccess = request.cookies.get(DEV_LOCKDOWN_COOKIE_NAME)?.value === DEV_LOCKDOWN_COOKIE_VALUE;

    if (!hasDevAccess && !isExempt) {
      const url = request.nextUrl.clone();
      const originalPath = pathname + request.nextUrl.search;
      url.pathname = "/lockdown";
      url.search = originalPath === "/" ? "" : `?next=${encodeURIComponent(originalPath)}`;
      return NextResponse.redirect(url);
    }
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
