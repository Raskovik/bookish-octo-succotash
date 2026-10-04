import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * The only thing that actually credits gems — gems/actions.ts just
 * starts a Checkout Session, it never grants anything itself. Stripe
 * calls this directly (no player session involved), so the webhook
 * signature check below is the real auth boundary here, not RLS or a
 * logged-in user — see the comment on credit_gems_from_purchase
 * (0045_gem_purchases.sql) for why that RPC is grantable only to
 * service_role.
 *
 * Route Handlers in the App Router never auto-parse the body (unlike the
 * old Pages API's bodyParser), so request.text() below already gets the
 * exact raw bytes Stripe signed — no extra config needed for that.
 */
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Webhook not configured." }, { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripeClient().webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const { user_id, package_id, gem_amount, price_cents } = session.metadata ?? {};

    if (!user_id || !package_id || !gem_amount || !price_cents) {
      // Shouldn't happen — every session we create sets all four — but
      // acknowledge rather than retry forever on a session we didn't
      // originate (metadata would never materialize on a retry).
      return NextResponse.json({ received: true });
    }

    const paymentIntentId =
      typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null);

    const { error } = await createServiceClient().rpc("credit_gems_from_purchase", {
      p_user_id: user_id,
      p_package_id: package_id,
      p_gem_amount: Number(gem_amount),
      p_price_cents: Number(price_cents),
      p_stripe_checkout_session_id: session.id,
      p_stripe_payment_intent_id: paymentIntentId,
    });

    if (error) {
      // Non-200 so Stripe retries — this is the one failure mode where
      // retrying is exactly right (a transient DB issue), as opposed to
      // the missing-metadata case above, which would never succeed no
      // matter how many times Stripe resends it.
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
