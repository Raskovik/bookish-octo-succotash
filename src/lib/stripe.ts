import Stripe from "stripe";

// A singleton, not a per-request client — the Stripe SDK is stateless
// aside from the API key, same reasoning as any other server-side SDK
// client in this app. Reads STRIPE_SECRET_KEY lazily (not at module load)
// so the app doesn't crash on boot in an environment that hasn't set it
// yet — gems/actions.ts checks for its presence itself and returns a
// friendly error instead of calling this at all when it's missing.
let stripeClient: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (!stripeClient) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error("STRIPE_SECRET_KEY is not set.");
    }
    stripeClient = new Stripe(secretKey);
  }
  return stripeClient;
}
