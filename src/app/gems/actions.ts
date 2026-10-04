"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStripeClient } from "@/lib/stripe";

export type GemCheckoutState = { error: string } | null;

/**
 * Creates a Stripe Checkout Session for one gem package and redirects the
 * player to Stripe's hosted payment page. Gems are NOT credited here —
 * that only happens once Stripe confirms the payment actually went
 * through, via the webhook (api/stripe/webhook/route.ts) calling
 * credit_gems_from_purchase. This action's only job is "start a
 * payment," never "grant anything."
 *
 * gem_amount/price_cents are snapshotted into the session's metadata at
 * creation time (not re-read from gem_packages by the webhook later) —
 * see the comment on gem_purchases in 0045_gem_purchases.sql for why:
 * it's what the player actually agreed to pay, even if the package is
 * edited or deactivated before the webhook fires.
 */
export async function createGemCheckoutSession(
  _prevState: GemCheckoutState,
  formData: FormData,
): Promise<GemCheckoutState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const packageId = String(formData.get("package_id") ?? "");
  if (packageId.length === 0) {
    return { error: "Invalid gem package." };
  }

  const { data: gemPackage } = await supabase
    .from("gem_packages")
    .select("id, name, gem_amount, price_cents, is_active")
    .eq("id", packageId)
    .single();

  if (!gemPackage || !gemPackage.is_active) {
    return { error: "That gem package is no longer available." };
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return { error: "Gem purchases aren't set up on this deployment yet." };
  }

  const headersList = await headers();
  const origin = headersList.get("origin") ?? `https://${headersList.get("host")}`;

  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: user.email ?? undefined,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: { name: `${gemPackage.name} — ${gemPackage.gem_amount} gems` },
          unit_amount: gemPackage.price_cents,
        },
        quantity: 1,
      },
    ],
    metadata: {
      user_id: user.id,
      package_id: gemPackage.id,
      gem_amount: String(gemPackage.gem_amount),
      price_cents: String(gemPackage.price_cents),
    },
    success_url: `${origin}/gems/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/gems?cancelled=1`,
  });

  if (!session.url) {
    return { error: "Could not start checkout. Please try again." };
  }

  redirect(session.url);
}
