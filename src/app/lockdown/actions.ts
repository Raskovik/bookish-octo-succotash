"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DEV_ACCESS_CODE } from "@/config";
import { DEV_LOCKDOWN_COOKIE_NAME, DEV_LOCKDOWN_COOKIE_VALUE } from "@/lib/dev-lockdown";

export type LockdownFormState = { error: string } | null;

export async function submitDevCode(
  _prevState: LockdownFormState,
  formData: FormData,
): Promise<LockdownFormState> {
  const code = String(formData.get("code") ?? "").trim();
  const nextPath = String(formData.get("next") ?? "/");

  if (code !== DEV_ACCESS_CODE) {
    return { error: "That code isn't right." };
  }

  const cookieStore = await cookies();
  cookieStore.set(DEV_LOCKDOWN_COOKIE_NAME, DEV_LOCKDOWN_COOKIE_VALUE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });

  // Only ever redirect somewhere on this same site — `next` comes from a
  // query param an attacker could craft, so a bare "/..." check keeps a
  // correct code entry from being used to bounce someone off-site.
  redirect(nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/");
}
