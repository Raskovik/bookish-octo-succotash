import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { DEV_LOCKDOWN_ENABLED } from "@/config";
import { DEV_LOCKDOWN_COOKIE_NAME, DEV_LOCKDOWN_COOKIE_VALUE } from "@/lib/dev-lockdown";

export function proxy(request: NextRequest) {
  if (DEV_LOCKDOWN_ENABLED) {
    const { pathname } = request.nextUrl;
    const hasDevAccess = request.cookies.get(DEV_LOCKDOWN_COOKIE_NAME)?.value === DEV_LOCKDOWN_COOKIE_VALUE;

    // /lockdown itself is the only path exempt — everything else,
    // including sign-in, is blocked until the code is entered.
    if (!hasDevAccess && pathname !== "/lockdown") {
      const url = request.nextUrl.clone();
      url.pathname = "/lockdown";
      url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname)}`;
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
