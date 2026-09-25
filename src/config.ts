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
// Every place that shows a coin or gem amount reads its emoji/label
// from here.
export const CURRENCY = {
  coin: { label: "Coins", emoji: "🪙" },
  gem: { label: "Gems", emoji: "💎" },
};


// ─── 3. FEATURE FLAGS ────────────────────────────────────────────
// Trading (src/app/trades/, migrations 0015-0017) is fully built and
// tested but disabled for now while a fixed-price marketplace is
// used instead — see README "Build status". Flip this back to true
// to re-enable it; nothing else needs to change. Every trading nav
// link, button, and page checks this flag, so flipping it is the
// whole re-enable.
export const TRADING_ENABLED = false;


// ─── 4. GAMEPLAY DISPLAY CONSTANTS (mirror only, see note above) ──
export const BREEDING_COST = 200; // enforced in supabase/migrations/0040_breeding.sql: start_breeding()
