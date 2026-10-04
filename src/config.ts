// ═════════════════════════════════════════════════════════════════
//  SITE CONFIG — the one file to edit for site identity, currency
//  labels, and feature toggles.
//
//  Unlike a static site (e.g. lookbook's src/config.mjs), Furgarden
//  is a live Next.js + Supabase app, so this file does NOT cover
//  everything a site config might elsewhere:
//    - Colors and layout live as Tailwind classes directly in each
//      component (there's no small set of theme variables to swap —
//      see the "Furgarden rebrand" note in globals.css).
//    - Gameplay numbers that are actually enforced (costs, rewards,
//      timers) live in the Supabase migrations under supabase/migrations/,
//      since the database — not the browser — is what charges players.
//      A few constants below just mirror those for display; keep them
//      in sync by hand if you change the matching RPC.
// ═════════════════════════════════════════════════════════════════


// ─── 1. BASICS ───────────────────────────────────────────────────
export const SITE_NAME = "Furgarden";
export const SITE_TAGLINE = "Adopt, hatch, and trade virtual pets.";

// Text in the bar at the bottom of every page.
export const FOOTER_TEXT = `${SITE_NAME} — a hobby project, not affiliated with any real pet.`;


// ─── 2. CURRENCY ─────────────────────────────────────────────────
// Every place that shows a coin or gem amount goes through
// <CurrencyIcon> (src/components/currency-icon.tsx), which reads
// its emoji/label/image from here.
//
// To use a picture instead of the emoji: drop a square image at
// public/icons/coin.png (and/or gem.png — that folder already holds
// the site's other small icons), then set `image` below to
// '/icons/coin.png'. Leave `image` as null to keep the emoji.
export const CURRENCY = {
  coin: { label: "Coins", emoji: "🪙", image: null as string | null },
  gem: { label: "Gems", emoji: "💎", image: null as string | null },
};
export type CurrencyKind = keyof typeof CURRENCY;


// ─── 3. FEATURE FLAGS ────────────────────────────────────────────
// Trading (src/app/trades/, migrations 0015-0017) was disabled for a
// while in favor of the fixed-price marketplace, then re-enabled so
// players have a way to trade gems for coins (or anything else)
// peer-to-peer alongside buying gems outright — see the gem purchase
// system below. Flip back to false to hide it again; nothing else
// needs to change.
export const TRADING_ENABLED = true;

// Brewing (src/app/brewing/, /admin/recipes, migrations 0006/0008) is
// fully built and tested but hidden for now per a change of direction —
// same on/off shape as TRADING_ENABLED above: flip this back to true to
// bring it back, nothing else needs to change. /brewing and every
// /admin/recipes page 404 while this is false, and its nav links (player
// "Play" menu, admin panel nav, admin dashboard card) disappear too.
export const BREWING_ENABLED = false;
