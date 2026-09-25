# Furgarden

A virtual pet adoption/collection game (Chicken Smoothie/Neopets-style): adopt
and hatch pets with layered customizable art, send them on expeditions, brew
potions, trade with other players, decorate a profile page, and post on the
forums.

Full product spec lives in project history; this README covers running what's
built so far.

## Tech stack

- **Framework:** Next.js (App Router, TypeScript)
- **Styling:** Tailwind CSS
- **Database + Auth + Storage:** Supabase (Postgres)
- **Authentication:** Google OAuth only, via Supabase Auth — no passwords
- **Hosting (dev/test):** Vercel, connected to GitHub for preview deploys

## Build status

This project is being built one module at a time. Current state:

- [x] Project skeleton — Next.js + Tailwind + Supabase wired up
- [x] Google sign-in (Supabase Auth), basic account settings, profile page
- [x] Starter pet + one-time tutorial expedition (species/pets/zones/
      expeditions schema, shown on the profile page)
- [x] Expeditions map — an "Expeditions" tab with a clickable map of
      explorable zones, pet-pool preview, starting a timed expedition (one
      per zone at a time), and a return-to-claim popup once it resolves
      (keep the reward or send it away)
- [x] Items + inventory — zones now sometimes drop a crafting item instead
      of a pet (blue = pet art, green = item art, for easy testing)
- [x] Potions & brewing — a "Brewing" tab: a 3-slot brewing stand players
      fill with owned ingredients, a recipe-book popup showing
      every fixed, shared recipe for reference/testing, and matching the
      slots against the book to start a brew — a fixed 2-minute timer,
      then return and claim the finished potion the same way as an
      expedition. Five potions total: shorter expedition timers, a higher
      chance of finding an item instead of a pet, and a chance of a bonus
      second reward. Purple potion art; real potions are consumed on the
      expeditions map to apply their effect
- [x] Admin panel & audit log — an "Admin" tab (visible only to you) for
      managing zones (incl. pet pool + loot table), items, species, and
      potion recipes (incl. ingredients), plus a read-only audit log of
      every admin write. See Notes below for the architecture and the
      one-time SQL snippet that makes your account the admin — there's no
      in-app way to grant admin to anyone else, by design
- [x] Admin image uploads & search-to-add — item/species edit pages now
      have a real file upload (PNG/JPEG/WebP/GIF, 5 MB max) that replaces
      the placehold.co placeholder art, backed by a new Supabase Storage
      bucket; and the "add to pool" / "add to loot table" / "add
      ingredient" pickers are now type-to-search instead of a giant
      dropdown, so they stay usable as the catalog grows
- [ ] Layered pet art rendering, accessory equip/unequip
- [x] Currency & den expansion — two currencies, coins (base) and gems
      (premium), shown on the profile page; no real-money purchase flow
      yet (a later module). Den size's flat 25 default is now the
      permanent free baseline (not a temporary testing value anymore) —
      an "Expand den" button on the profile page spends coins for +25
      more slots at a time, at an escalating cost. `/admin/currency` lets
      you grant yourself coins/gems for testing in the meantime
- [x] Pets/items split, pet folders, and pet naming — the old
      "Inventory" tab is now two separate tabs, "Pets" and "Items"
      (`/inventory` still works, just redirects to `/pets`). Pets can be
      grouped into folders like Flight Rising's lairs, shown as tabs on
      `/pets` (All / each folder / Unsorted), each paginated at 25 pets
      per page — create/rename/delete a folder, and move any pet into
      one via a dropdown on its card. The items page has type tabs (All
      / Ingredients / Potions / Cosmetics). Chicken Smoothie-style pet
      naming: every pet starts unnamed (no species-name placeholder
      shown in its place, just a "+ Name this pet" prompt) until the
      owner sets a nickname
- [x] `game-assets/` drop folder for real art — see
      [`game-assets/README.md`](./game-assets/README.md)
- [x] Cream/parchment theme + wood-sign header — the site-wide color
      palette moved from a cool gray (zinc) to a warm cream/amber one,
      and the header/nav was redesigned as a wood-plank bar with a
      distinct account panel, plus real icon art (recipe book, edit
      pencil, error banners) replacing emoji/placeholder shapes in a
      few spots. **Superseded by the wireframe page layout below** — the
      site-wide chrome (header/nav/footer/background) moved away from
      the amber gradient bar; individual page content (buttons, cards,
      etc.) still uses the amber accent palette described here. See
      Notes below for exactly what did and didn't change
- [x] Wireframe page layout — every page now renders inside a shared
      shell: a logo box (top-left, links home) and a user-info box
      (top-right) in the header, a grouped/foldable nav bar underneath,
      the actual page content in a centered white content box, and a
      footer bar — all wired once in the root layout, not per-page. The
      page background is a simple placeholder pattern for now, swappable
      for a real image later. See Notes below
- [x] Unique, rate-limited usernames — `display_name` is now a unique
      handle (case-insensitive) rather than a free-form label: no two
      accounts can share one, and changing it costs 15 gems and can only
      be done once every 14 days. See Notes below
- [ ] Statue offerings
- [~] Trading — **built, tested, but currently disabled** behind
      `TRADING_ENABLED` in `src/lib/feature-flags.ts` (set to `false`) —
      superseded by the Marketplace below per a later change of
      direction, kept intact rather than deleted in case it comes back.
      No nav link, no entry points anywhere, and every `/trades/*` route
      404s while disabled. See Notes below for what it was
- [x] Marketplace — Flight-Rising-style fixed-price listings (not a
      timed-bid auction): list a pet or a stack of items, anyone can buy
      instantly at the listed price. A listing can be priced in coins,
      gems, or both at once — the buyer picks whichever they'd rather
      pay with — and the seller chooses how long it runs (1/3/7/14/30
      days); it automatically unlists itself if nobody buys in time.
      `/marketplace` (browse, filterable by name/rarity/price),
      `/marketplace/sell` (list something via the same searchable picker
      trading used), `/marketplace/mine` (your active/sold/cancelled/
      expired listings and purchase history). See Notes below
- [x] Profile customization — the bio field on `/settings` now uses the
      same BBCode editor and renderer as the forums, so players can
      format their profile ("about me") with bold, colors, fonts, lists,
      the Chicken-Smoothie-style `[left]`/`[right]` image trick, and so
      on. See Notes below
- [x] Player dashboard & public profile redesign, player avatars — `/profile`
      and `/u/[id]` now use an asymmetric two-column layout (a narrower
      picture/name/stats/actions column on the left, a wider "my stuff"/bio
      column on the right, since bio content benefits from the room far
      more than a picture and a few stats do), and a new "My Stuff" nav
      tab holds Pets/Items. Avatars are square, not circular. New players
      no longer get their Google account photo imported as their avatar —
      they start with none, and can upload their own from `/settings`.
      Den expansion moved off the dashboard onto `/pets`, next to the pet
      count it actually affects. See Notes below
- [x] Forums — admin-managed categories (and one level of subcategories,
      each with an optional icon), threads, and posts, styled after a
      classic phpBB/Chicken-Smoothie-style forum: a Quick Jump sidebar,
      a Forum Index panel, pinned/regular topic lists with view and
      reply counts, and paginated thread views. Players write posts with
      a BBCode editor — a toolbar (bold/italic/underline/strike, quote,
      horizontal rule, alignment, font size, font color) that inserts
      tags into a plain textarea, so typing tags by hand works exactly
      the same as clicking a button. **Superseded the original WYSIWYG-
      or-raw-HTML editor** (TipTap + an HTML sanitizer) — see Notes below
      for why the BBCode approach replaced it and how it's now the
      security boundary instead. No video/audio/iframe embeds exist as a
      BBCode tag at all (links to them are still fine)
- [x] Direct messages — private, one-on-one conversations between players,
      styled to match the forums rather than a chat app: `/messages` is
      an inbox panel (a `ForumPanel`, same header bar as everywhere in
      the forums) with a thread-table row per conversation — unread/read
      envelope icon, avatar, name, last-message snippet — sorted by most
      recent activity, plus a "message a player by username" box. A Mail
      icon in the header shows an unread-count badge from anywhere on the
      site. `/messages/[conversationId]` renders each message the same
      way a forum post renders (avatar-and-name column on the left,
      timestamp and body on the right, bordered rows) rather than
      chat-style bubbles, with a reply box below styled like the forums'
      own reply panel. The "Send DM" button on `/u/[id]` opens (or
      starts) a conversation with that player directly. Plain text, not
      BBCode — messages aren't posts. Built with reuse in mind: the same
      conversation/message shape and read-tracking approach can back a
      reports system or a notifications system later, without either
      needing this table itself. See Notes below
- [x] Moderator tools & a reports system — a new `is_moderator` role,
      deliberately kept separate from `is_admin`: `/mod` (reports queue,
      forum pin/lock/delete) is reachable by a moderator OR an admin;
      `/admin` (economy/catalog management, the audit log) stays
      admin-only. An admin gets both, a moderator-only account only ever
      sees "Mod Tools" in the nav, never "Admin". Players can report a
      player (`/u/[id]`) or a forum post, picking a reason category plus
      optional details; staff review open reports in `/mod/reports` and
      resolve, dismiss, or delete the reported post outright. Forum
      thread pin/lock (previously admin-only) and a new delete capability
      for threads/posts are now moderator powers too. See Notes below
- [x] Moderator tools round two — filing a report now sends an automatic
      DM acknowledgment from a "Staff Team" account; a forum post reported
      by 5 distinct players auto-hides pending review (plus a staff-only
      "test" button that simulates this without needing 5 real reports);
      staff can send a canned or custom warning DM to a player, sent as
      their own account but visually marked as staff; `/mod/players/
      [userId]` shows a player's full report history and DM conversation
      list, 100% staff-only; a staff edit of someone else's post shows
      "Edited by a moderator/an admin" instead of their name; moderator
      names render green and admin names deep blue everywhere a display
      name appears; DM messages are now reportable too, staff can read
      (not write) any DM conversation for review, and `/messages/
      [conversationId]` now paginates like the forums and opens to
      wherever the player's unread messages start instead of always page
      1. See Notes below
- [x] Moderator tools round three — staff warning DMs (and a new "quick
      quote" tool) now always send from the Staff account instead of the
      acting moderator's own, so mods stay anonymous to players; the
      canned warning messages are now admin-managed (`/admin/
      canned-messages`) instead of hardcoded; moderators can edit a
      thread's title from the same moderation popover as pin/lock; and a
      full time-based ban system — DM, sales, forums, and account bans
      (account bans admin-only to issue), each independently issued/
      lifted with a duration and reason, enforced at the database layer
      and blocking sign-in itself for an account ban. See Notes below
- [x] Simpler report handling — two follow-up rounds (grouped "tickets"
      with claiming/dedup/notes, then a full invisible-staff/escalation/
      appeals/support-tickets overhaul) turned out to feel too complex
      and were reverted. Replaced with: reporting is now a modal popup
      that offers to block the offending player right after you submit;
      a single dedicated `/mod/reports/[reportId]` page per report shows
      the offending player's info, private staff notes, and past reports
      alongside the report itself, a message box, and handling buttons
      (Dismiss/Verbal Warning/Forums Ban/DMs Ban/Sales Ban) — picking one
      reveals a "Confirm and Send" / "Escalate to Admin" bar. See Notes
      below
- [x] Report claiming, restored + editable player notes — brought back
      ticket claiming (any staff member, no ownership lock on unclaim)
      from the reverted round, and let a staff member edit a player note
      they wrote earlier. See Notes below
- [x] Pets tab rework + pet detail page — a modernized, image-forward
      grid (a Flight-Rising-lair-inspired but decluttered version — the
      rename/folder/for-trade controls that used to live on every card
      moved to a new `/pets/[petId]` page) that shows a pet's full info
      (species, rarity, color, adopted date, ID) and a player-editable,
      BBCode-supported bio. See Notes below
- [x] Furgarden rebrand — the site is now named Furgarden (page title,
      footer, this README's own title), the real hero banner is live on
      the homepage (`public/ui/furgarden-hero.png`), the whole `amber-*`
      Tailwind accent palette became `green-*` sitewide, and a follow-up
      pass brought the header/nav/footer/page background in line too:
      brown borders on the logo/account/nav chrome, a brown footer, and
      a sky-to-grass gradient backdrop replacing the flat blue one — all
      echoing the hero's own sky/grass/brown-outline palette. See Notes
      below
- [x] Gardening — a new `/garden` page: 3 starting rows of 5 plots (more
      rows purchasable at an escalating coin cost, shown greyed-out/locked
      until bought), a planting pop-up listing a player's seed and
      fertilizer inventory, watering (once per 8 hours, a plant stops
      growing and shows a droplet icon when it needs water), wilting (no
      water for 72 hours after it's needed kills the plant for no reward),
      three visual growth stages over a 3-day total grow time, and two
      kinds of seeds (grows one specific plant, or rolls from a weighted
      pool of several). New admin tooling manages the plant/seed/
      fertilizer catalog. See Notes below
- [x] Shop — a new `/shop` page: any item can be marked for sale with an
      admin-set coin price (a new field right next to sell value on the
      item edit form), and the shop lists everything currently priced
      (only the two seed items so far, since that's what was asked for)
      with a Buy button. New admin tooling also adds live thumbnail
      previews next to each garden plant's growth-stage image fields,
      so editing them (already possible) is easier to see at a glance.
      See Notes below
- [x] Garden plants now have 4 growth stages (widened from 3) — a 4th
      `image_stage4_url` field on `/admin/garden-plants`, and the
      client-side stage calc split into quarters instead of thirds so
      plots visually progress through all four. See Notes below
- [x] Trait-based breeding — pets are no longer one fixed species image.
      A new `breeds`/`colors`/`patterns`/`eye_types` catalog (with new
      `/admin/breeds`, `/admin/colors`, `/admin/patterns`,
      `/admin/eye-types` screens) composites a pet's look server-side
      from 5 independent traits; a new `/breeding` page lets two same-
      breed, opposite-gender pets nest an egg that inherits or mutates
      each trait independently. Zones no longer grant pets at all —
      only items — and every player now starts with two breedable
      starter pets instead of one. Existing pets are grandfathered
      unchanged. See Notes below

---

## Getting started (complete walkthrough)

This section assumes you've never done this before and walks through every
step: creating accounts, clicking through dashboards, and the exact values to
copy where. It's long on purpose — follow it top to bottom and skip nothing.

You'll end up with three free accounts/tools if you don't have them already:
**Node.js** (to run the code on your computer), a **Supabase** account (the
database, login system, and file storage), and a **Google Cloud** account
(so "Sign in with Google" works). Deploying it live later uses a fourth,
**Vercel**.

### Step 0: Install prerequisites

You need **Node.js** (version 20 or later) installed on your computer to run
this project locally.

- Go to [nodejs.org](https://nodejs.org) and download the "LTS" version for
  your operating system, then run the installer.
- Confirm it worked by opening a terminal (on Mac: Terminal app; on Windows:
  Command Prompt or PowerShell) and running:
  ```bash
  node -v
  ```
  You should see something like `v20.x.x` or higher print out. If you get a
  "command not found" error, the install didn't finish correctly — try
  reinstalling, or restart your terminal/computer.

You also need **git** and a copy of this code on your computer. If you're
reading this file already inside a cloned copy of the repository, you can
skip to Step 1. Otherwise:

```bash
git clone <this repository's URL>
cd bookish-octo-succotash
```

Then install the project's dependencies:

```bash
npm install
```

This downloads everything listed in `package.json` into a `node_modules`
folder. It's normal for this to take a minute and print some warnings.

### Step 1: Create a Supabase account and project

Supabase is a hosted Postgres database that also handles login ("auth") and
file storage for us, so we don't have to run our own database server.

1. Go to [supabase.com](https://supabase.com) and click **Start your
   project** (or **Sign in**). Sign up with GitHub or email — it's free.
2. Once logged in, you'll land on the Supabase dashboard. Click **New
   project**.
3. You may first be asked to create an **Organization** — if so, just give
   it any name (e.g. your username) and continue.
4. Fill in the "Create a new project" form:
   - **Name**: anything you like, e.g. `virtual-pet-site`.
   - **Database Password**: click "Generate a password" and then **copy it
     somewhere safe** (a notes app, password manager). You likely won't need
     it for this guide, but you will if you ever connect a database tool
     directly.
   - **Region**: pick whichever is closest to you geographically.
   - Leave the pricing plan on **Free**.
5. Click **Create new project**. It takes 1-2 minutes to provision — you'll
   see a progress screen. Wait for it to finish before continuing.

### Step 2: Copy your Supabase API keys

1. In your new project's dashboard, look at the left sidebar and click the
   gear icon **Project Settings** (near the bottom).
2. Click **API** in the settings sub-menu (in newer dashboards this may be
   under a section called **API Keys** or **Data API**).
3. You'll see a **Project URL** — it looks like
   `https://abcdefghijklmno.supabase.co`. Copy it.
4. Further down (or on the "API Keys" tab) you'll see an **anon** /
   **public** key — a long string starting with `eyJ...`. Copy it too.
   (Do **not** copy the `service_role` / secret key for this — that one must
   never be shared or put in frontend code.)

Keep this browser tab open — you'll come back to it in Step 4 and Step 6.

### Step 3: Run the database migration

This creates the `users` table and related security rules that the app
needs — without this step, sign-in will appear to work but the app will
error when it tries to load your profile.

1. In the Supabase dashboard sidebar, click **SQL Editor**.
2. Click **New query**.
3. Open the file
   [`supabase/migrations/0001_init_users.sql`](./supabase/migrations/0001_init_users.sql)
   in this repository (in your code editor, or on GitHub), select all of its
   contents, and copy it.
4. Paste the whole thing into the Supabase SQL Editor.
5. Click **Run** (or press Ctrl/Cmd+Enter). You should see "Success. No rows
   returned" at the bottom. If you see a red error instead, see
   [Troubleshooting](#troubleshooting) below.

This one file sets up everything phase 1 needs: the `users` table, the
security rules (RLS policies) that keep each user's private data private,
and a trigger that automatically creates a profile row the first time
someone signs in.

Future development phases add more `.sql` files to that same folder — run
each new one the same way (SQL Editor → New query → paste → Run), **in
filename order**, since later files sometimes alter or build on earlier
ones. If your project already has `0001_...` applied and a new
`0002_...` (or later) file shows up in this repo, you only need to run the
new one — you don't need to re-run files you've already applied.



### Step 4: Set your environment variables

Environment variables are how the app gets your Supabase project's URL and
key without hard-coding secrets into the source code.

1. Back in your terminal, in the project folder, run:
   ```bash
   cp .env.local.example .env.local
   ```
2. Open the new `.env.local` file in a text editor. Replace the placeholder
   values with the **Project URL** and **anon public key** you copied in
   Step 2:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmno.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...your-long-key-here
   ```
3. Save the file. `.env.local` is already excluded from git (see
   `.gitignore`), so it will never be committed or pushed — this is
   intentional, since it's specific to your machine/project.

### Step 5: Create a Google OAuth Client (so "Sign in with Google" works)

This is the fiddliest step, so follow it carefully. You're creating
credentials that let Supabase ask Google "is this person who they say they
are?" on your app's behalf.

**5a. Create (or select) a Google Cloud project**

1. Go to the [Google Cloud Console](https://console.cloud.google.com/). Sign
   in with any Google account.
2. At the top of the page, click the project dropdown (it may say "Select a
   project" or show an existing project name) and click **New Project**.
3. Give it a name, e.g. `virtual-pet-site`, and click **Create**. Wait a
   few seconds for it to be created, then make sure it's selected in that
   same dropdown at the top.

**5b. Configure the OAuth consent screen**

Google requires this before it will let you create credentials.

1. In the left sidebar (or the search bar at the top), find **APIs &
   Services → OAuth consent screen**.
2. Choose **User Type: External** (this lets any Google account sign in,
   which is what a public game site needs), then click **Create**.
3. Fill in the required fields:
   - **App name**: e.g. `Virtual Pet Site`
   - **User support email**: your email address
   - **Developer contact information**: your email address again
   - Everything else on this screen can be left blank/default.
4. Click through **Save and Continue** on the following screens (Scopes,
   Test users, Summary) without changing anything — the defaults are fine
   for development. You don't need to submit the app for Google's
   verification review to use it yourself or with a small group.

**5c. Create the OAuth Client ID**

1. In the left sidebar, go to **APIs & Services → Credentials**.
2. Click **+ Create Credentials** at the top, then choose **OAuth client
   ID**.
3. **Application type**: choose **Web application**.
4. **Name**: anything, e.g. `Supabase Auth`.
5. Under **Authorized redirect URIs**, click **+ Add URI**. This is the
   important part — go back to your Supabase dashboard tab, open
   **Authentication → Sign In / Providers → Google** (you may need to
   expand "Google" in the list of providers), and copy the **Callback URL
   (for OAuth)** shown there. It looks like:
   ```
   https://abcdefghijklmno.supabase.co/auth/v1/callback
   ```
   Paste that exact URL into the Google Cloud "Authorized redirect URIs"
   field.
6. Click **Create**. A dialog pops up showing your **Client ID** and
   **Client Secret** — copy both (or leave the dialog open; you can also
   find these later on the Credentials page by clicking the client you just
   created).

**5d. Give Supabase the Client ID and Secret**

1. Back in the Supabase dashboard, on that same **Authentication → Sign In /
   Providers → Google** screen:
   - Toggle Google **on** (Enabled).
   - Paste the **Client ID** and **Client Secret** from step 5c into the
     matching fields.
   - Click **Save**.

**5e. Tell Supabase which URLs are allowed to receive the login redirect**

1. Still in Supabase, go to **Authentication → URL Configuration**.
2. Set **Site URL** to `http://localhost:3000` for now (you'll add your
   live production URL here too, once you deploy — see Step 7).
3. Under **Redirect URLs**, add:
   ```
   http://localhost:3000/auth/callback
   ```
   You can add more than one entry here (e.g. your Vercel URL later) — it's
   an allow-list, not a single value.
4. Click **Save**.

### Step 6: Run the app locally

```bash
npm run dev
```

Leave that running, then open [http://localhost:3000](http://localhost:3000)
in your browser. Click **Sign in**, then **Continue with Google**, and
complete the Google login popup/redirect. You should land back on the site,
signed in, on your profile page.

If anything goes wrong, check [Troubleshooting](#troubleshooting) below —
auth setup is the single most common thing to get slightly wrong on the
first try, and almost every failure mode has a specific fix there.

### Step 7 (optional): Deploy it live with Vercel

Vercel is a hosting service made by the creators of Next.js; connecting it
to your GitHub repository gives you a live URL and automatic "preview"
deployments for every branch/PR.

1. Push this repository to GitHub if it isn't already there.
2. Go to [vercel.com](https://vercel.com) and sign up/log in (using your
   GitHub account is easiest).
3. Click **Add New… → Project**, then find and **Import** your GitHub
   repository. Vercel auto-detects it's a Next.js app — you don't need to
   change any build settings.
4. Before clicking Deploy, expand **Environment Variables** and add the
   same two variables from your `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Click **Deploy**. After it finishes, Vercel gives you a URL like
   `https://your-project.vercel.app`.
6. Update Supabase and Google so the live URL is allowed to sign in:
   - In Supabase **Authentication → URL Configuration**, add
     `https://your-project.vercel.app/auth/callback` to **Redirect URLs**
     (keep the localhost one too), and consider updating **Site URL** to
     your production domain once you have one you consider "final."
   - In Google Cloud **Credentials**, open your OAuth client from Step 5c
     and add `https://your-project.vercel.app` to Authorized JavaScript
     origins if prompted, and confirm the redirect URI list still contains
     your Supabase callback URL (it doesn't change — Google always redirects
     to Supabase, which then redirects to your app, so you generally only
     add new entries in Supabase's Redirect URLs, not in Google, when adding
     a new deployment domain).
7. Redeploy (or just push a new commit) after changing environment
   variables in Vercel — they only take effect on the next build.

---

## Troubleshooting

**"Error: Failed to load profile for the signed-in user" / a blank/error
page right after logging in**
The database migration (Step 3) probably wasn't run, or failed partway. Open
Supabase's **Table Editor** and check whether a `users` table exists under
the `public` schema. If not, re-run the SQL from
`supabase/migrations/0001_init_users.sql` in the SQL Editor and read the
error message it gives you — a common cause is running it twice (the second
run fails because the table/trigger already exists, which is harmless, but
means the first run likely already succeeded).

**Clicking "Continue with Google" does nothing, or shows a Supabase error
page like "Unsupported provider"**
Google sign-in isn't enabled/saved correctly in Supabase. Revisit Step 5d —
make sure the toggle is switched on and you clicked **Save** after pasting
the Client ID/Secret.

**Google shows "Error 400: redirect_uri_mismatch"**
The URL in Google Cloud Console's "Authorized redirect URIs" doesn't exactly
match Supabase's callback URL. Go back to Supabase **Authentication → Sign
In / Providers → Google** and re-copy the callback URL exactly (including
`https://` and no trailing slash), then update it in Google Cloud
**Credentials**. This is the single most common setup mistake.

**After logging in with Google, you land on an error page instead of
`/profile`, or get redirected back to `/login`**
Check Supabase **Authentication → URL Configuration**: your app's URL (e.g.
`http://localhost:3000/auth/callback`) must be listed under **Redirect
URLs**, exactly, including the `/auth/callback` path.

**`npm run dev` fails immediately, or the page shows a Supabase connection
error**
Double check `.env.local` exists (not just `.env.local.example`), has no
extra quotes or spaces around the values, and that you restarted `npm run
dev` after creating/editing it — Next.js only reads env vars at startup.

**You want a clean slate**
You can safely delete and re-run the SQL migration if something's broken,
or delete rows from the `users` table (Table Editor) to force the
auto-provisioning trigger to re-create a profile the next time that person
signs in.

---

## Notes for future modules

- Every admin-only action must check `is_admin` server-side (Server
  Component, Server Action, or Route Handler) — never trust client state.
  `proxy.ts` only refreshes the Supabase session cookie; it is not an
  authorization boundary.
- User-submitted profile CSS/HTML (not yet built) must be sanitized with a
  library like DOMPurify both before storage and before render, and scoped
  (container or sandboxed iframe) so it can't affect the rest of the site.
- Trading must be implemented as a single atomic database transaction (e.g.
  a Postgres function called via RPC) to avoid duplication or race
  conditions.
- Expeditions resolve **lazily**: there's no background job/cron in this
  phase, so `resolve_due_expeditions` runs on every profile/expeditions
  page load and settles any expedition whose timer has already elapsed.
  The countdown components also refresh their route once they hit zero,
  so a player watching the page sees it resolve without needing to
  manually reload. A real scheduled job (e.g. Supabase's pg_cron, or a
  Vercel Cron Job hitting a route handler) could replace or supplement
  this later if expeditions need to "complete" even while nobody has the
  page open (e.g. for push notifications) — not needed for the current
  feature set.
  - The tutorial expedition still auto-grants its pet the moment it
    resolves (unchanged, one-time onboarding step).
  - Non-tutorial (map) expeditions do **not** auto-grant on resolution
    anymore: `resolve_due_expeditions` rolls the species and parks it on
    the row as `pending_species_id` with `status = 'awaiting_claim'`, and
    only `claim_expedition_reward` (called from the "keep"/"send it away"
    buttons in `ClaimRewardModal`) either turns it into an actual pet or
    discards it. The roll itself happens once, at resolution time, not at
    claim time — re-opening the zone or the popup can't reroll it, only
    defer the keep/release decision. A zone (and the sent pet) stays
    locked from `start_expedition` for as long as an expedition sits in
    either `in_progress` or `awaiting_claim` — a player has to claim
    before sending that zone's next pet.
- Any privileged column on `users` (`is_admin`, `currency_balance`,
  `den_size`, `starter_granted`, …) is protected from direct client writes
  by a trigger (`protect_privileged_user_fields`, in
  `0001_init_users.sql`, extended in `0002_...sql`). Server-side game logic
  that legitimately needs to write one of these columns must call
  `begin_trusted_user_write()` first, in the same transaction — see
  `grant_starter_pet_and_tutorial` in
  `supabase/migrations/0002_pets_and_tutorial_expedition.sql` for the
  pattern. Forgetting this makes the write silently no-op (the trigger
  reverts it to the old value) rather than error, so if a future migration
  adds a new privileged column and a write to it seems to do nothing, this
  is the first thing to check.
- A zone "sometimes" dropping an item instead of a pet isn't a separate
  probability field anywhere — `pick_weighted_zone_reward` (in
  `0005_items_and_inventory.sql`) just runs the same weighted draw across
  a zone's `zone_pet_pool` **and** `zone_loot_table` rows combined. There's
  no admin-facing "pet vs. item chance" knob to build later; the mix is
  whatever each row's `drop_weight` implies, in whichever table. The
  tutorial's own roll (`grant_starter_pet_and_tutorial`) deliberately
  keeps using the older pet-only `pick_weighted_zone_species` instead, so
  it can never hand out an item — that's enforced by which function it
  calls, not just by the tutorial zone having no loot table rows.
- Items are crafting ingredients only (`item_type`: `ingredient` today;
  `cosmetic`/`potion` exist in the enum for later modules but aren't used
  yet). There's intentionally no `pet_accessories`-style equip mechanic
  for them — that's a separate future system for actual cosmetic items,
  not these.
- The rarity enum was renamed `pet_rarity` → `rarity_tier` in
  `0005_items_and_inventory.sql` once items needed the same tiers as pets.
  It's a metadata-only rename (`ALTER TYPE ... RENAME TO`) — no data
  migration needed, and the TypeScript side still calls it `PetRarity`
  (with an `ItemRarity` alias) rather than renaming every call site.
- **Ambiguous embeds**: a Supabase/PostgREST `select("...,items(...)")`
  only works unhinted while there's exactly one relationship path between
  the two tables — and that's true in **two** distinct shapes here, both
  needing the same fix but for different reasons:
  1. **Two direct FKs to the same table.** `expeditions` has two FKs to
     `items` (`pending_item_id`, `result_item_id`), so a plain
     `items(...)` embed from `expeditions` is ambiguous. Fixed in
     `claim-reward-modal.tsx` with `items!expeditions_pending_item_id_fkey(...)`.
     `pets` has the same latent double-FK from `expeditions` (`pet_id`,
     `result_pet_id`) — nothing embeds `pets` from `expeditions` yet, but
     the next query that does will need the same hint.
  2. **A direct FK *plus* a many-to-many path through a junction table.**
     `potion_recipes` has one direct FK to `items`
     (`output_potion_item_id`), but `potion_recipe_ingredients` has FKs to
     *both* `potion_recipes` and `items` — PostgREST treats that as a
     second, implicit many-to-many relationship between them. So
     `potion:items(...)` embedded from `potion_recipes` (directly on
     `/brewing`, and nested inside `potion_recipes(items(...))` when
     reading a brew's potion from `potion_brews`) was ambiguous the exact
     same way, fixed in `brewing/page.tsx` with
     `items!potion_recipes_output_potion_item_id_fkey(...)`. This shape is
     easy to miss: a plain `pg_constraint` count *between the two tables
     you're embedding* looks fine (exactly one FK) — you only find it by
     also checking whether some third table has FKs to both sides. Any
     table with a junction table to another (`zone_pet_pool`,
     `zone_loot_table`, `potion_recipe_ingredients`, …) is safe to embed
     *from that junction table itself* (only one path exists looking
     outward from the many-side); the risk is only when embedding
     *from the "one" side that also has its own direct FK* to the same
     target.

  In both shapes: this never fails typecheck or build, since the embed
  string is just a string — it only surfaces when the query actually
  runs. Find the real constraint name rather than guessing at it:
  `select conname from pg_constraint where conrelid = '<table>'::regclass
  and confrelid = '<target>'::regclass;` for shape 1, or
  `... where conrelid = '<junction_table>'::regclass` (no `confrelid`
  filter) to see every table a junction connects, for shape 2.
- Species/zone art currently just points at
  [placehold.co](https://placehold.co) placeholder images, and zone/species
  names and descriptions are explicitly placeholder text (not real game
  content) — both are meant to be replaced once real art assets exist and
  the admin panel can manage them.
- Potions are real (`0006_potions_and_brewing.sql`, effects extended in
  `0008_potion_effects_and_brew_timers.sql`): the expeditions map's potion
  dropdown passes the chosen potion's item id as `start_expedition`'s
  `p_potion_item_id`, which looks up that potion's recipe for its
  `effect_type`/`effect_magnitude`, consumes one from `user_inventory`,
  and applies it — still never a guarantee, just a shifted range/chance,
  per spec. Four effect types now exist:
  - `duration_reduction`: shaves that fraction off the randomized 2-3
    minute base roll.
  - `item_find_boost`: multiplies item (not pet) weights in
    `pick_weighted_zone_reward`'s roll, biasing toward finding an item.
  - `double_reward_chance`: sets the probability (in place of the 5% base
    every non-tutorial expedition already has) that resolving rolls a
    bonus second reward, granted alongside the primary one if — and only
    if — the player keeps it; releasing forfeits both.
  - `rarity_boost` is still defined in the enum and a potion can be
    brewed with it, but nothing reads it — it's for biasing toward rarer
    outcomes *within* a pool, a different idea from `item_find_boost`
    (which biases pet-vs-item at the top level), and not implemented yet.

  Because `item_find_boost`/`double_reward_chance` are consumed at
  `start_expedition` time but only matter later at `resolve_due_expeditions`
  time, `expeditions` carries `item_find_bias` / `double_reward_chance` /
  `is_double_reward` columns to bridge that gap — purely internal
  bookkeeping the app never queries directly. `claim_expedition_reward`'s
  return type changed from a plain pet id to jsonb
  (`{granted_pet_id, bonus_kind?, bonus_name?, bonus_image_url?}`) so the
  claim popup can show a "🎉 double reward!" screen when a bonus was
  granted.
- Recipes are fixed and identical for every player — no per-user
  discovery/unlock state, matching spec ("no player-driven discovery at
  launch"). The recipe book (book icon on `/brewing`) shows every active
  recipe to everyone unconditionally; new recipes are added via
  `/admin/recipes` now (see the Admin panel notes below) the same way
  zones/items/species are.
- The slot-filling UI (`brewing-stand.tsx`) is a **client-side staging
  area only** — dragging/clicking ingredients into the 3 slots doesn't
  touch the database at all. It just computes, locally, whether the
  slots' contents exactly match some recipe's ingredient list, and if so
  enables "Start brewing", which calls `start_brew(recipe_id)` —
  re-verifying ownership and doing the atomic deduct server-side,
  regardless of how the client arrived at that recipe id. This matters
  for one thing: the UI has exactly **3 slots**, a hard cap — a recipe
  needing more than 3 total ingredient units (e.g. 2 of one item + 2 of
  another) could never be assembled by a player even though the database
  would happily store such a recipe. Keep future recipes at 3 total units
  or fewer, or grow `SLOT_COUNT` if that constraint ever needs to change.
- Brewing is timed, mirroring expeditions: `start_brew` spends the
  ingredients immediately and opens a `potion_brews` row
  (`in_progress` → `awaiting_claim` → `completed`, same lazy
  `resolve_due_brews` pattern as `resolve_due_expeditions` — called on
  every `/brewing` page load), with a **fixed** 2-minute timer (not
  randomized like expedition duration — brewing is a deliberate recipe
  pick, not a loot roll, so there's nothing to vary). Only one brew at a
  time per player, since there's one physical stand. Unlike expedition
  claims, `claim_brew` has no keep/release choice — you already spent the
  ingredients on purpose, so there's no reason to decline the result;
  clicking "Collect" always grants it. `brew_potion` from 0006 no longer
  exists (dropped in 0008) — it's fully replaced by
  `start_brew`/`resolve_due_brews`/`claim_brew`.
- **A real `ALTER TYPE ... ADD VALUE` gotcha, hit in
  `0008_potion_effects_and_brew_timers.sql`**: Postgres refuses to let a
  brand-new enum value be *used* — not just referenced inside a stored
  function body, but actually cast as data (e.g. in an `INSERT`) — within
  the same transaction that added it. Earlier migrations only ever
  referenced new enum values inside `plpgsql` function bodies, which
  aren't evaluated until a later, separate call, so this never came up.
  0008 seeds potion rows using the two enum values it just added in the
  same file, which — when the whole file runs as one implicit transaction
  (verified locally with `psql -1`, which is how Supabase's SQL Editor
  behaves when you paste and run a multi-statement script) — hit exactly
  this error. Fixed with an explicit `commit;` right after the
  `ALTER TYPE` statements, forcing them to land before anything later in
  the file can touch them, regardless of how the file is executed. Any
  future migration that both adds an enum value **and** inserts/updates a
  row using that value needs the same `commit;` in between.
- `users.den_size` was raised from 3 to **25** in `0006_potions_and_brewing.sql`,
  originally called out there as a temporary testing value to lower back
  down later. `0011_currency_and_den_expansion.sql` settled that instead
  of reverting it: 25 is now the permanent free baseline, with real
  coin-based expansion (`expand_den`) built on top — see the Currency &
  den expansion note below.
- A next/image quirk worth knowing if you add more images: Tailwind's
  Preflight CSS resets `img { height: auto }` globally, which fights with
  next/image's fixed `width`/`height` props unless you *also* pin both
  dimensions via a matching Tailwind class (e.g. `width={64} height={64}
  className="h-16 w-16"`) — otherwise Next.js logs an "either width or
  height modified, but not the other" warning in dev. Images using `fill`
  instead of `width`/`height` aren't affected (its inline styles already
  win over Preflight).
- **Admin panel (`0009_admin_panel.sql`, `/admin/*`)** — scoped to the
  systems that already exist: zones (+ pet pool + loot table), items,
  species, and potion recipes (+ ingredients). Shop/economy config, statue
  offerings, and user support tools aren't included yet since those
  modules don't exist.
  - **You are the only admin, by design** — there's no "manage other
    admins" UI anywhere in the app, on purpose (that was an explicit
    requirement, not an oversight). The only way `is_admin` ever becomes
    `true` is a one-time SQL statement you run yourself:
    ```sql
    update public.users set is_admin = true where email = 'you@example.com';
    ```
    Run this once in the Supabase SQL Editor (after running
    `0009_admin_panel.sql`), substituting your own account's email. It
    works there specifically because the SQL Editor runs as the
    `service_role`/no-JWT context, which is the one case
    `protect_privileged_user_fields` (0001) lets `is_admin` through — the
    app itself can never write that column (see below).
  - **Authorization is enforced twice**, deliberately redundant: every
    `/admin/*` page and every Server Action calls `requireAdmin()`
    (`src/lib/admin.ts`), which redirects non-admins away — but per this
    project's own rule (and Next.js's own docs) that render-time gating
    isn't a sufficient boundary by itself, the real backstop is the
    database: `zones`, `zone_pet_pool`, `zone_loot_table`, `items`,
    `species`, `potion_recipes`, and `potion_recipe_ingredients` all got
    real INSERT/UPDATE(/DELETE) RLS policies gated on a
    `current_user_is_admin()` helper (a `security definer` function so it
    doesn't depend on the calling role having schema-level access to
    `auth`). Even if every Server Action's admin check were somehow
    bypassed, a non-admin's write would still be rejected at the database
    level.
  - This is a different authorization pattern than the rest of the app:
    everywhere else, writes go through one security-definer RPC per
    action (`start_expedition`, `claim_brew`, etc.), each re-validating
    `auth.uid()`. For the admin panel that would mean ~20 near-identical
    functions across 4 entity types, so instead the tables themselves got
    real write policies and the Server Actions use plain
    `.insert()`/`.update()`/`.delete()` through the normal client.
  - **Audit log**: rather than a "log this" call at every admin action
    site (easy to forget on a new one), a single generic trigger function
    (`log_admin_action()`) is attached to every admin-managed table. It
    builds an `{old, new}` jsonb diff, resolves `target_id` from the row's
    `id` column where one exists and falls back to the whole row as JSON
    for the composite-key junction tables (`zone_pet_pool`,
    `zone_loot_table`, `potion_recipe_ingredients`), and — importantly —
    **skips logging entirely when `auth.uid()` is null**, so migration-time
    seed data and any future service-role script don't clutter the log
    with meaningless "admin: null" rows. `/admin/audit-log` is read-only;
    nothing ever writes to `admin_audit_log` except that trigger.
  - `zones`, `items`, and `species` deliberately have **no delete policy**
    — only insert/update. Zones are referenced by expedition history,
    items by inventories/recipes/loot tables, and species by owned pets;
    "delete" in the admin panel means toggling `is_active = false`
    instead. `zone_pet_pool`, `zone_loot_table`, and
    `potion_recipe_ingredients` (junction/pool rows, not content) do allow
    delete, since removing one row there just means "this thing no longer
    drops here" / "this ingredient is no longer required," not destroying
    referenced history.
  - `zones.is_tutorial` is intentionally **not editable** from
    `/admin/zones` — it's a one-time seed flag for the single tutorial
    zone, and the edit page hides the pet-pool/loot-table sections
    entirely for that zone (its pool is fixed in code, not
    database-driven).
  - The brewing stand only has **3 ingredient slots** and requires an
    exact match (see the recipes note above) — `/admin/recipes/[id]`'s
    "add ingredient" form enforces this by capping the total ingredient
    quantity at 3 server-side (`addIngredient` in
    `src/app/admin/recipes/actions.ts`), so you can't accidentally create
    a recipe nobody could ever brew.
  - Verified against a local Postgres 16 instance the same way every
    other migration in this project has been: both `psql -f`
    (autocommit-per-statement) and `psql -1` (single implicit transaction,
    matching how the Supabase SQL Editor runs a pasted script) apply
    cleanly, and RLS behavior was
    checked directly by role-switching (`set role authenticated; set
    request.jwt.uid = '<uuid>';`) as both an admin and a non-admin
    account — non-admin writes are rejected, admin writes succeed and are
    audit-logged with correct old/new diffs, and writes with no
    authenticated caller (`auth.uid()` null) are correctly never logged.
    One real thing this testing caught: `current_user_is_admin()` was
    initially written as a plain (non-`security definer`) SQL function,
    which works fine on a real Supabase project (Supabase grants
    `authenticated`/`anon` `USAGE` on the `auth` schema by default) but
    would silently depend on that external grant rather than being
    self-contained — changed to `security definer` to match the
    convention every other cross-cutting helper in this codebase already
    follows.
- **Admin image uploads (`0010_game_image_storage.sql`,
  `src/lib/game-image-upload.ts`)** — a Supabase Storage bucket
  (`game-images`, public, 5 MB/file cap, PNG/JPEG/WebP/GIF only) that
  admins can upload item/species art into from `/admin/items/[id]` and
  `/admin/species/[id]`. Read access is public (players need to load the
  images); write access is gated by the same `current_user_is_admin()`
  RLS pattern as every other admin table in 0009 — verified locally the
  same way, by role-switching as an admin vs. a non-admin account against
  `storage.objects`.
  - Each row gets exactly **one** file, at a stable path
    (`items/<id>.<ext>` / `species/<id>.<ext>`) uploaded with
    `upsert: true` — re-uploading replaces it rather than accumulating
    orphaned files. Since the path doesn't change on re-upload, the
    stored `image_url` has a `?v=<timestamp>` cache-busting query param
    appended so browsers/next/image actually pick up the new file instead
    of serving a cached copy of the old one at the same URL.
  - The upload happens **inside the same Server Action** as
    creating/editing the row (`createItem`/`updateItem`,
    `createSpecies`/`updateSpecies`), using the admin's own session — not
    a separate client-side upload step — so it's covered by the same
    `requireAdmin()` check and storage RLS as everything else. On create,
    the row is inserted first (to get an id to key the file's path on),
    then the file is uploaded and `image_url` is patched in a second
    write.
  - The old "Image URL" text field is still there as a fallback — paste
    an external URL (still handy for `placehold.co` placeholders while
    testing) and it's used whenever no file is uploaded.
  - `next.config.ts` already allowlisted `*.supabase.co/storage/v1/object/**`
    for `next/image` from the very first module, anticipating this.
- **Search-to-add pickers (`src/components/admin/searchable-picker.tsx`)**
  — the zone pet-pool/loot-table "add" forms and the recipe ingredient
  "add" form used to be a plain `<select>` listing every active
  species/item, which stops being usable once the catalog grows past a
  screenful. `SearchablePicker` is a small client component that filters
  a passed-in option list by name as you type and, once you pick one,
  renders a plain hidden `<input>` with that id — so it drops into the
  existing native `<form action={serverAction}>` (a Server Component)
  without needing to convert the whole form into a client component or
  change the Server Action at all.
- **Currency & den expansion (`0011_currency_and_den_expansion.sql`)** —
  two currencies on `users`: `coin_balance` (base, renamed from
  `currency_balance` now that a second currency exists) and `gem_balance`
  (premium, new). Neither has a real-money purchase path yet — that's a
  deliberately deferred later module — so for now gems only ever move via
  the admin testing grant below, and coins only ever move via
  `expand_den`.
  - `protect_privileged_user_fields` (0001, extended in 0002 with the
    trusted-write escape hatch) already blocked client writes to
    privileged columns including the old `currency_balance`/`den_size`;
    redefined again here for the rename plus `gem_balance`. Any RPC that
    writes one of these columns must call `begin_trusted_user_write()`
    first (inside the same transaction) or the trigger silently resets
    the column back to its old value — this bit both new functions below
    during local testing before that call was added, exactly as intended
    (it's the same protection that stops a compromised/malicious client
    from writing these columns directly).
  - **`expand_den(p_user_id)`** — a normal self-only player RPC (`auth.uid()
    = p_user_id`, same pattern as `start_expedition`/`claim_brew`/etc.),
    row-locks the caller's own row, and adds 25 to `den_size` for an
    escalating coin cost: 500 for the first expansion, ×1.5 per
    expansion already bought (500, 750, 1125, 1688, 2531, …), derived
    from `den_size` itself rather than a separately stored counter — one
    less thing that could drift out of sync. No hard cap on how many
    times it can be bought; the escalating cost is the only limiter.
    `/profile` shows an "Expand den" button computing the same cost
    formula client-side for display (`nextDenExpansionCost` in
    `src/app/profile/page.tsx`, kept in a comment-linked lockstep with
    the SQL) — but the RPC re-derives and enforces the real cost
    server-side regardless of what the client shows or sends.
  - **`admin_grant_self_currency(p_admin_user_id, p_coin_delta, p_gem_delta)`**
    (`/admin/currency`) — a testing tool for granting yourself coins/gems
    without a purchase flow yet, and likely still useful later for
    support/compensation even once one exists. Deliberately scoped to
    the calling admin's **own** account only — there's no target-user
    parameter anywhere in this path, matching the "no in-app way to
    affect any account but mine" rule the rest of the admin panel
    follows. This is also why it's a narrow RPC that only ever touches
    `coin_balance`/`gem_balance` (hardcoded in the function body) rather
    than a general admin `UPDATE` policy on `users` — a blanket policy
    would let an admin's REST client touch `is_admin`/`email`/`den_size`
    on any account too, which would defeat the single-admin guarantee at
    the database level. Deltas can be negative (balances clamp at 0, never
    go negative) and every grant is logged to `admin_audit_log` the same
    as every other admin action, just with a synthetic
    `target_table = 'users.currency'` since it isn't a plain
    trigger-logged table write.
  - Verified locally the same way as every other migration: both
    `psql -f`/`psql -1` apply cleanly, and — role-switched as both an
    admin and non-admin account — a direct client `UPDATE` to
    `coin_balance`/`gem_balance`/`den_size` is still silently reset,
    `expand_den` rejects insufficient coins and rejects being called for
    a different user, `admin_grant_self_currency` rejects non-admins, a
    real grant lands both balances and is audit-logged, and two
    successive `expand_den` calls charge 500 then 750 exactly as the
    cost curve intends.
- **Pets/items split & pet folders (`0012_pet_folders.sql`, `/pets`,
  `/items`)** — `/inventory` (a single page mixing two increasingly
  different systems) is now two pages; the old route just `redirect()`s
  to `/pets` so old links/bookmarks still land somewhere.
  - **Folders are a simple owned table** (`pet_folders`: `owner_id`,
    `name`) with plain owner-scoped RLS CRUD policies — unlike most
    player-facing writes elsewhere in this app, folder create/rename/
    delete don't need a security-definer RPC, since a folder holds
    nothing sensitive or invariant-bearing (just a name), the same
    reasoning that already let `settings/actions.ts` write
    `display_name`/`bio` directly through RLS instead of via an RPC.
  - **Moving a pet between folders is an RPC** (`move_pet_to_folder`),
    not a client `UPDATE` policy on `pets` — `pets` has never had a
    client-facing write policy (species/rarity/etc. must never be
    client-writable; see 0002), and adding a broad "owner can update own
    pets" policy just to allow `folder_id` changes would reopen that.
    The RPC only ever touches `folder_id`, verifies the caller owns both
    the pet and the target folder, and — like several player RPCs
    already in this app — the request just fails outright with an
    exception on ownership mismatch rather than silently no-op'ing,
    since there's no legitimate case where it's called for someone
    else's pet or folder.
  - A pet with `folder_id = null` shows under "Unsorted" — not a real
    folder row, so no folder needs to be auto-created for new users.
    Deleting a folder (`on delete set null` on `pets.folder_id`) drops
    its pets back to Unsorted automatically; nothing else needs to move
    them out first.
  - Verified locally the same way as every other migration: both
    `psql -f`/`psql -1` apply cleanly, and — as two different simulated
    accounts — one user can't see, rename, or delete another's folders,
    can't move another user's pet, and deleting a folder correctly
    clears `folder_id` back to null on its pets rather than cascading
    the delete to the pets themselves.
  - The items page's type tabs (All / Ingredients / Potions / Cosmetics)
    are a plain `?type=` query param read via `props.searchParams` (Next
    16's `PageProps` helper, same `await`-a-Promise shape as `params` —
    see `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md`)
    filtering the same inventory query the old page already ran — no new
    table or RPC needed for this part.
  - **`/pets` was redesigned again shortly after** to fix a real UX
    problem the first version had: every folder rendered as its own
    always-expanded section stacked on one page, which doesn't scale.
    It's now `?folder=<id|all|unsorted>` + `?page=<n>` driven — folders
    are tabs (`All` / each folder / `Unsorted`, each showing its own
    count), and the active tab is paginated at 25 pets per page via
    `.range()`. Tab counts come from `{count:"exact",head:true}` queries
    (one per folder, run in parallel) rather than fetching every pet's
    row just to count them; the actual pet data query only ever fetches
    the current tab's current page.
- **Pet naming (`0013_pet_names.sql`)** — Chicken Smoothie-style: every
  pet starts unnamed (`custom_name` defaults to null, never backfilled
  from the species name) and stays that way until the owner sets one.
  The species name is never treated as the pet's display name — it's
  shown as smaller secondary/breed-style text under the name slot, which
  itself shows a "+ Name this pet" prompt (not a placeholder title) when
  unnamed, and becomes an inline-editable name once set
  (`pet-name-editor.tsx`).
  - **`rename_pet(p_user_id, p_pet_id, p_name)`** follows the exact same
    shape as `move_pet_to_folder` (0012) and for the same reason: `pets`
    has never had a client `UPDATE` policy, so this is a narrow RPC that
    only ever touches `custom_name` rather than a blanket owner-update
    policy that would also reopen `species_id`/`rarity`/etc. to client
    writes. Blank/whitespace-only input clears the name back to
    null — that's how a player "un-names" a pet — rather than being
    rejected.
  - A `check` constraint on the column itself (null, or 1-40 chars)
    backs up the RPC's own length check — defense in depth, same
    reasoning as the length checks already used elsewhere in this app.
  - Verified locally the same way as every other migration: both
    `psql -f`/`psql -1` apply cleanly; role-switched as two different
    accounts, one user can't rename another's pet, a name gets trimmed
    and saved correctly, blank input clears it back to null, a
    41-character name is rejected, and a direct client `UPDATE` to
    `custom_name` still does nothing (no RLS policy allows it).
- **`game-assets/` drop folder** — a place to hand over real art in
  future turns instead of describing it in chat. See
  [`game-assets/README.md`](./game-assets/README.md) for the convention
  (subfolder by kind, filename loosely matched to the existing
  species/item/zone name) — not itself app code, just a documented
  workflow for getting art into Storage without going through the admin
  UI's file picker one image at a time.
- **Cream/parchment theme + wood-sign header** — a site-wide palette
  swap plus a header redesign, prompted by real art assets dropped into
  `game-assets/` (see that folder's own notes above).
  - **The palette swap is a straight, ordered token substitution**
    across every `.tsx`/`.ts` file under `src/`: every `zinc-*` Tailwind
    class became `amber-*` (backgrounds, borders, primary buttons —
    the "cream/wood" tones) or `stone-*` (secondary/muted text, dark-mode
    surfaces — a warm-toned gray so dark mode stays coherent with the
    new identity rather than reverting to a cold gray). This was safe to
    do as a scripted, ordered find-and-replace (longest/most-specific
    class first — e.g. `dark:hover:bg-zinc-900` before `dark:bg-zinc-900`
    before `bg-zinc-900` — so a shorter pattern never corrupts a longer
    one it's a substring of) specifically because this codebase only
    ever used Tailwind's palette classes directly, in a small, consistent
    vocabulary I'd authored myself — there was no semantic token layer to
    preserve. `bg-black/NN` modal scrims and plain `bg-white` cards were
    deliberately left alone (a scrim doesn't need to match the theme, and
    a white card reads fine as "paper" against the new cream page
    background).
  - **`globals.css`'s `--background`/`--foreground` CSS variables were
    updated to match**, not just the `bg-amber-50` class on `<body>` —
    that plain `body { background: var(--background) }` rule is
    unlayered CSS, which wins the cascade over a Tailwind utility class
    regardless of specificity, so leaving the variables at their old
    white/black values would have silently overridden the new class.
  - **The header** (`site-header.tsx`) was redesigned around the
    Animal Jam-style reference the assets came with: a warm-brown
    plank-toned bar, a pill-shaped nav strip, and a distinct rounded
    cream "signpost" panel on the right for the account area — now also
    showing the coin/gem balance at a glance, reusing data the header's
    profile query already needed to fetch. This approximates the
    reference's *structure and palette*, not a literal recreation of its
    hand-painted wood/rope/forest illustration — no assets for that
    specific art were provided, and faking a wood texture with CSS
    gradients alone tends to look worse than a clean, deliberately
    simpler shape in the same palette.
  - **Real icon art replaced emoji/placeholder shapes in a few spots**:
    the brewing stand's recipe-book button and its 3 ingredient slots
    (now the actual item-slot frame art, swapping empty/filled states
    instead of a dashed border), the recipe book modal itself (now
    rendered over the open-book illustration instead of a plain white
    card), and a small edit-pencil icon next to the pet name/folder
    rename controls. These specific spots were picked because they're
    exactly what the dropped assets were for (book backdrop, inventory
    slots, icons per the request) — not every emoji or plain-text
    "Rename"/error message in the app was swept in this pass, to keep
    the change reviewable.
  - Chrome/UI assets (icons, panel art, the book backdrop) live in
    `public/icons/` and `public/ui/`, served directly — **not** uploaded
    to the Supabase Storage bucket from 0010. That bucket is for
    admin-editable game content (pet/item/zone art a database row points
    to via `image_url`); these are static, code-shipped assets that ship
    with a deploy like any other file in `public/`, with no admin upload
    step or database row involved.
  - Verified visually, not just via typecheck/build/lint (this is a
    styling change — those wouldn't catch a broken layout): ran the dev
    server against a stub Supabase URL and drove headless Chromium
    (Playwright, this environment's pre-installed browser) to screenshot
    both the logged-out `/` and `/login` pages for real, and a temporary
    throwaway route for the logged-in header state (deleted before
    finishing, along with the stub `.env.local` — neither was committed).
  - **Follow-up fix**: that first verification pass used Playwright's
    default color scheme (light), which is exactly why it missed a real
    bug — Tailwind v4 defaults `dark:` to `@media (prefers-color-scheme:
    dark)`, and `globals.css` had its own separate `@media
    (prefers-color-scheme: dark)` block setting `--background` back to
    near-black. Anyone with their OS/browser in dark mode saw a black
    site regardless of the new theme. Since cream is meant to be *the*
    theme for now, not one half of a light/dark toggle, the fix switches
    Tailwind to class-based dark mode (`@custom-variant dark
    (&:where(.dark, .dark *));`) and drops the CSS media-query override
    — `dark:*` classes and dark-mode colors now only ever apply if
    something adds a `dark` class to `<html>`, which nothing does yet.
    All the `dark:` work already in the codebase stays intact and ready,
    just dormant. Re-verified by re-running the same Playwright check
    with the browser's color scheme explicitly forced to `dark` this
    time — confirms the page stays cream regardless of system
    preference.
  - **Recipe book, redesigned twice**: round one used the open-book
    illustration (`book-container.png`) as a fixed-aspect-ratio backdrop
    with content absolutely positioned over it — looked bad and clipped,
    since an open book's curved page/spine art doesn't leave a clean,
    predictable rectangle for arbitrary (and scrolling) content to sit
    inside without overflowing past where the art implied its edges
    were. Round two swapped it for `parchment-panel.png` (a plain
    rectangle) plus pagination instead of scrolling — fixed the clipping,
    but dropped the actual book art the user wanted, and looked plain.
    Round three (the current design) keeps `book-container.png`, but
    instead of one large content area, lays out two small,
    precisely-bounded content boxes — one per page-half — positioned via
    percentage insets calibrated directly against the artwork (a Python
    script drew gridlines at candidate percentages onto the image so the
    safe cream area, clear of the spine and curved top/bottom edges,
    could be read off exactly: each page's content box is
    `left/right: 10%/55%, width: 35%, top: 12%, height: 74%`). Each page
    holds exactly 3 fixed-size recipe cells (`RECIPES_PER_SIDE = 3`, 6
    per two-page spread) rather than a variable-length list, so there's
    a hard upper bound on content per page and nothing can ever overflow
    the calibrated box — pagination (plain `useState` page index,
    Previous/Next buttons) flips between spreads of 6. Each cell is
    itself a button showing the recipe's ingredients (icon + a `×N`
    badge when quantity > 1) → an arrow → the output potion, clicking it
    fills the brewing slots (replacing the old separate "Fill slots"
    button, since cell space is tight), and hovering the potion shows
    its effect (`describeEffect()`) in a CSS-only tooltip
    (`group`/`group-hover`, no JS state).
  - Verified the same way both times — drove headless Chromium to open
    the book, page forward, and hover a potion, screenshotting each
    step, using a temporary preview route with mocked recipe data
    (deleted before finishing) since exercising this needs real
    inventory data this sandbox doesn't have a live Supabase project
    for. For round three, used same-origin local image files as the
    mock recipes' art (rather than an external placeholder host) so the
    screenshots showed real rendered images instead of broken-image
    icons — this sandbox's network policy blocks the external host used
    in earlier rounds' mocks, which isn't a real app issue (real art
    loads from Supabase Storage) but did mean earlier verification
    screenshots showed broken images where the layout mattered more than
    the pixels.
- **Recipe book: larger fixed-size icons, page-turn arrows, page numbers**
  — three follow-up refinements once the two-page-spread layout (above)
  was in place and felt too small.
  - Each image slot in a `RecipeCell` (every ingredient + the output
    potion) first tried `flex-1` width + `h-full` so a full recipe's 4
    slots (3 ingredients + potion) would fill the row edge-to-edge — but
    that meant recipes with *fewer* ingredients got *larger* slots than
    ones with more, since fewer flex items divide the same row width
    between them. That's not what was wanted: every icon should read as
    the same size everywhere in the book, and a short recipe should just
    leave empty space rather than growing to fill it. Reverted to fixed
    pixel sizing (`CELL_ICON_SIZE = 52`, `CELL_POTION_SIZE = 64` — a
    modest bump over the original 44px/56px) via `<Image>` `width`/
    `height` plus matching inline `style`, with `shrink-0` wrapper divs
    instead of `flex-1`. A recipe with fewer ingredients now just
    produces a shorter, left-aligned row at the same icon size as every
    other row.
  - Page-turn arrows (`PageArrowButton`) replaced the old Previous/Next
    text buttons below the book — they now sit directly beside it,
    using art the user dropped into `game-assets/` (a plain "brown
    outline" arrow for rest state and a bolder "double outline" variant
    for hover). The hover swap is two stacked `fill` images with a CSS
    opacity crossfade on `group`/`group-hover` — no JS state — and the
    disabled (first/last page) state just dims the button and skips
    rendering the hover image entirely, so a disabled arrow can't
    visually swap on hover.
  - Page numbers are printed directly on the page art (bottom-center of
    each half, inside the same calibrated safe zone as the recipe
    cells) rather than only in a caption below the book — left page
    always odd, right always even, counting up across spreads
    (`page * 2 + 1` / `page * 2 + 2`), matching how a real book numbers
    its pages.
  - Verified the same way as the rest of this feature: headless Chromium
    against a temporary preview route with mocked recipes deliberately
    covering the 4-image, 3-image, and 2-image cases, confirming every
    icon renders at the same fixed size regardless of ingredient count,
    the hover crossfade fires, the correct arrow dims at each end of the
    page range, and the printed page numbers advance correctly across a
    spread turn.
- **Unique, rate-limited usernames (`0014_unique_display_names.sql`)** —
  `display_name` (previously free-form, unconstrained, changeable anytime
  via a plain client `.update()`) is now the player's unique handle.
  - **Uniqueness is case-insensitive**: a `unique index` on
    `lower(display_name)`, so "Bob" and "bob" can't both exist. Any
    pre-existing duplicates (this column had no constraint before) are
    resolved by the migration itself before the index is created —
    grouped by lowercased name, the earliest-created row in each group
    keeps its name, every later one gets a numeric suffix appended
    (`-2`, `-3`, ...) until it's free.
  - **The rule is uniform, no free first customization window**: every
    change — including a brand-new account's very first change away from
    its auto-assigned signup name — costs 15 gems and can only happen
    once every 14 days. `display_name_changed_at` is backfilled to
    `created_at` for existing rows and set at signup for new ones, so the
    14-day clock always starts at account creation.
  - `change_display_name(p_user_id, p_new_name)` is the only way to
    change it: re-validates `auth.uid()`, trims/collapses whitespace,
    enforces a 3–40 character length, checks the 14-day cooldown against
    `display_name_changed_at`, checks the caller has ≥15 gems, checks the
    trimmed name isn't already taken (case-insensitively, excluding the
    caller's own row), then spends the gems and updates both columns in
    one `security definer` transaction. Returns the new name, new gem
    balance, and `next_change_available_at` so the UI doesn't need a
    second round-trip to know when the cooldown clears.
  - `display_name` and `display_name_changed_at` were added to
    `protect_privileged_user_fields`'s guarded-column list (same pattern
    as `coin_balance`/`gem_balance`/`den_size` since 0001/0011) —
    otherwise a plain client `.update()` on `users` could change the name
    directly and skip every check above. `src/app/settings/actions.ts`'s
    `updateProfile` now only ever touches `bio`.
  - `handle_new_user()` (the Google-sign-in trigger from 0001) was
    redefined to sanitize the candidate name from Google's `full_name`
    (collapsing whitespace, capping length) and append a numeric suffix
    if it collides with an existing name, looping until unique — the same
    logic as the backfill above — so two people who happen to share a
    real name never fail to sign up.
  - New client component `src/app/settings/display-name-editor.tsx`
    (same edit/save/cancel shape as `PetNameEditor`) calls
    `change_display_name` directly via `supabase.rpc(...)`, shows the
    gem cost on the button, and — when the cooldown hasn't elapsed —
    replaces the button with "You can change your name again on
    &lt;date&gt;" instead of showing a control that would just error.
  - Verified at the database level (both `psql -f` and `psql -1` against
    a local Postgres 16 instance stubbed with a minimal `auth.users` /
    `auth.uid()` / `auth.role()` / `storage.buckets`, since this is real
    Supabase platform schema this app's migrations depend on but a bare
    Postgres install doesn't have): role-switched as an authenticated
    user through every guard (cooldown not yet elapsed, wrong user,
    name-already-taken, too-short, not-enough-gems, then a real
    success), confirmed the cooldown re-arms immediately after a
    successful change, confirmed a plain `UPDATE` from an authenticated
    role is silently reverted by the trigger while the same `UPDATE` as
    `service_role` (the Supabase SQL Editor / an admin script) goes
    through, and confirmed both the signup-time and migration-time
    dedup logic against manufactured duplicate names. UI states (can
    change now, on cooldown, insufficient gems, the open edit form) were
    checked visually with headless Chromium against a temporary preview
    route.
- **Trading (`0015_trading.sql`, `/trades`)** — a fixed offer, not a live
  negotiation thread. The initiator picks pets/items/coins/gems from
  their OWN den/inventory to offer, addressed to a recipient by their
  unique username (resolved client-side to a user id via `user_profiles`
  before calling `create_trade`), plus an optional free-text note saying
  what they'd like back. The recipient never sees or picks FROM the
  initiator's collection and vice versa — neither player can browse the
  other's private den/inventory (no new RLS was opened up for that), so
  the only thing either side ever offers is drawn from their own
  `pets`/`user_inventory`. Accepting means building your own counter
  from your own collection (or nothing, to accept as a pure gift) and
  submitting it — that submission executes the swap immediately, there's
  no further back-and-forth round in this first version.
  - **Not an escrow system, by design**: `create_trade` only sanity-checks
    ownership/balance at proposal time — it doesn't lock or reserve
    anything. The same pet could be offered in two different trades, or
    spent before either resolves. `respond_to_trade` re-validates
    everything from scratch (ownership, item quantities, coin/gem
    balances, for both sides) inside the same transaction that executes
    the swap, and aborts cleanly with "This trade is no longer valid —
    the offer has changed" if anything moved in the meantime — verified
    directly by manufacturing a stale offer (moving the offered pet away
    via a separate service-role update between `create_trade` and
    `respond_to_trade`) and confirming the accept fails and the trade
    stays `pending`, untouched.
  - Three tables: `trades` (one row per proposal — status, note, and
    each side's coin/gem amounts), `trade_pets` and `trade_items` (which
    pets/items are on which `side`). `side` is stored explicitly rather
    than derived from `pets.owner_id` — that column changes the moment a
    trade completes, so deriving "who offered this" from current
    ownership would break a trade's own history the instant it finished.
  - Three RPCs, same `security definer` + re-validate-`auth.uid()`
    pattern as every other write path in this app: `create_trade`
    (propose), `respond_to_trade` (decline, or accept with a
    counter-offer — one call handles both, `p_accept` switches the
    branch), `cancel_trade` (initiator only, only while still
    `pending`). The swap itself — pet ownership transfer, inventory
    quantity moves both directions, currency moves both directions — all
    happens inside `respond_to_trade`, in the same transaction as the
    re-validation, so a failed check can't leave a half-executed trade.
    Currency updates go through `begin_trusted_user_write()` first, same
    as every other function that touches `coin_balance`/`gem_balance`.
  - Both accounts are locked (`for update`) in a consistent order — by
    `id`, not by role — before either balance is touched, so two trades
    between the same pair of players can never deadlock against each
    other.
  - **A real RLS gap caught before it shipped**: `pets` has only ever
    let an owner see their own pets (0002). That's fine for everyday use
    but breaks trading in two ways — a recipient reviewing a pending
    offer needs to see the initiator's offered pet despite never owning
    it, and once a trade completes, whoever gave a pet away no longer
    owns it but should still see it in their own trade history. Added an
    additional (additive — RLS `SELECT` policies are OR'd together)
    policy: any pet named in `trade_pets` is visible to either
    participant of that trade, regardless of current ownership or trade
    status. Verified directly: after the swap, role-switched as each
    former owner and confirmed both could still see the pet they gave
    away, then role-switched as a third, uninvolved account and
    confirmed it saw neither — this policy widens visibility only for
    pets that passed through a trade the caller was actually part of,
    never a stranger's den.
  - New client-side local Postgres stub needed for this migration's
    testing: `authenticated`/`anon` roles with real table grants (a real
    Supabase project grants these by default and lets RLS do the actual
    enforcement; a bare local Postgres install has neither the roles nor
    the grants, so `SET ROLE authenticated` failed with a plain
    "permission denied" before RLS was ever consulted, independent of
    any policy). Fixed with `ALTER DEFAULT PRIVILEGES ... GRANT SELECT,
    INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated` in the stub,
    applied before any migration creates a table.
  - Verified against local Postgres 16 (both `psql -f` and `psql -1`):
    role-switched as two + a third uninvolved account through every
    guard on both `create_trade` and `respond_to_trade` (self-trade,
    recipient not found, empty offer, offering a pet/item/currency
    amount you don't have, a non-participant or the wrong side trying to
    respond, responding to an already-resolved trade, countering with a
    pet you don't own), then a full successful trade — confirming pets
    swapped owners with `folder_id` reset, coins/gems moved by exactly
    the right amount on both sides, and item quantities moved on both
    sides — then the decline path, the cancel path (including an
    unauthorized cancel attempt), and the stale-offer re-validation case
    above. UI states (the trade builder, trade cards in different
    statuses, the respond form, pet selection toggling, item quantity
    inputs) were checked visually with headless Chromium against a
    temporary preview route mounting the client components directly with
    mock data, since exercising the real pages end-to-end would need a
    live Supabase project this sandbox doesn't have.
  - Original page layout (superseded by the Trading Center redesign
    directly below): a single `/trades` inbox page with incoming/
    outgoing/history sections, and a builder that only ever took a
    free-text "what I want" note since neither side could see into the
    other's collection.
- **Trading Center redesign, for-trade browsing, and the trade picker
  modal (`0016_for_trade_flags.sql`, `0017_trade_requests.sql`)** — three
  follow-ups after using the first version of trading, modeled on how
  Chicken Smoothie's trading actually works: players mark specific
  pets/items available to trade, anyone can browse and search that pool,
  and proposing a trade means picking concretely from it rather than
  hoping a free-text note gets read.
  - **`is_for_trade`** (`0016`) is a plain boolean on `pets` and
    `user_inventory`, toggled by the owner via `set_pet_for_trade`/
    `set_item_for_trade` (both the same narrow-RPC-per-mutation pattern
    as `rename_pet`/`move_pet_to_folder`, since neither table has ever
    had a client `UPDATE` policy) plus a bulk `set_folder_pets_for_trade`
    for tagging a whole folder ("pet group") at once — the "mark all in
    this group for trade" button on `/pets`. **It only gates discovery,
    never what can actually be offered**: once two players are already
    building a trade, either side can still offer anything they own,
    flagged or not — see `create_trade`'s comment for why (nothing here
    is a reservation, only a visibility rule).
  - **Browse visibility**: two new additive `SELECT` policies (`pets`,
    `user_inventory`) let any signed-in player see a for-trade pet/item
    regardless of who owns it — the first time either table has ever
    been visible beyond its owner. `/trades/browse` is the Trading-Post-
    style page this enables: tabs for pets/items, filterable by name/
    rarity/owner username, paginated, each result linking to
    `/trades/new` pre-targeted at that owner and that specific pet/item.
  - **The initiator can now request specific things from the recipient's
    side too** (`0017` extends `create_trade` with five trailing
    defaulted params — the one signature change `CREATE OR REPLACE`
    allows without dropping the function — so old callers still work
    unchanged), validated against what the recipient has actually
    marked `is_for_trade` and inserted as `side = 'recipient'` rows at
    proposal time, same sanity-check-now/re-verify-at-accept-time
    caveat as everything else on this table. This is a *request*, not a
    lock: the recipient's response form pre-fills from it but can freely
    swap in something else before accepting.
  - **A real bug this surfaced**: `respond_to_trade` previously always
    `INSERT`ed the recipient's submitted pets/items, which worked when
    the recipient side started empty — but now `create_trade` may have
    already inserted `side = 'recipient'` rows as the request, and
    re-confirming (or partially reusing) the same pet/item id would hit
    `trade_pets`/`trade_items`'s primary key. Fixed by having
    `respond_to_trade` `DELETE` any existing `side = 'recipient'` rows
    before inserting whatever the recipient actually chose to give —
    verified directly by having a recipient swap in a completely
    different pet and a different currency amount than what was
    requested, and confirming exactly one row lands (no duplicate/
    leftover) and the trade's final `recipient_coins` reflects what was
    actually given, not the original ask.
  - Newly-received pets also get `is_for_trade` reset to `false` on
    both sides of a completed swap — a pet doesn't stay publicly
    browsable under its new owner just because its previous owner had
    flagged it.
  - **The shared picker modal** (`src/app/trades/picker-modal.tsx`,
    `PetPickerModal`/`ItemPickerModal`) is what "search and filter
    through their and their partner's items/pets" turned into: a name
    search box + rarity dropdown over a normalized `PickerPet`/
    `PickerItem` shape, so the same component renders a player's own
    collection (already loaded server-side) or another player's
    for-trade pool (fetched client-side once a recipient is resolved,
    since only then is their user id known) identically. Used in three
    places: the trade builder's "You give" (own collection, unfiltered
    by `is_for_trade` — see above) and "You want" (recipient's
    for-trade pool only) columns, and the respond form's own-collection
    picker.
  - **A real bug this surfaced, caught by the Playwright pass, not the
    type checker**: the trade builder's "You give" chips initially read
    straight from the raw `PetWithSpecies[]`/`ItemWithQuantity[]` props
    (which don't have a top-level `.name`/`.imageUrl`) instead of the
    normalized picker shape used everywhere else — the `as PickerPet[]`
    cast silenced TypeScript, so it built and typechecked cleanly, but
    every added-pet chip rendered as an empty circle with no name or
    image. Fixed by normalizing once (`toPickerPets`/`toPickerItems`)
    and reusing that everywhere instead of passing the raw query result
    into a component that expects the normalized shape.
  - `/trades` is now the **Trading Center** hub — pending-trade counts,
    quick links, and a short recent-activity list — with the actual
    trade lists split out: `/trades/active` (incoming/outgoing pending),
    `/trades/history` (resolved), `/trades/browse` (the for-trade
    marketplace above), `/trades/new` (the builder), `/trades/[id]`
    (detail — unchanged in structure, just relabels the recipient side
    "What they're asking you for" / "What you're asking ... for" while
    `pending`, versus "gave" once resolved, since that side may now be a
    live request rather than a settled fact).
  - Verified the same way as the original trading feature: local
    Postgres 16 (both `psql -f` and `psql -1`) for the schema/RPC
    changes — role-switched through the for-trade toggle ownership
    check, confirmed a stranger can see only the specific pets/items an
    owner marked for trade (not the rest of their den), a full
    create-request-then-accept-as-is trade, and the swap-in-something-
    different case that caught the delete-before-insert bug above — then
    headless Chromium against a temporary preview route mounting the
    real trade builder and respond form components with mock data
    (search/filter inside the picker modal, adding/removing pets and
    items, the pre-filled request chips), since exercising the real
    pages end-to-end would need a live Supabase project this sandbox
    doesn't have.
- **Trading disabled, Marketplace added instead
  (`src/lib/feature-flags.ts`, `0018_marketplace.sql`)** — after using
  the redesigned trading feature above, decided to hold off on
  player-to-player trading for now and build a currency marketplace
  instead, referencing how Flight Rising's Marketplace works (their
  fixed-price listings, not their timed-bid Auction House).
  - **Trading was disabled, not deleted.** `TRADING_ENABLED` in
    `src/lib/feature-flags.ts` is the single switch: every trading nav
    link, the "Propose a trade" button on `/u/[id]`, and the for-trade
    toggles on `/pets`/`/items` are conditional on it, and every
    `/trades/*` page calls `notFound()` at the top when it's off — so
    direct navigation to a trading URL 404s the same for a player as
    for an admin (there's no trading-specific admin UI to separately
    hide). Flipping the flag back to `true` is the entire re-enable;
    nothing else changes. The underlying RPCs
    (`create_trade`/`respond_to_trade`/etc.) still exist and would still
    work if called directly — same as any other RPC in this app, they
    require real auth and real ownership — but with every UI entry
    point gone, nothing in the app ever calls them.
  - **Fixed-price, not an auction**: a seller lists a pet or a stack of
    items at a coin price; any other player buys the whole listing
    instantly for that price. No bidding, no timers, no partial
    purchases (a seller who wants to sell some of a stack now and some
    later just lists twice) — deliberately the simpler of Flight
    Rising's two systems, chosen over timed bidding to avoid needing a
    bid-resolution job, outbid refunds, and anti-snipe extensions for a
    first version. Coins only, matching the rest of the economy — gems
    still have no earn path outside admin testing grants, so nothing to
    spend them on here either.
  - **Pet listings snapshot their display info at listing time**
    (`pet_species_name`/`pet_species_image_url`/`pet_rarity`/
    `pet_custom_name` columns on the listing itself) instead of joining
    the live `pets` row. `pets` has been owner-gated since 0002, and
    trading's fix for the same problem (0015) was to add another
    permissive `SELECT` policy scoped to trade participants — doing
    that again here would mean every future feature that needs to show
    someone else's pet adds its own carve-out. Denormalizing instead
    means a listing is fully self-contained for display and needs zero
    new policies on `pets`; item listings didn't need this treatment
    since the item catalog (`items`, not any one player's stack of it)
    has been publicly readable since 0005.
  - **A real bug caught by the local Postgres verification, not by
    reasoning about the code**: `buy_listing`'s stale-listing path
    tried to `UPDATE ... SET status = 'cancelled'` and then
    `RAISE EXCEPTION` in the same breath, intending "clean up the dead
    listing, then tell the buyer why." A raised exception in `plpgsql`
    aborts the *whole function call* and rolls back everything since
    entry — including that same cancellation update — so the listing
    was silently left `active` instead, forever failing the same way
    for the next buyer too. plpgsql has no way to make one write outlive
    an exception without a genuinely separate (autonomous) transaction,
    which isn't worth reaching for here. Fixed by not raising for this
    specific case: the function returns normally with
    `{"status": "unavailable", "reason": "..."}` instead, the same
    non-exception-status pattern `respond_to_trade` already uses for
    "declined" (0015) — so the cancellation commits, and the client
    checks the returned `status` rather than only `error`. Verified by
    re-running the exact repro (list a pet, give it away via a separate
    service-role update before purchase, then attempt to buy) and
    confirming the listing now actually flips to `cancelled`.
  - Every other write path follows the same conventions as trading and
    everything before it: `security definer` RPCs re-validating
    `auth.uid()`, `for update` row locks (both accounts locked in a
    consistent order by id, so two purchases between the same pair of
    players can't deadlock), `begin_trusted_user_write()` before
    touching `coin_balance`, and sanity-check-at-listing/re-verify-at-
    purchase rather than a reservation system (the same caveat as
    trading's offers — a listed pet or item quantity isn't locked, just
    checked again for real when someone actually buys).
  - The shared pet/item picker modal moved from `src/app/trades/` to
    `src/components/picker-modal.tsx` so the marketplace's sell flow
    could reuse it without depending on a folder that's now hidden
    behind a feature flag — trading's own usages were repointed at the
    new location, nothing about the component itself changed.
  - Verified against local Postgres 16 (both `psql -f` and `psql -1`):
    listing ownership checks for both pets and items, listing an
    already-actively-listed pet again, listing more items than owned,
    a buyer with insufficient coins, buying your own listing, buying an
    already-sold or cancelled listing, the cancel-your-own-listing path
    (including an unauthorized attempt), a full successful pet purchase
    (owner transferred, `folder_id`/`is_for_trade` reset, coins moved
    both directions), a full item purchase (quantities moved both
    directions), and the stale-listing case above. UI states (listing
    cards in different statuses, the buy confirm/cancel flow, the sell
    form's pet/item picker) were checked visually with headless
    Chromium against a temporary preview route mounting the client
    components with mock data.
- **Listing duration/auto-expiry and gem pricing
  (`0019_marketplace_upgrades.sql`)** — three requests after using the
  marketplace above: let the seller choose how long a listing runs
  (auto-unlisting itself when time's up), let a listing be priced in
  gems as well as coins, and let it offer both at once so the buyer
  picks.
  - **No cron job** — `expires_at` (set at creation from the seller's
    chosen duration: 1/3/7/14/30 days, validated server-side against
    that exact list) is enforced the same lazily-on-page-load way as
    `resolve_due_expeditions`/`resolve_due_brews`, via a new
    `resolve_expired_listings()` called at the top of `/marketplace` and
    `/marketplace/mine`. The one difference from those two: it isn't
    scoped to a single player (`resolve_due_expeditions(p_user_id)` only
    resolves that caller's own due expeditions) — browsing the
    marketplace needs *everyone's* expired listings cleared, not just
    the viewer's own, and since the function only ever flips a
    listing's own status field, there's no risk in any signed-in player
    being the one who happens to trigger the sweep. `buy_listing` also
    re-checks `expires_at` directly (same non-exception-`status`
    pattern as the stale-pet/stale-item checks it already had), so a
    listing that expired in the moments before the lazy sweep last ran
    still can't be bought.
  - **Hit the exact `ALTER TYPE ... ADD VALUE` gotcha this project
    already documented once** (see the note on
    `0008_potion_effects_and_brew_timers.sql` above): adding `'expired'`
    to `listing_status` and having anything in the *same transaction*
    actually use that value (not just reference it inside a function
    body) fails. Nothing in this migration does that, but added the same
    explicit `commit;` right after the `ALTER TYPE` anyway, matching
    0008's fix exactly rather than relying on the distinction between
    "referenced in a function body" and "used as data" holding up under
    `psql -1`'s single-transaction wrapping — cheap insurance, verified
    both ways regardless.
  - **`price_coins` went from required to nullable, and a new nullable
    `price_gems` joined it** — a listing now needs at least one of the
    two set (`check (price_coins is not null or price_gems is not
    null)`), and `buy_listing` gained a `p_currency: 'coins' | 'gems'`
    parameter (a real enum, `listing_currency`) so the buyer states
    which price they're paying — validated against whichever of the two
    the listing actually offers, then debits/credits that specific
    balance. `create_pet_listing`/`create_item_listing` and
    `buy_listing` were dropped and recreated rather than
    `CREATE OR REPLACE`d: unlike 0017's extension of `create_trade`
    (which only ever appended new *trailing, defaulted* parameters),
    here `price_coins` itself changes from required to optional and
    `buy_listing` gains a parameter in the *middle* of its effective
    call shape — different enough from a pure append that a clean
    drop-and-recreate was clearer than working out whether
    `CREATE OR REPLACE` would actually accept it.
  - The sell form now has a duration `<select>` (1/3/7/14/30 days) and
    two price inputs (coins, gems) instead of one, with copy explaining
    a buyer can pay with either. The buy button renders one "Buy — 🪙 N"
    and/or one "Buy — 💎 N" button per price the listing actually offers
    (each independently affordability-gated against the viewer's own
    coin/gem balance), instead of always assuming coins. Listing cards
    show both prices when set (`🪙 75 or 💎 8`) and, while a listing is
    still `active`, a rough time-left label (`Expires in 6d` / `5h`);
    `expired` got its own (visually same as `cancelled`) status badge.
  - Verified against local Postgres 16 (both `psql -f` and `psql -1`):
    invalid duration rejected, a listing with neither price set
    rejected, a dual-priced listing bought with gems, a gems-only
    listing correctly rejected when paid with coins, insufficient
    balance checked independently per currency, `buy_listing` returning
    the non-exception `unavailable` result and actually flipping an
    expired listing's status (this was the regression check —
    confirmed the listing does NOT silently stay `active` forever, the
    same class of bug the original stale-pet/stale-item handling in
    0018 had already fixed once for a different trigger), and
    `resolve_expired_listings()` sweeping a force-expired listing while
    leaving an unexpired one untouched. UI states (dual-price and
    gems-only cards, an already-expired card, the two-currency buy
    button, the filled-in sell form) were checked visually with headless
    Chromium against a temporary preview route.
- **Two real bugs from live use: item listings needed real escrow, and
  the price filter was silently broken
  (`0020_marketplace_item_escrow.sql`, `src/app/marketplace/page.tsx`)**
  — both reported after actually using the marketplace above.
  - **Item listings didn't reserve anything.** `create_item_listing`
    only ever checked the seller's *live* inventory count at the moment
    of listing — nothing decremented it — so the same single item
    could be listed several times over (each listing call saw the same
    unchanged quantity and happily said yes), and an item sitting in an
    "active" listing could still be spent elsewhere (e.g. brewing) right
    up until someone actually bought it. Fixed by having
    `create_item_listing` actually escrow: decrement the seller's
    `user_inventory` by the listed quantity immediately, the same
    instant the listing goes live. That single change fixes both
    symptoms at once — a second listing attempt now sees the reduced,
    real remaining quantity and correctly fails "you don't have that
    many to list," and brewing (or anything else that reads live
    inventory) correctly sees the item is gone. `cancel_listing`,
    `resolve_expired_listings`, and `buy_listing`'s own inline expiry
    check all credit the escrowed quantity back to the seller when a
    listing ends without a sale; `buy_listing`'s successful-purchase
    path no longer decrements the seller a second time (that would have
    doubly removed it) — it just credits the buyer directly, and the
    "does the seller still have enough" re-check that item listings used
    to need is gone entirely, since escrow guarantees it by
    construction. Pets were never affected by this bug and needed no
    change — a specific `pet_id` can only ever sit in one active listing
    (already enforced), so the "same item listed several times"
    failure mode has no pet equivalent.
  - **Backfill for listings that already existed under the old,
    non-escrowing behavior**: for every currently-`active` item
    listing, escrow it for real now if the seller still has enough
    (the common case), or — for a listing that can no longer be
    honored because the seller already spent it elsewhere while it sat
    "active" (the exact bug just described) — cancel it outright rather
    than inventing inventory that doesn't exist. Verified by literally
    reproducing the reported repro: listed a single item three times
    over on the pre-fix functions (all three succeeded, exactly as
    reported), then applied this migration and confirmed the backfill
    kept exactly one of the three listings active (escrowing the one
    real unit) and cancelled the other two, with the seller's inventory
    landing at zero — matching what should have happened the whole
    time.
  - **The price filter bug**: the browse page built its min/max price
    filter as two separate `.or(...)` calls (one for min, one for max),
    added when gem pricing made "either currency in range" necessary.
    PostgREST doesn't merge two query parameters that share the same
    key — `.or()` chained twice produces two `or=` params, and only one
    of them ends up taking effect, so setting both a min and a max
    silently dropped one of the two. Confirmed directly (no live
    Supabase project needed for this one — `@supabase/supabase-js`'s
    query builder is pure client-side URL construction, so the bug is
    visible just by building the query and inspecting `.url` before
    it's ever sent) and fixed by combining both bounds into a single
    `.or()` call, nesting `and()`/`or()` for the both-set case:
    `or=(and(price_coins.gte.MIN,price_coins.lte.MAX),and(price_gems.gte.MIN,price_gems.lte.MAX))`
    — "coins in range, or gems in range" as one filter instead of two
    competing ones. Re-verified the same way (inspecting the built URL)
    for all three cases — min only, max only, both — confirming exactly
    one `or=` param each time.
  - Verified against local Postgres 16 (both `psql -f` and `psql -1`):
    the full escrow lifecycle (list decrements immediately, listing
    more than what's left over several listings fails, cancel credits
    back, a real purchase credits the buyer without touching the
    seller's already-decremented balance a second time, both expiry
    paths — the lazy sweep and `buy_listing`'s own inline check — credit
    back correctly), plus the backfill reproduction above.
- **Forums (`0021_forums.sql`, `src/lib/sanitize-forum-html.ts`,
  `src/components/forums/post-editor.tsx`, `/admin/forums`, `/forums`)**
  — admin-managed categories/subcategories, player threads and posts,
  with a WYSIWYG-or-raw-HTML editor and server-side sanitization as the
  actual security boundary.
  - **Schema**: `forum_categories` (self-referencing `parent_id`, nullable
    — a NULL-parent category is "top-level"; the two-level depth is a UI
    convention, not a DB constraint, since only top-level categories are
    ever offered as a parent choice in the admin form) gets the same
    admin-only-write RLS + `log_admin_action()` audit trigger as
    items/species/zones (`0009_admin_panel.sql`). `forum_threads` and
    `forum_posts` are player-authored instead, so they use the plainer
    `pet_folders`-style RLS (`with check (auth.uid() = author_id)`, plus
    an active-category check on thread insert and a not-locked check on
    post insert) rather than a security-definer RPC — there's no
    currency/game-economy stake here, just "you can only post as
    yourself," which that policy already enforces natively. A
    `security definer` trigger (`sync_forum_thread_stats`) keeps
    `forum_threads.reply_count`/`last_post_at` in sync on every post
    insert, the same technique `log_admin_action()` uses to write past a
    client-facing RLS policy that's otherwise admin-only.
  - **The sanitizer is the only security boundary, not the editor**:
    `sanitizeForumHtml()` (`sanitize-html`, Node-only) runs on every post
    write regardless of whether it came from the WYSIWYG editor or
    hand-typed "Code" mode — the client is never trusted either way. It
    allowlists a fixed set of formatting tags and — critically — never
    allowlists `<iframe>`/`<video>`/`<audio>`/`<embed>`/`<object>` at
    all, combined with `disallowedTagsMode: "discard"` (drops the tag
    *and* its contents). That's the entire mechanism behind "players can
    link videos/music but not embed them" — a link is just an `<a>`,
    which stays allowed; an embed tag has nowhere to hide. `<script>`,
    `<style>`, inline event handlers, and `javascript:`/`data:` URLs are
    stripped the ordinary way any HTML sanitizer would.
  - **A Tailwind-specific hole that generic "just sanitize the HTML"
    advice wouldn't catch**: this whole site is styled with global
    Tailwind utility classes, so naively allowing a `class` attribute on
    user content would let a post style itself using the *site's own*
    classes — e.g. `class="fixed inset-0 z-50 bg-black"` as a full-page
    overlay, not just decoration inside the post. `class` is therefore
    never allowed on any tag, full stop. `style` is offered instead for
    the Toyhouse-style custom-look posts this was meant to support, but
    only a fixed per-property allowlist of regex-validated values
    (`color`, `font-*`, `text-*`, `border*`, `padding`/`margin`,
    `width`/`height`) — deliberately excluding `position` (redress again)
    and `background-image` (a `url(...)` is just an embed by another
    name).
  - **Editor component (`PostEditor`)**: one client component shared by
    new-thread and reply forms, holding a single `content` string plus an
    `editor_mode` flag as the two hidden form fields actually submitted.
    Visual mode is TipTap (`StarterKit` + `Underline`/`Link`/`Image`)
    with a small custom toolbar — bold/italic/underline/strike,
    headings, lists, blockquote, link, and image-by-URL — deliberately
    with no video/embed button, matching the sanitizer. Code mode is a
    plain `<textarea>` over the same `content` state. Switching Code →
    Visual calls `editor.commands.setContent(content)` so hand-typed HTML
    loads back into the live editor (TipTap's own schema reinterprets it,
    which is fine — it's a convenience re-parse, not a security step).
    Since `@tailwindcss/typography` isn't installed, a small
    `.forum-content` rule set was added to `globals.css` to style the
    sanitizer's allowed tags (headings, lists, blockquote, tables, code
    blocks) — otherwise Tailwind's preflight reset would render them as
    unstyled text; this same class wraps both the live TipTap editor and
    the rendered `body_html` on thread pages.
  - **Verified two ways**: (1) `sanitizeForumHtml()` itself, run directly
    via `npx tsx` (pure Node, no Supabase/browser needed) against a
    payload combining `<script>`, `<iframe>`, `<video>`, `<audio>`,
    `<embed>`, `<object>`, `<svg onload>`, a `<form>`, `<style>`,
    `<base>`, a `javascript:` image `src` or link `href` with inline
    event handlers, and the Tailwind-class overlay attempt described
    above — confirmed every one of those was stripped to nothing (or had
    just the dangerous attribute/scheme removed, e.g. `<img>` losing its
    `javascript:` `src`), while a plain `<a href="https://…">` link to a
    video URL and a `style="color:…;font-weight:…"` paragraph both
    survived intact, matching "link it, don't embed it" and "safe
    styling still works" exactly. (2) The admin category form and
    `PostEditor` were checked visually with headless Chromium against a
    temporary preview route mounting the client components directly with
    mocked data (deleted before finishing, same as prior modules) — typed
    into the visual editor, switched to Code mode and confirmed the
    textarea held the exact TipTap-generated HTML, edited that raw HTML
    and switched back to Visual to confirm it re-loaded correctly, and
    rendered the sanitizer's output through the real `.forum-content`
    CSS to confirm headings/lists/blockquote/links/styled text all look
    right and the stripped elements leave no visual trace. The
    `0021_forums.sql` schema itself (RLS on all three tables, the
    admin-only category audit trigger, the thread-stats sync trigger,
    author-only edit/locked-thread/deactivated-category enforcement) was
    separately verified against local Postgres 16 (both `psql -f` and
    `psql -1`) before any of the above.
- **Wireframe page layout (`src/app/layout.tsx`, `src/components/
  site-header.tsx`, `site-nav.tsx`, `nav-groups.tsx`, `site-footer.tsx`)**
  — a from-a-wireframe redo of the site-wide chrome: every page now
  renders inside one shared shell, wired once in the root layout rather
  than per page.
  - **Single wrap point, zero per-page changes**: every existing page
    already rendered its own `<main className="mx-auto flex w-full
    max-w-{…} flex-1 flex-col … px-6 py-12">` (a consistent pattern
    across all ~25 routes). Rather than touch every one of those files,
    the white content box was added once in the root layout, wrapping
    `{children}`, itself using `flex flex-1 flex-col` — so each page's
    own `flex-1 main` still stretches to fill it and its own `mx-auto
    max-w-*` still centers/constrains its content exactly as before,
    just inside the box instead of directly on the page background.
  - **Header** (`SiteHeader`) is now just two pieces: a logo placeholder
    (green box, links home — literally a placeholder for real logo art
    later, per the wireframe) and a user-info box (yellow) with the
    existing avatar/coin/gem/sign-out content, or a "Sign in" button
    when signed out. The old inline nav links were pulled out of it
    entirely.
  - **Nav** (`SiteNav` + `NavGroups`) replaces the old flat row of links
    with grouped, foldable sections — Play (Expeditions/Pets/Items/
    Brewing), Trade (Marketplace, plus Trades if `TRADING_ENABLED`),
    Community (Forums), Account (Settings, plus Admin if the signed-in
    user is one) — matching the wireframe's "sections are grouped
    together and fold into a dropdown when clicked." `SiteNav` (server)
    resolves the signed-in user/admin status and builds the group list
    server-side, same pattern as the header; `NavGroups` (client) is the
    interactive part — one group open at a time, click the open one to
    close it, click another to switch, click outside to close. Nav is
    only rendered when signed in, same as the nav it replaced.
  - **Background**: a placeholder diagonal-stripe pattern on `body`
    (`repeating-linear-gradient` over a flat blue, in `globals.css`)
    stands in for the real background image the wireframe calls for
    later — swapping one `background-image` line for `url(...)` when
    that art exists is the entire migration, nothing else about the
    layout depends on it being a pattern specifically.
  - **What deliberately didn't change**: the amber accent palette
    (buttons, links, cards) used throughout individual page content —
    the wireframe only specifies the site-wide chrome (header/nav/
    content box/footer/background), not the content inside the white
    box, so existing page-level styling was left alone.
  - Verified with headless Chromium against the real, unmodified `/`
    route (signed out — this sandbox has no live Supabase project, but
    `createClient()` against a placeholder URL still renders the
    signed-out branch correctly, which is real code, not a mock),
    confirming the logo box, sign-in box, white content box, and footer
    all matched the wireframe. The signed-in header/nav needs a real
    session this sandbox doesn't have, so that part was checked via a
    temporary preview route (deleted before finishing) that mounted the
    actual `NavGroups` component with mock groups next to a hardcoded
    visual replica of the signed-in header — confirmed the fold/dropdown
    interaction (open → switch groups → close-on-outside-click) all
    behave correctly.
- **Forums redesign: BBCode editor + phpBB-style layout
  (`0022_forum_bbcode_and_views.sql`, `src/lib/bbcode.ts`,
  `src/components/forums/*`, `/forums/*`)** — replaced the original
  WYSIWYG-or-raw-HTML forum editor and gave the whole forums section a
  visual overhaul, both from a reference screenshot of a classic
  phpBB/Chicken-Smoothie-style forum.
  - **Why BBCode instead of "sanitize whatever HTML came in"**: the
    previous design (TipTap WYSIWYG + a raw "Code" mode, sanitized with
    `sanitize-html`) meant a player could submit arbitrary HTML that the
    server then had to filter down to something safe — the classic
    allowlist-of-arbitrary-input security model, one missed tag/
    attribute away from a hole. BBCode flips that: a player never
    submits HTML at all, only a fixed vocabulary of `[tag]` markers.
    `bbcodeToHtml()` (`src/lib/bbcode.ts`) is the only code that ever
    writes an HTML tag or attribute — there's no way for a post to
    introduce one this file doesn't already know how to produce, so
    there's nothing to filter *out* in the first place. `editor_mode`
    (wysiwyg vs. raw) is gone entirely — there's only one editor now,
    and typing `[b]` by hand instead of clicking the Bold button already
    *is* the "advanced" option Toyhouse-style raw mode used to be for.
  - **Parser**: a small hand-written tokenizer + recursive-descent tree
    builder (not regex-chaining, which breaks on nesting) — supports
    `[b] [i] [u] [s] [sup] [sub] [h1]-[h3] [quote] [hr] [align=] [size=]
    [color=] [highlight=] [font=] [url] [img]`, correctly nested (e.g.
    `[b][color=...]...[/color][/b]`). An unrecognized tag name, a stray
    closing tag with no opener, or an unclosed tag at EOF all degrade to
    literal text/auto-close rather than erroring — matches how every
    real BBCode forum behaves. `[img]`/bare `[url]` capture their inner
    content raw (never re-parsed as nested BBCode), since a URL
    containing something that looks like a tag should stay literal.
    Still no `[video]`/`[audio]`/`[iframe]`/`[embed]` tag exists at all
    — the video/audio-embed restriction from the original spec now
    holds by construction (there's no code path that could ever emit
    one) rather than by an allowlist someone could get wrong.
  - **What's validated**: `[color=]`/`[highlight=]` against a hex/rgb()/
    named-color regex, `[font=]` against a safe-charset regex,
    `[align=]` against `left/center/right/justify`, `[size=]` against a
    fixed 1-7 lookup table (mapped to em values — no free-form CSS
    length), and `[url=]`/bare `[url]`/`[img]` against an `http(s)/
    mailto` scheme allowlist (blocks `javascript:`/`data:`). An invalid
    value drops just that tag's styling rather than the content inside
    it. Every link gets `target="_blank" rel="noopener noreferrer
    nofollow ugc"` forced on, same as before.
  - Verified directly (`npx tsx`, no browser/DB needed) against the
    mockup's own sample post (confirms nesting renders identically:
    bold, colored+highlighted text, sup/sub, h1/h3) plus a battery of
    adversarial input — a literal `<script>` tag (escaped, inert), fake
    `[video]`/`[iframe]`/`[embed]` tags (no such tag exists, pass
    through as literal bracket text), `javascript:`/`data:` URLs in
    `[url]`/`[img]` (scheme rejected, tag drops to plain text/nothing),
    a CSS-injection attempt via `[color=red;position:fixed;...]` (fails
    the color regex, style dropped, content kept), an unclosed `[b]`
    (auto-closes at EOF), and a stray `[/b]` with no opener (literal
    text) — every case behaved exactly as designed.
  - **Layout**: new shared `ForumPanel`/`ForumPanelSection` (bordered
    box, colored header bar) and `PaginationBar` components used across
    all three forum pages for a consistent look. `/forums` gained a
    "Quick Jump" sidebar (every category/subcategory as a flat list of
    jump links) beside the existing category-index panel. `/forums/
    [categoryId]` now separates pinned topics into their own panel above
    the regular thread list, shows per-thread View and Reply counts, and
    paginates (20 threads/page) instead of loading every thread at once.
    `/forums/[categoryId]/[threadId]` restyled each post as a card
    (avatar, author, timestamp, rendered BBCode) and paginates replies
    (10/page); posts also gained a working **Edit** button (a post's
    author or an admin can revise it — the existing "Authors and admins
    can edit a post" RLS policy from 0021 already allowed this, there
    was just no UI for it yet) and a **Report** button that's
    deliberately inert (grayed out, `disabled`, a tooltip explaining
    it's not built yet) rather than a live-looking control that quietly
    does nothing — full moderation/reporting is a bigger feature than
    this pass was scoped for.
  - **New `view_count`** on `forum_threads`, incremented via a
    `security definer` RPC (`increment_thread_view_count`, granted to
    `anon` as well as `authenticated` — the first anon-granted function
    in this app, since forum threads are publicly readable without
    signing in and view-counting has to work for anonymous visitors
    too) on every thread-page load. Best-effort by design, like most
    forum view counters — not deduplicated per visitor.
  - Removed the TipTap dependency tree entirely (`@tiptap/react`,
    `@tiptap/starter-kit`, `@tiptap/pm`, and the three extension
    packages) along with `sanitize-html`/`@types/sanitize-html` and the
    old `post-editor.tsx`/`sanitize-forum-html.ts` — nothing in the app
    references them anymore, confirmed by grepping before deleting.
  - Verified the `0022` migration the same way as `0021` (local
    Postgres 16, both `psql -f` and `psql -1`): confirmed
    `forum_posts.editor_mode` is gone, `forum_threads.view_count`
    exists and defaults to 0, a non-admin's *direct* `UPDATE` of
    `view_count` is still rejected by the existing admin-only RLS policy
    (`UPDATE 0`), and that same non-admin *can* bump it through
    `increment_thread_view_count()` as both `anon` and `authenticated`.
    The redesigned pages, the BBCode editor's toolbar (bold, font color,
    font size, horizontal-rule-at-cursor — each checked by reading the
    textarea's actual value back after the click, not just eyeballing
    it), and the rendered post cards were checked visually with headless
    Chromium against a temporary preview route mounting the real
    components with mock data (deleted before finishing, same as every
    other module).
- **Forums follow-up fixes: divider categories, reply toggle, preview,
  icons, avatars (`0023_forum_category_no_direct_posts.sql`,
  `src/components/forums/*`, `/forums/*`)** — a round of feedback after
  actually using the redesigned forums.
  - **Parent categories can no longer be posted in.** A top-level
    category with subcategories is a pure divider — just a visual way
    to group forums, not a place threads live. Enforced at the RLS
    layer (rewrote the `forum_threads` INSERT policy to also require
    `not exists (... where parent_id = category_id)`) as the real
    backstop, with app-level checks in `createForumThread` and the
    `/new` page giving a friendly message / redirecting instead of
    showing a form that would only fail on submit — same
    backstop-vs-convenience split every other write path in this app
    uses. A category page for one of these dividers now shows only its
    subcategory list (no "New Post" button, no pinned/thread panels).
    Verified against local Postgres: posting directly in a parent with
    a subcategory is rejected by RLS, while posting in that same
    subcategory, or in an ordinary category with no children, both
    succeed.
  - **Reply box now stays hidden until clicked** (`ReplyToggle`, a small
    client wrapper) — a "Reply" button in place of the always-visible
    form; clicking it mounts the actual reply form (and the BBCode
    editor along with it) rather than showing an empty text box by
    default.
  - **BBCode Preview toggle** — `BBCodeEditor` gained a Preview/Write
    toggle. `bbcodeToHtml()` (`src/lib/bbcode.ts`) is a pure function
    with no DOM/Node dependency, so it runs client-side too: toggling
    Preview renders the current draft through the exact same renderer
    that'll process it server-side on submit, no separate preview-only
    code path to keep in sync. The textarea stays mounted (just
    `hidden`) while previewing so the draft isn't lost switching back.
  - **Emoji replaced with `lucide-react` icons** throughout the forums —
    panel headers, thread pin/lock indicators, Edit/Report buttons, the
    BBCode toolbar (Bold/Italic/Underline/Strikethrough/Quote/
    horizontal-rule/alignment/font-size/font-color all became real
    icons instead of raw Unicode/emoji characters), and pagination
    arrows. Purely cosmetic, but also the excuse for the wider polish
    pass below.
  - **Wider, larger post layout** — the thread view widened from
    `max-w-3xl` to `max-w-5xl` (matching the other forum pages), post
    card padding/avatar size/body text size all increased, and panel
    headers got more breathing room — addresses "everything looks
    cramped/small" in one pass alongside the icon swap, both aimed at
    reading closer to a mature phpBB/Chicken-Smoothie-style forum.
  - **Avatar bug**: post cards were rendering `authorAvatarUrl` through
    a plain `<img>` tag, sent directly to `lh3.googleusercontent.com`
    from the browser — a client-side ad-blocker/privacy extension
    targeting Google's raw image CDN (a common filter-list target) would
    silently break it, even though the exact same avatar URLs render
    fine elsewhere in the app (`site-header.tsx`) via `next/image`, which
    proxies the request through the app's own `/_next/image` endpoint
    instead of hitting Google's domain directly from the browser — and
    that host was already allowlisted in `next.config.ts` for exactly
    this reason. Switched post-card avatars to `next/image` to match.
    Couldn't exercise the real Google-hosted URL from this sandbox (its
    egress proxy blocks `googleusercontent.com`/`placehold.co`, the same
    limitation noted in earlier modules) — verified the `<Image>`
    pipeline itself (sizing, cropping, border) renders correctly using a
    same-origin local asset standing in for the URL instead.
  - Build + lint clean; the RLS change re-verified against local
    Postgres 16 (`psql -f`, plus the full chain again in `psql -1`); the
    rest checked visually with headless Chromium against a temporary
    preview route (deleted before finishing) mounting the real
    `ForumPanel`/`PaginationBar`/`BBCodeEditor`/`ReplyToggle` components,
    including clicking through the Reply toggle and the BBCode Preview
    toggle to confirm both actually work, not just render.
- **BBCode round two: floats, a confirm step on font color, and more
  tags (`src/lib/bbcode.ts`, `src/components/forums/bbcode-editor.tsx`)**
  — feedback from actually writing posts with it.
  - **`[left]`/`[right]` are floats, not just `text-align`** — added
    alongside the existing `[align=]` (still supported, unchanged).
    This is specifically what makes the classic Chicken-Smoothie-style
    trick work: `[left][img]...[/img][/left][left]some text[/left]`
    puts the image and the paragraph next to each other instead of
    stacked, because two adjacent `float:left` elements queue up
    left-to-right in CSS — that's genuine browser layout behavior, not
    something this app has to implement itself. `[center]` stays
    non-floating (floating a centered block doesn't mean anything).
    Added a clearfix on `.forum-content` so a post's floated content
    can never visually leak past the end of that post.
  - **Font color now has a confirm step.** The previous toolbar wired
    `wrapSelection` straight to the color `<input>`'s `onChange` —
    React fires that event on *every* drag movement inside the native
    color picker (not just once you let go), so dragging around to
    find a color was wrapping the selection in a new `[color=]` tag on
    every intermediate value. Replaced it with a small popover: the
    color input now only updates local draft state as you drag, and
    `wrapSelection` runs exactly once, when the popover's own Apply
    button is clicked (Cancel or clicking outside discards the draft
    instead) — matching `nav-groups.tsx`'s existing click-outside
    pattern. Verified by scripting several simulated drag events before
    Apply and confirming the textarea was untouched until the click.
  - **New tags**: `[list]`/`[list=1]` + `[*]` (unordered/ordered lists
    — `[*]` has no closing tag, so it needed its own token kind and a
    dedicated item-splitting parse path alongside the normal
    open/close/void handling) and `[code]` (a raw, monospace block —
    joins `[img]` as a tag whose content is captured verbatim and never
    re-parsed as BBCode, so pasting example BBCode syntax into a code
    block shows it literally instead of interpreting it). `[video]`/
    `[audio]`/`[iframe]`/`[embed]` remain permanently absent — no tag
    for them exists anywhere in this file, which was and still is the
    entire mechanism behind "no embeds," so there was nothing to
    re-verify there, only to leave alone.
  - Verified the parser directly (`npx tsx`) against the literal
    Chicken-Smoothie float example, nested/ordered lists, a list with
    malformed input (content before the first `[*]`, correctly
    dropped), a stray `[*]` outside any list (falls through as literal
    text, like every other unmatched token), code blocks preserving
    `[b]`/`[img]`/`[*]` as literal text, and re-ran every earlier
    security case (`javascript:` URLs, CSS-injection via `[color=]`,
    fake `[video]` tags) to confirm nothing regressed. Caught a real bug
    this way in the editor (not the parser): the first cut of the new
    List/Ordered-List toolbar buttons built the full `[list]...[/list]`
    markup and then routed it through `wrapSelection`, which *also*
    re-inserts the original selected text — duplicating it. Fixed by
    having the list buttons write the textarea directly instead of
    going through `wrapSelection`, and re-verified (including the
    empty-selection case, which now drops in a single empty `[*]` to
    type into). The float layout itself was checked two ways: visually
    (headless Chromium, temporary preview route as usual) and by
    reading back the rendered elements' `getComputedStyle().float` and
    bounding boxes directly, confirming two `[left]` blocks really do
    land at the same y-coordinate side by side — not just "looks close
    enough" in a screenshot.
- **Round three: 1-200% font sizing, a font-family button, an admin
  dropdown, and edit tracking (`0024_forum_post_edit_tracking.sql`,
  `src/lib/bbcode.ts`, `src/components/forums/bbcode-editor.tsx`,
  `/forums/[categoryId]/[threadId]/*`)** — another pass of feedback.
  - **`[size=]` is now 1-200%** (Chicken-Smoothie-style fine control)
    instead of picking from 7 named steps — `[size=150]` means 150% of
    the surrounding text. The toolbar's size control became a popover
    with a number input + Apply, for the same reason the color picker
    got one: a live-wired number input fires on every keystroke, so it
    needed the same "draft value, explicit confirm" treatment. Both
    popovers now share one `ToolbarPopover` component instead of two
    near-identical copies.
  - **Font family button** — `[font=]` already existed in the parser
    with no way to reach it from the toolbar; added a plain `<select>`
    (a curated safe list — Arial, Georgia, Times New Roman, etc.) next
    to the size/color buttons. No popover needed here, since a `<select>`
    only fires once per pick, not continuously like a color/number input.
  - **Admin pin/lock controls moved into a dropdown** behind a small
    gear icon in the thread panel's own header bar (top-right, next to
    the title) instead of an always-visible strip across the top of
    every post — matches the hamburger-menu affordance from the
    original reference mockup. Same click-outside-to-close pattern as
    `nav-groups.tsx` and the BBCode editor's popovers.
  - **"Last edited by X at TIME. This post has been edited N times."**
    under any post that's actually been revised. Needed two new
    `forum_posts` columns — `edit_count` and `last_edited_by` (the
    editor isn't always the author: an admin can edit someone else's
    post, and RLS already allowed that) — kept in sync by a `before
    update` trigger (`track_forum_post_edit()`) rather than the app
    computing/passing a counter itself, matching how `reply_count`/
    `last_post_at` and `view_count` are already handled elsewhere in
    this schema. It only bumps when `body_raw` actually changed (not on
    every `UPDATE`, though there's only one update path today), and
    sets `last_edited_by` from `auth.uid()` rather than trusting
    anything the client sends. Verified directly against local Postgres
    16: edit count and `edited_at` start at 0/null, incrementing on a
    real content change; a second edit by an *admin* (not the original
    author) bumps `last_edited_by` to the admin's id while `author_id`
    stays unchanged, proving the "may differ from the author" case;
    and a no-op update (identical `body_raw`) leaves `edit_count`
    untouched, confirming it's not just counting `UPDATE` statements.
  - This surfaced a real gap in the local verification harness, not an
    app bug: `track_forum_post_edit()` is the first trigger body in this
    codebase to call `auth.uid()` directly rather than only inside an
    RLS `USING`/`WITH CHECK` expression, which needs `usage on schema
    auth` — something real Supabase projects already grant to `anon`/
    `authenticated` by default, but the hand-rolled local stub never
    had reason to add until now. Fixed by adding that grant to the stub
    (not a migration — this app doesn't manage Supabase's own `auth`
    schema), documented inline for the next time this comes up.
  - Verified visually (headless Chromium, temporary preview route as
    usual): the font-size/font-family/color toolbar controls, and the
    admin dropdown opening from the gear icon and closing again on an
    outside click.
- **Profile customization (`src/app/settings/settings-form.tsx`,
  `/profile`, `/u/[id]`)** — reused the forums' BBCode editor/renderer
  wholesale for the profile bio field instead of building a separate
  system.
  - **No migration needed.** `users.bio` already existed as a plain
    text column; it just holds raw BBCode source now instead of plain
    text, and `bbcodeToHtml()` renders it fresh on every `/profile` and
    `/u/[id]` page view. Forum posts precompute and store `body_html`
    because a thread page renders many posts at once and that's worth
    avoiding repeated work for — a profile page only ever renders one
    bio, so there's no such benefit here, and rendering at read time
    means there's no separate raw/rendered pair that could ever drift
    out of sync. Either way, `bbcodeToHtml()` is still the only thing
    that ever turns it into HTML — this is a timing choice, not a
    different security posture.
  - Raised the limit from 500 to 2000 characters, since BBCode markup
    itself now eats into that budget (`[color=#ffffff]...[/color]` is
    20 characters of overhead before any actual text). `BBCodeEditor`
    gained optional `rows`/`maxLength` props (both previously
    hardcoded) so the bio field could ask for a shorter box and a
    different cap than forum posts use, without forking the component.
  - Verified visually (temporary preview route, as usual): typed BBCode
    in the settings form, confirmed the exact same toolbar forum posts
    use is available, and confirmed the rendered result below it
    (bold/color/italic/size all applied correctly) matches what
    `/profile` and `/u/[id]` will actually show.
- **Player dashboard & public profile redesign, player avatars
  (`src/app/profile/page.tsx`, `src/app/u/[id]/page.tsx`,
  `src/components/site-nav.tsx`, `src/components/disabled-action-button.tsx`,
  `src/lib/avatar-upload.ts`, `0025_player_avatars.sql`)** — matched a
  layout mockup: a two-column grid (picture/name/join-date/stats/actions on
  the left, "view your stuff"/bio on the right), and moved Pets/Items out
  of the "Play" nav group into a new "My Stuff" group.
  - `/profile` (own dashboard) keeps every existing feature — coin/gem/den
    stats, Expand Den, active expedition, Pets/Items links, bio — just
    reorganized into the new grid. Nothing here needed graying out; it's
    all already built.
  - `/u/[id]` (public view) is where the "gray out what isn't built yet"
    request actually applies: Add Friend, Send DM, and Report Player are
    real buttons with a real spot in the layout, but disabled (new shared
    `DisabledActionButton` — same disabled/cursor-not-allowed/`title`
    convention as the forum post Report button) since none of those
    features exist yet. "Propose a trade" sits in the same button row and
    stays fully real (still behind `TRADING_ENABLED`) — there's no public
    per-player Pets/Items browsing page yet either, so those two buttons
    are grayed out too rather than linking somewhere real.
  - **Player avatars stop importing the Google account photo.**
    `handle_new_user()` (the trigger that creates a `public.users` row on
    first Google sign-in) no longer reads `raw_user_meta_data ->>
    'avatar_url'/'picture'` — new players start with `avatar_url = null`
    and see the same placeholder circle every page already falls back to.
    Players can upload their own picture from `/settings` instead — a new
    `avatars` Storage bucket (public read, same public-bucket-with-gated-
    writes shape as `game-images`) whose write policies check `(storage.
    foldername(name))[1] = auth.uid()::text`, so a player can only write
    into their own `{user_id}/` folder, not anyone else's. Upload path is
    always `{user_id}/avatar.{ext}` with `upsert: true` (mirrors
    `uploadGameImage()`'s pattern in `game-image-upload.ts`) so re-
    uploading replaces the one file instead of accumulating orphans;
    removing an avatar lists that folder (the extension isn't known at
    removal time — upload() could've landed png/jpg/webp/gif) and deletes
    whatever's there, then clears `avatar_url`.
  - The settings form's file input shows a live preview via
    `URL.createObjectURL()` before upload, and a "Remove profile picture"
    button (only shown when one exists) submits through a second, plain
    `removeAvatar` action via the submit button's `formAction` override —
    same form, two possible actions, matching the app's existing "Remove"
    button convention (no confirmation step, just does it) rather than a
    separate form.
  - Verified the migration against local Postgres: a fresh signup with
    Google `picture`/`avatar_url` metadata present ends up with
    `avatar_url is null`; as the signed-up user, inserting into her own
    `{user_id}/` avatar folder succeeds, inserting into a different
    user's folder is blocked by RLS, and deleting her own file succeeds.
    This required two small additions to the local stub (not the app):
    `storage.foldername()` didn't exist yet (real Supabase provides it;
    the stub only had bare `storage.buckets`/`storage.objects` tables),
    and `usage on schema storage` / grants on `storage.objects` hadn't
    been needed by any earlier migration's tests.
  - Verified visually (temporary preview route, as usual): the nav bar's
    new "My Stuff" group, the two-column `/profile` and `/u/[id]` layouts
    side by side, and the settings avatar upload control (preview circle,
    file picker, Remove button) — all against the mockup's layout.
- **Profile layout follow-up (same files, plus `src/app/pets/page.tsx`,
  `src/lib/den-expansion.ts`)** — a few fixes from actually using the
  redesign above.
  - Avatars are square now (`rounded-md`, not `rounded-full`) on
    `/profile`, `/u/[id]`, and the `/settings` upload preview/placeholder
    — matches the original mockup, which showed a square "Profile
    Picture" box. Left untouched: the small 24px avatar badge in
    `site-header.tsx`, since that's a nav-pill icon, not "the profile
    picture" the ask was about.
  - The two-column grid went from an even `grid-cols-2` split to
    `grid-cols-5` with the left column at `col-span-2` and the right at
    `col-span-3` (both `/profile` and `/u/[id]`, since they share the
    same layout) — the bio/BBCode side actually benefits from extra
    width; a picture, three stats, and a couple of buttons don't. The
    Player Stats box shrank from a padded 2×2 `<dl>` grid to a single
    compact row (coins/gems/pets, no more den size on its own — it's
    folded into "pets owned").
  - **Den expansion moved off the dashboard onto `/pets`**, right next to
    the pet count/capacity it actually affects (`Pets (12 / 50)` header,
    button beside it) — freeing up a box's worth of vertical space on
    `/profile` for the resize above, and putting the action where a
    player would actually go looking for it. `ExpandDenButton` moved from
    `src/app/profile/` to `src/components/` (it was never profile-
    specific, just hadn't had a second caller yet), and its cost-curve
    helper (`nextDenExpansionCost`) moved to a new `src/lib/
    den-expansion.ts` so both pages compute the same display-only number
    without duplicating the formula — the real cost is still always
    re-derived and enforced server-side by the `expand_den()` RPC either
    way, this is display-only.
  - **Fixed a hydration-warning false alarm**, not an app bug: browser
    extensions (ColorZilla, in the report — `cz-shortcut-listen`) inject
    attributes onto `<body>` before React hydrates, which the dev overlay
    reports as a mismatch even though it's harmless and outside the app's
    control. Added `suppressHydrationWarning` to the `<body>` tag in
    `src/app/layout.tsx` — per React's own docs, this only suppresses the
    warning for that one element's own attributes, not for its children,
    so it won't hide a real mismatch anywhere else in the tree.
  - Verified visually (temporary preview route, as usual): square avatars
    and the new column ratio on both `/profile`- and `/u/[id]`-shaped
    layouts side by side, the compact single-row stats, and the Expand
    Den button in its new spot on the `/pets` header.
- **Direct messages (`0026_direct_messages.sql`, `src/app/messages/`,
  `src/lib/dm-unread.ts`, `src/components/site-header.tsx`,
  `src/components/site-nav.tsx`, `src/app/u/[id]/page.tsx`)** — one
  conversation per pair of players, reusable for replies with no separate
  code path (any message sent into an existing conversation IS a reply),
  and intentionally shaped so a future reports or notifications system
  could reuse the same conversation/message pattern without needing this
  table itself.
  - **Canonical pair ordering, not "sender/recipient."**
    `dm_conversations.user_one_id`/`user_two_id` are always stored with
    `user_one_id < user_two_id` (uuid has a real ordering), enforced by a
    check constraint plus a unique index on the pair — so it's
    structurally impossible to end up with two separate conversations for
    the same two players depending on who messaged whom first.
    `get_or_create_dm_conversation()` (security definer, same
    `auth.uid() is distinct from p_user_id then raise exception`
    impersonation guard as `expand_den()`/every other RPC in this app)
    computes `least()`/`greatest()` of the two ids, then does an atomic
    `insert ... on conflict do nothing` + `select` — safe to call from
    both sides without a race creating a duplicate.
  - **Read tracking without a per-message row.** Rather than a
    `read_at` column on every message (which gets murky once you ask
    "read by whom" beyond a strict 1:1 thread) or a separate
    read-receipts table, each conversation carries exactly two read
    markers (`user_one_last_read_at`/`user_two_last_read_at`). Unread is
    just `last_message_at > my marker`. The trick that makes this work
    with zero extra bookkeeping calls: **sending a message also bumps the
    sender's own marker** — you've obviously "read" the message you just
    sent — so a conversation is never unread for the person who sent its
    last message, with no separate "does this concern me" branch needed
    anywhere. `mark_dm_conversation_read()` (called once, as a side
    effect of loading `/messages/[conversationId]`, same pattern as
    `increment_thread_view_count()` on the forum thread page) advances
    only the caller's own marker.
  - **Denormalized preview fields, kept in sync by a trigger.**
    `last_message_at`/`last_message_body`/`last_message_sender_id` on
    `dm_conversations` are written by `sync_dm_conversation_on_message()`
    (an `after insert` trigger on `dm_messages`, same "bookkeeping via a
    trigger, not app-computed values" pattern as
    `sync_forum_thread_stats()`/`track_forum_post_edit()`) — the inbox
    list renders a sorted list with a snippet from one query instead of
    an N+1 "last message per conversation" lookup.
  - **RLS is the real backstop**, as everywhere else in this app:
    `dm_conversations` has no insert/update/delete policy at all (every
    write goes through the security definer functions above) and its
    select policy is just "you're one of the two participants."
    `dm_messages`' insert policy checks both `sender_id = auth.uid()`
    (can't send as someone else) and that the caller is a participant in
    the target conversation (can't inject a message into a conversation
    that isn't theirs); its select policy mirrors the same participant
    check. No update/delete policy — messages are permanent, no edit or
    unsend in this first version.
  - **Plain text, not BBCode.** Forum posts and the profile bio both go
    through `bbcodeToHtml()`; DMs deliberately don't — a private message
    isn't a formatted post, and rendering it as plain, escaped text
    (`whitespace-pre-wrap`, no `dangerouslySetInnerHTML` anywhere in this
    feature) keeps the surface area smaller for a feature that's about to
    carry reports next.
  - `/messages` is the inbox: conversations sorted by `last_message_at`
    descending, other participant's name/avatar resolved via
    `user_profiles` (one batched `.in()` lookup, not N+1), a bold name +
    dot for unread, and a small "message a player by username" box
    (`display_name` is already unique/case-insensitive — see
    `0014_unique_display_names.sql` — so an `ilike` lookup with no
    wildcards is an exact, case-insensitive match) that starts a
    conversation and redirects straight into it. `/messages/
    [conversationId]` is the thread: chat bubbles (mine right-aligned/
    amber, theirs left-aligned), a reply box at the bottom, capped at the
    most recent 200 messages (no pagination UI yet — a private 1:1 thread
    getting that long is an edge case worth revisiting later, not a
    first-version requirement). RLS scopes the conversation lookup to
    participants already, so a wrong or someone-else's conversation id
    both land on a plain 404 rather than needing a separate ownership
    check.
  - The header's Mail icon shows an unread-count badge (capped display at
    "9+") computed from the same `isConversationUnread()` helper the
    inbox list uses (`src/lib/dm-unread.ts`) — one shared function so the
    badge and the inbox's unread dots can never disagree about what
    counts as unread.
  - The "Send DM" button on `/u/[id]` (previously permanently disabled)
    is now real: a tiny form posting the target player's id to
    `startConversationWithUserId`, which resolves/creates the
    conversation and redirects. Add Friend and Report Player stay
    disabled — still not built, per the ask to only wire up DMs this
    round.
  - Verified against local Postgres: `get_or_create_dm_conversation` is
    idempotent and order-independent (calling it as either player returns
    the same conversation, and only one row ever exists), rejects
    messaging yourself, a nonexistent player, and a caller passing a
    `p_user_id` that isn't their own; RLS lets a participant read/send and
    blocks a third player from reading or inserting, and blocks
    `sender_id` spoofing; the sync trigger updates the preview fields and
    bumps only the sender's own read marker; `mark_dm_conversation_read`
    only ever advances the caller's own marker and rejects impersonation
    too.
  - Verified visually (temporary preview route mounting the real
    `NewMessageForm`/`ReplyForm` components, as usual): the header badge,
    the inbox list's unread state, and the thread view's chat bubbles.
- **DM redesign to match the forums (same files)** — the chat-bubble look
  read as a texting app, not part of this site, so both DM pages were
  rebuilt on the forums' own components instead of new one-off styling.
  - `/messages` now wraps its conversation list in the shared
    `ForumPanel` (the same bordered-panel-with-amber-header-bar shell
    used by the Forum Index, thread lists, and thread views) and renders
    conversations as table rows copying the thread-list page's
    `ThreadTable` shape exactly: an icon column (a filled `Mail` for
    unread, an open `MailOpen` for read — standing in for the
    locked/unlocked icon column on a thread list), avatar, name + last-
    message snippet, and a right-aligned timestamp column.
  - `/messages/[conversationId]` dropped the bubble layout entirely.
    Each message now renders through a `MessageCard` component that's
    structurally identical to the forum thread view's `PostCard` — an
    avatar-and-name column on the left (`sm:w-32 sm:flex-col`), a
    timestamp line and the message body on the right, separated by
    `border-t border-amber-100` between rows — just without the Edit/
    Report buttons a real forum post has, since messages can't be edited
    or reported yet. No left/right alignment by sender anymore; every
    message reads the same regardless of who sent it, exactly like a
    forum thread's posts do.
  - The reply box moved into the same `ForumPanelSection`-wrapped
    "Reply to `{name}`" shell the forums' own reply form uses, and its
    button was relabeled "Send Message" in the forums' "Post Reply"
    style (bold, `px-5 py-2.5`) instead of the smaller chat-app "Send".
  - Still plain text, not BBCode — this was a layout change, not a scope
    change; `bbcodeToHtml()`/`dangerouslySetInnerHTML` still appear
    nowhere in the DM feature.
  - Verified visually (temporary preview route, as usual): the inbox
    table next to a real forum thread list, and the message thread next
    to a real forum thread view, to confirm the two now genuinely share
    a visual language rather than just using the same amber palette.
- **Moderator tools & reports (`0027_moderation.sql`, `src/lib/
  moderation.ts`, `src/lib/report-actions.ts`,
  `src/components/report-button.tsx`, `src/app/mod/`, plus forum
  changes below)** — the explicit ask was "separate mod tools and admin
  tools, admins get both, mods only get mod tools," so that split is the
  spine of the whole design, not an afterthought.
  - **Two independent role checks, not one broadened check.**
    `current_user_is_admin()` (0009) is untouched — still gates `/admin`
    and every admin-only RLS policy (economy grants, catalog management,
    the audit log) exactly as before. A new `current_user_is_moderator()`
    (`is_admin OR is_moderator`) gates `/mod` and the newly-staff-owned
    forum RLS policies. Mirrored in app code as two separate functions —
    `requireAdmin()` (`src/lib/admin.ts`, unchanged) and a new
    `requireModerator()` (`src/lib/moderation.ts`) — deliberately not
    one helper with a role parameter, so it's a glance, not a read, to
    tell which surfaces are moderator-reachable vs admin-only. A
    moderator who isn't also an admin passes `requireModerator()` but
    fails `requireAdmin()` every time; an admin passes both, since
    `is_admin` alone satisfies `current_user_is_moderator()`.
  - `/mod` is its own route tree with its own layout — not nested under
    `/admin`'s — for the same reason: nesting would make "moderator
    reaches everything under /admin's URL space" an easy mistake to
    introduce later without anyone noticing in a diff.
  - **is_moderator is protected exactly like is_admin.**
    `protect_privileged_user_fields()` (redefined again, same shape as
    every prior redefinition since 0002) now resets `is_moderator` on any
    non-trusted client write, so a player can never grant themselves mod
    powers through a normal profile update — only a trusted/service-role
    write (the same escape hatch `is_admin` already used) can set it.
  - **Reports table**: `target_type` is `'user'` or `'forum_post'`, with
    a check constraint enforcing exactly one of `target_user_id`/
    `target_post_id` is set per type — DMs aren't reportable yet
    (deliberately out of scope: private 1:1 content raises different
    "what should a moderator even be able to see" questions than public
    forum content does). A `category` (spam/harassment/inappropriate
    content/scam/other) plus optional free-text `details` gives the
    queue something scannable instead of only freeform text. RLS: anyone
    can file a report as themselves (`reporter_id = auth.uid()`);
    reporters can see their own filed reports, staff can see all of
    them; only staff can update (resolve/dismiss) one. No delete
    policy — a report is a permanent record, same stance as the rest of
    this app's admin-managed content.
  - Reports reuse the **existing generic audit trigger**
    (`log_admin_action()`, 0009) rather than a new logging mechanism —
    every filed report and every resolve/dismiss lands in
    `admin_audit_log` with the actor's own id. That log's own SELECT
    policy is still admin-only, which is intentional and falls straight
    out of the admin/mod split: the full audit trail is an admin tool;
    `/mod/reports` (moderator-readable) is the mod-facing view of the
    same underlying activity.
  - **Forum moderation, the "later module" 0021_forums.sql explicitly
    called out** ("No delete policy on threads or posts in this first
    version... moderation/removal is a later module" — written back when
    forums first shipped, months before this round). Thread pin/lock
    widened from admin-only to staff (moderator or admin). New staff-only
    DELETE policies on `forum_threads` and `forum_posts` — deletion is a
    moderation action, not self-service; an author still can't delete
    their own post, only edit it (unchanged policy). `sync_forum_thread_
    stats()` (previously INSERT-only, since posts had no delete path)
    now also handles DELETE: decrements `reply_count`, and recomputes
    `last_post_at` from the remaining posts, falling back to the
    thread's own `created_at` if none are left.
  - `ThreadAdminControls` (the pin/lock popover) is now staff-gated
    instead of admin-gated, relabeled "Moderation," and gained a "Delete
    thread" button (confirm-wrapped, cascades to the thread's posts via
    the existing FK). Each `PostCard` gained a staff-only "Delete" button
    (`DeletePostButton`, same confirm-wrapped pattern) in place of where
    the disabled Report button used to sit.
  - **Report submission is a player action, not a moderator one** — it
    deliberately lives outside `src/app/mod/` (entirely gated by
    `requireModerator()`) in `src/lib/report-actions.ts`, so a plain
    signed-in player can call it without tripping the staff gate. A
    single `ReportButton` component (toggle-to-reveal-a-form, same
    pattern as `ReplyToggle`) is shared by `/u/[id]`'s "Report player"
    and every forum post's "Report" — both previously permanently
    disabled buttons, now real. Self-reporting (`target_user_id ===
    auth.uid()`) is rejected with a friendly error before the insert.
  - `/mod` (dashboard: open/resolved/dismissed counts) and `/mod/reports`
    (tabbed queue, newest-first for open reports) resolve reporter/
    target names via the same batched `user_profiles` `.in()` lookup
    pattern used everywhere else in this app (forum posts, trades,
    marketplace) rather than relying on PostgREST embedding — consistent
    with this codebase hand-writing its types instead of generating them.
    A post-targeted report shows a preview of the reported post's body
    inline, so a moderator can triage without leaving the queue; a
    "Delete post" action there deletes the post AND resolves the report
    as one step (auto-noted "Post deleted."), rather than leaving a
    dangling report about content that no longer exists.
  - Verified against local Postgres: a plain client update cannot set
    `is_moderator` on itself; `current_user_is_moderator()` reflects
    `is_admin OR is_moderator` correctly for a moderator-only account and
    a plain player; a moderator (not an admin) can pin a thread and
    delete a post/thread while the post's own author cannot delete it;
    `reply_count`/`last_post_at` stay correct across a post delete,
    including falling back to the thread's `created_at` when the last
    post is removed; reports RLS — a reporter sees their own filed
    report, a bystander sees nothing, staff see and can resolve
    everything, a non-staff resolve attempt affects zero rows.
  - Verified visually (temporary preview route, as usual): the nav's
    Mod-Tools-only-vs-both-Mod-Tools-and-Admin split for a moderator vs
    an admin account, the report form (category dropdown + details),
    and a mocked `/mod/reports` card with the resolve/dismiss/delete-
    post actions.
- **Moderator tools round two (`0028_moderation_round_two.sql`,
  `src/lib/staff-account.ts`, `src/components/player-link.tsx`,
  `src/app/mod/players/`, `src/app/mod/conversations/`, plus changes
  across forums/messages/profile files below)** — seven asks in one
  round; grouped here by mechanism rather than one bullet per ask, since
  several share the same underlying piece.
  - **A real "Staff Team" account, seeded into `auth.users` directly**
    (not through a Google sign-in), with `raw_user_meta_data ->>
    'full_name'` set so `handle_new_user()` (0001, unchanged) creates its
    `public.users` row automatically — no separate insert needed. This
    exists so "send players an automatic DM from staff" can be a real DM
    through the existing `dm_conversations`/`dm_messages` tables instead
    of a special-cased non-DM notification type. It's deliberately not an
    admin or moderator itself (`is_admin`/`is_moderator` both false) —
    it's a puppet identity for automated messages, and nobody can ever
    sign in as it. `STAFF_USER_ID` is a plain exported constant
    (`src/lib/staff-account.ts`), checked at render time (`sender_id ===
    STAFF_USER_ID`) to show the amber "Official" badge on its messages —
    separate from the green/blue staff-name coloring below, which is
    about a *real* staff member's own account.
  - **One `before insert` + one `after insert` trigger on `reports`,
    doing different jobs.** `snapshot_report_target_author()` (before)
    copies whoever authored the reported post/message onto the report row
    itself (`target_post_author_id`/`target_message_sender_id`) at filing
    time. `handle_new_report()` (after) does two things: sends the
    reporter an acknowledgment DM from the Staff account (inlines the
    same find-or-create-conversation logic as
    `get_or_create_dm_conversation()` rather than calling it, since that
    function's own "caller must equal p_user_id" check would reject a
    trigger acting on the Staff account's behalf), and — for a
    `forum_post` report — counts **distinct** reporters (not total
    reports; one player spamming reports can't hide a post solo) and
    hides the post once 5 have reported it.
  - **Why the snapshot column exists at all**: `reports.target_post_id`
    switched from `on delete cascade` to `on delete set null` this round
    (a moderator deleting a reported post — an ordinary resolution — used
    to delete the report with it, erasing exactly the history `/mod/
    players/[userId]` is for). But `target_post_id` going null loses the
    join to `forum_posts.author_id` the moment the post is gone, which
    would silently drop that report from "everything about this player" —
    so the author gets copied onto the report *once, up front*, and
    survives regardless of what later happens to the post. The `reports`
    check constraint had to loosen alongside this: `target_post_id`/
    `target_message_id` are no longer required non-null for their
    respective `target_type` (only `target_user_id` still is, for
    `target_type = 'user'`) — a report keeps its `target_type` forever,
    it just loses its live pointer.
  - **Auto-hide is a display concern, not an RLS one.** `forum_posts`'
    SELECT policy stays `using (true)` — a hidden post's row is still
    technically selectable — and instead `PostCard` (the thread view)
    checks `is_hidden` itself: non-staff get a muted placeholder ("hidden
    pending moderator review"), staff still see the real content plus a
    red "hidden" banner and an Unhide button. This was a deliberate
    trade-off for this testing phase over a stricter RLS-level hide, so
    the post can still occupy its slot in the thread (reply_count/
    pagination stay correct) rather than needing special-casing to skip
    it. A "Hide (test)" link next to every visible post lets staff trigger
    the same `is_hidden` flag by hand, exactly as asked ("add a button to
    test this visually") — it's clearly labeled as a test affordance, not
    a real moderation action; the real path is still 5 distinct reports.
  - **Editing someone else's post widened from admin-only to staff**
    (the `forum_posts` UPDATE policy), which is what makes "Edited by a
    moderator/an admin" possible in the first place — staff genuinely
    editing others' content is now a supported action, not just a
    hypothetical. The anonymized label only applies when the editor
    *isn't* the author and *is* staff; a normal self-edit still always
    shows the real name. `ForumPostWithAuthor` exposes the raw
    `lastEditedById`/`lastEditorIsAdmin`/`lastEditorIsModerator` rather
    than a pre-decided string — `PostCard` computes the label itself,
    since only it knows to compare `lastEditedById` against `authorId`.
  - **Colored staff names**: `user_profiles` now exposes `is_admin`/
    `is_moderator` (previously admin-only info) — needed for this to
    render anywhere a name does, not just on staff pages, and consistent
    with staff identity being public by design here (see the badge above,
    and the report-history link on `/u/[id]`). A new shared `PlayerLink`
    component wraps a name in a `Link` to `/u/[id]`, colored green for a
    moderator or deep blue for an admin (an admin is also a moderator, so
    the admin check comes first); `staffNameColorClass()` is exported
    separately for the one spot that needs the color without the profile
    link (`/messages`' inbox, where the name links to the conversation).
    Threaded through: forum post authors, the thread-list "Posted by",
    `/profile` and `/u/[id]`'s own heading, the DM inbox and thread
    header/messages.
  - **DM messages become reportable** (`ReportButton`'s `targetType` grew
    a third value, `"dm_message"`), shown on every received message (not
    your own) in `/messages/[conversationId]`. Staff reviewing one needs
    the surrounding conversation, not just the flagged message, so
    `dm_conversations`/`dm_messages`' SELECT policies widened to also
    allow `current_user_is_moderator()` — **read-only**: no insert/
    update/delete policy changed, so this doesn't let staff post into or
    alter a conversation they're not a participant in. The player-facing
    `/messages/[conversationId]` page explicitly re-checks participancy
    itself (`notFound()` if the viewer isn't `user_one_id`/`user_two_id`,
    even though the widened SELECT policy would let a staff member's
    query through) — staff use the separate read-only `/mod/
    conversations/[conversationId]` viewer instead, which has no reply
    box at all.
  - **DM pagination + jump-to-first-unread**: `/messages/
    [conversationId]` now works exactly like a forum thread — `PAGE_SIZE`
    messages per page, a `PaginationBar` at the bottom. `PaginationBar`
    itself changed slightly: "page 1" now always gets an explicit
    `?page=1` in its link instead of a bare URL, because a bare URL (no
    `page` param at all) means something new on this page — "land on
    whichever page this player's first unread message is on," computed
    from their pre-visit read marker (`count of messages with created_at
    <= my_last_read_at`, converted to a page number) before it gets
    bumped to "now." Sending a message reuses this for free: since
    sending bumps the *sender's own* read marker to the new message's
    timestamp (0026's existing trigger behavior), redirecting to the
    bare URL after a send always resolves to the last page — showing the
    message just sent — without the send action needing to compute a
    page number itself.
  - **`/mod/players/[userId]`**: a player's full moderation history,
    100% staff-only (`requireModerator()`) and never linked from anywhere
    a regular player can reach — `/u/[id]` shows a "Report history (staff
    only)" link purely because the viewer's own role check already
    passed, and every report card everywhere (`/mod/reports` too) got a
    "View full history" link to here. Shows every report where this
    player is the target *or* the snapshotted author of a reported post/
    message, plus every DM conversation they're part of (each linking to
    `/mod/conversations/[conversationId]`, the read-only log viewer), plus
    the new warning-DM form. `ReportCard` and the reporter/target
    resolution logic (`resolveReportDetails()`) moved to `src/app/mod/`
    so both this page and `/mod/reports` share one implementation instead
    of two.
  - **Staff warning DMs**: sent as the acting moderator's own account
    (not the Staff pseudo-account) through the ordinary DM insert path —
    it still reads as official because the sender's name renders in
    staff color in the thread. A dropdown of canned messages (guideline
    reminder, content removed, behavior warning, no-action-needed) plus a
    "write my own" option that reveals a free-text textarea; either way
    it's the same `sendStaffWarning` Server Action underneath.
  - Verified against local Postgres: the Staff account exists,
    unprivileged, with the expected display name; `user_profiles` exposes
    the new role columns; a moderator (not an admin) can edit another
    player's post and the trigger attributes it correctly; filing a
    report fires exactly one ack DM from Staff; auto-hide doesn't fire at
    4 distinct reporters but does at 5, and a moderator can unhide;
    staff can read a conversation they're not in while a non-staff
    bystander still can't; deleting a reported post sets
    `target_post_id` null on all its reports while `target_post_author_id`
    (the snapshot) survives; a `dm_message` report is accepted and
    correctly snapshots its sender.
  - Verified visually (temporary preview route, as usual): colored names
    at all three role levels, the hidden-post placeholder next to the
    staff view (banner, real content, Unhide, test-hide link), the
    anonymized "Edited by a moderator" line, a Staff-styled DM message
    (Official badge, tinted background) next to a normal one with its
    Report button, the DM pagination bar, and the warning-DM form's
    canned-message picker.
- **Moderator tools round three** (`0029_bans_and_staff_fixes.sql`) — a
  bug fix (staff messages were sending from the mod's own account,
  contradicting the intended mod anonymity), a new quick-quote tool, an
  admin-managed canned-message library, thread title editing, and a full
  ban system. All in one migration since the ban system's `bans` table
  and its `user_has_active_ban()` helper get reused across every
  enforcement point below.
  - **`send_staff_message(p_target_user_id, p_body)`**: the fix for the
    anonymity bug. A `security definer` RPC that inlines the same
    find-or-create-conversation logic as `get_or_create_dm_conversation()`
    (which it can't call directly — that function requires
    `auth.uid() = p_user_id`, and the caller here is a moderator, not the
    Staff account) and always inserts the message as `STAFF_USER_ID`,
    never the acting moderator's own id. `sendStaffWarning` (`/mod/
    actions.ts`) now calls this instead of the old get-or-create-then-
    plain-insert-as-`user.id` path. Being `security definer` and a direct
    table write, it also naturally bypasses the new DM-ban policy below
    without needing a special-cased exemption — same shape as
    `handle_new_report()`'s automated acknowledgment DM.
  - **Quick quote** (`sendQuickQuote` action, `QuickQuoteButton` on
    `ReportCard`): for a `forum_post`/`dm_message` report specifically,
    quotes the offending content back to the player plus a short
    staff-written note on which rule it broke, composed into one message
    and sent through the same `send_staff_message` path — same anonymity
    guarantee, since quoting content back at someone is exactly the kind
    of message a targeted player would most want to attribute to a
    specific mod.
  - **Canned messages move to the database** (`canned_staff_messages`
    table) — previously a hardcoded array in `warning-dm-form.tsx`.
    Admin-managed (insert/update RLS is admin-only) but staff-readable
    (`current_user_is_moderator()`), no delete policy (deactivate via
    `is_active` instead, same convention as every other admin catalog).
    `/admin/canned-messages` mirrors `/admin/species`'s exact list/new/
    `[id]` CRUD convention. The migration seeds the original 4 hardcoded
    messages as rows so this is a no-op for existing staff workflows.
    `WarningDmForm` now takes `cannedMessages` as a prop (fetched
    server-side by the page) instead of importing a hardcoded constant.
  - **Thread title editing**: forum_threads' UPDATE policy was already
    staff-wide (`"Staff can update any thread"`, 0027) and covers every
    column including `title` — no RLS change needed. `updateThreadFlags`
    (`forums/actions.ts`) now also reads an optional `title` field
    (blank/missing = leave it alone, so the action still works for
    pin/lock-only submissions), and `ThreadAdminControls`' "Moderation"
    popover gained a title text input above the pin/lock checkboxes.
  - **Bans**: a `bans` table (`user_id`, `ban_type` — `'dm' | 'sales' |
    'forums' | 'account'` — `reason`, `issued_by`, `issued_at`,
    `expires_at`, `lifted_at`, `lifted_by`). Always time-based:
    `expires_at` is `not null` with a `check (expires_at > issued_at)` —
    there's no permanent-ban option, staff always pick a duration (the
    `BanForm` UI offers 1 hour up to 1 year). A ban that simply ran out
    the clock leaves `lifted_at` null forever; only an early staff
    reversal sets it. A player can hold several ban types at once, each
    independent. INSERT/UPDATE RLS requires `current_user_is_moderator()`
    for `dm`/`sales`/`forums` but `current_user_is_admin()` for
    `account` — "Admins are the only people that can issue account
    bans" — checked per-row by `ban_type`, so the same policy covers
    issuing and (separately) lifting early at the same authority tier.
    SELECT is staff-everything plus a self-select (`user_id = auth.uid()`)
    so a banned player can see their own ban's reason/expiry. No delete
    policy — bans are a permanent record like reports.
  - **`user_has_active_ban(p_user_id, p_ban_type)`**: the one reusable
    check (`exists (... lifted_at is null and expires_at > now())`),
    `stable security definer`, left with default (unrevoked) execute
    privileges — same tier as `current_user_is_admin()`/
    `current_user_is_moderator()` — since it's called both from inside
    RLS policies (which requires the evaluating role to have execute on
    it) and directly by the app for a player's own friendly pre-check
    messages and the account-ban login check.
  - **DM ban enforcement** — bidirectional, per spec ("Players are unable
    to DM these players either!"): `dm_messages`' INSERT policy checks
    both that the sender isn't DM-banned AND that the other conversation
    participant (derived from the conversation row, whichever of
    `user_one_id`/`user_two_id` isn't the sender) isn't DM-banned either.
    Reports are a separate table/policy entirely, so a DM-banned player
    can still file one ("Players can still send in reports with this
    ban"). `messages/[conversationId]/actions.ts`'s `sendMessage` adds a
    friendly pre-check (`user_has_active_ban(user.id, 'dm')`) before
    attempting the insert.
  - **Forums ban enforcement** — `forum_threads`/`forum_posts`' INSERT
    policies both gained `and not user_has_active_ban(author_id,
    'forums')`. `createForumThread`/`createForumReply` (`forums/
    actions.ts`) each get the same friendly pre-check.
  - **Sales ban enforcement** — `create_pet_listing`/`create_item_listing`
    (both `security definer`, unchanged signatures, `create or replace`d
    in place) now raise a friendly exception up front if the seller has
    an active `sales` ban. `buy_listing` is untouched — "can still
    purchase things!" No app-side pre-check needed: `sell-form.tsx`
    already calls these RPCs directly from the browser and surfaces
    `rpcError.message` verbatim, so the RPC's own exception message
    reaches the player with no extra plumbing.
  - **Account ban enforcement** — the only ban type that can't be
    stopped by an RLS policy, since Google's OAuth handshake itself can't
    be intercepted. Instead `/auth/callback/route.ts` lets
    `exchangeCodeForSession` succeed, then immediately checks
    `user_has_active_ban(user.id, 'account')`; if true, it looks up the
    ban's `reason`/`expires_at`, calls `supabase.auth.signOut()`, and
    redirects to `/?banned=account&until=...&reason=...` — "cannot log
    in" means the session never survives past this check, not that the
    OAuth flow itself was blocked mid-handshake. The home page
    (`src/app/page.tsx`) reads those query params and renders a ban
    notice (reason + formatted expiry) in place of the normal
    welcome/sign-in content.
  - **Ban issuance UI** (`/mod/players/[userId]`): a new "Bans" section
    with `BanForm` (ban type — `account` hidden entirely unless the
    viewer is an admin, not just disabled, since a moderator submitting
    it anyway would just get `issueBan`'s friendly rejection from the
    RLS reject — plus a duration dropdown and an optional staff-only
    reason) and `BansList` (every ban ever issued to this player, active
    ones highlighted red with a "Lift ban" button calling `liftBan`,
    which relies entirely on the UPDATE policy's own role/ban-type check
    to reject an unauthorized lift attempt as a quiet no-op).
  - Verified against local Postgres (18 scenarios): a moderator can issue
    a forums/dm/sales ban but is rejected issuing an account ban (RLS),
    an admin can issue an account ban and later lift it early while a
    moderator's attempt to lift that same ban is silently a no-op; a
    forums-banned player is rejected creating a thread while a
    non-banned player succeeds; a dm-banned player is rejected sending a
    DM and, separately, a non-banned player is rejected messaging *them*
    (bidirectional); a dm-banned player can still file a report;
    `send_staff_message` delivers as `STAFF_USER_ID` (confirmed by
    reading `sender_id` back) and bypasses the dm ban entirely, while a
    non-moderator calling it directly is rejected; a sales-banned player
    is rejected by `create_pet_listing`; `user_has_active_ban` correctly
    flips to false once a ban's `expires_at` is in the past; canned
    messages are staff-readable/admin-writable only; and a player can
    `select` their own ban row but not another player's.
  - Verified visually (temporary preview route, as usual): both ban-form
    variants (moderator vs. admin, confirming the `account` option only
    appears for the latter), the bans list's three states (active/
    expired/lifted-early, color-coded), the quick-quote button collapsed
    and expanded, the canned-message admin form, the warning-DM form
    reading from the (mocked) database-backed list, the thread admin
    popover's new title field, and the home page's account-ban notice.
  - The "message preview is clipping" bug report from this round could
    not be reproduced: a dedicated preview route mounted the exact
    `MessageCard` (DM thread) and DM-inbox `<table>` row markup with
    deliberately adversarial content (very long display names, a long
    unbroken-word snippet) at both desktop and mobile widths, and the
    avatar/timestamp stayed fully visible in every case. Needs more
    detail from whoever filed it — which page, ideally a screenshot —
    before attempting a fix; left open rather than guessing.
- **Simpler report handling** (`0032_simple_report_handling.sql`) — the
  two follow-up rounds after "Moderator tools round three" (grouped
  report "tickets" with claiming/dedup/internal notes, then a much larger
  invisible-staff/escalation/appeals/support-tickets overhaul) were
  reverted wholesale with `git revert` — feedback was that it had gotten
  too complex. This round replaces them with something closer to the
  original reports system plus exactly what was asked for: a modal-based
  report flow with a block-player follow-up, and a single dedicated
  report-handling page laid out to a provided wireframe.
  - **The revert itself**: `git revert --no-commit <overhaul-sha>
    <tickets-sha>` followed by one commit — confirmed with `git diff
    <pre-tickets-sha> -- . ':!README.md'` returning empty, i.e. every
    file except README.md matched the pre-tickets state exactly. No
    manual file edits were needed for the revert to apply cleanly, since
    nothing landed on the branch between those two rounds and this one.
  - **Report button becomes a modal** (`components/report-button.tsx`)
    — was an inline toggle-to-form; now a `fixed inset-0` overlay with a
    backdrop (click-outside or Cancel closes it), so filing a report
    doesn't shift the surrounding page layout. On successful submit the
    modal swaps to a confirmation ("Report submitted. Thanks for
    flagging this.") and, if the report has a resolvable offending
    player, a "Would you like to block this player?" prompt.
  - **Blocking** (`blocks` table) — self-service and deliberately
    one-directional: blocking someone stops THEM from DMing you, not the
    reverse (you can still message someone you've blocked, if you want
    to — the point is "I don't want to hear from them," not "we can't
    talk"). `ReportButton` gained an `offendingUserId` prop so the
    block prompt knows who to block for a forum-post or DM-message
    report (a "user" report already has this as `targetId`); the forum
    thread page and the DM thread page pass the post author's/message
    sender's id through explicitly.
  - **A real RLS bug caught during verification**: the first version of
    the dm_messages block check was an inline `exists (select 1 from
    public.blocks ...)` — which silently did nothing, because `blocks`'
    own "Players can view their own blocks" SELECT policy hides the
    blocker's row from the blocked sender, so the subquery always saw
    zero rows regardless of whether a block existed. Fixed with a
    `security definer` helper (`is_blocked_by()`), same reasoning as
    `user_has_active_ban()` (0029) needing definer privileges to see
    rows the calling role's own RLS would otherwise filter out. Caught
    by the local-Postgres test suite, not by inspection — a good
    reminder that "add an exists() referencing another RLS-protected
    table inside a policy" is a pattern that needs this treatment by
    default, not just when a bug shows up.
  - **`player_notes`** — private, staff-only, dated and attributed notes
    about a PLAYER (not a specific report), shown on the report-handling
    page for at-a-glance context ("has this player caused trouble
    before?"). Separate from `reports.resolution_note` (the one-line
    "why this report was closed").
  - **Escalation, minimal version** — `reports.status` regains the
    `'escalated'` value from the reverted round, but nothing else: no
    escalation-reason columns, no admin-only RLS lock, no separate
    queue. It's purely "send this to an admin instead of handling it
    myself" — any staff member can still act on an escalated report the
    same as any other, matching the "much simpler" brief.
  - **The report-handling page** (`/mod/reports/[reportId]`, new) —
    laid out to the provided wireframe: a left column with the offending
    player's avatar/name/join date, the player-notes box (list + add
    form), and a compact linked list of their past reports (each linking
    to that report's own handling page — this is how a mod notices a
    pattern, not automatic grouping); a right column with the original
    report (reporter, category, details, the reported content itself),
    a message textarea, and a row of handling-choice buttons (Nothing/
    Dismiss, Verbal Warning, Forums Ban, DMs Ban, Sales Ban). Picking a
    handling choice reveals a bottom bar with two independent forms —
    "Confirm and Send" (disabled until a message is present, for any
    choice but Dismiss) and "Escalate to Admin" — implemented as two
    sibling `<form>`s rather than nesting, with the ban-duration
    `<select>` connected to the confirm form via HTML's `form="..."`
    attribute despite living outside it in the DOM.
  - **`handleReport`** (mod/actions.ts) is the one action behind
    "Confirm and Send": `dismiss` sends nothing and just closes the
    report; every other choice sends the composed message through
    `send_staff_message` (always the anonymous Staff account, never the
    acting moderator's own — unchanged from 0029) and, for a ban choice,
    also inserts that ban at the chosen duration; always ends by setting
    the report to `resolved`. `escalateReportSimple` is the other path —
    never sends a message, never closes, just flips the status.
  - Verified against local Postgres (10 scenarios): a block correctly
    stops the blocked player's DM but not the blocker's own outgoing
    DMs (confirming the one-directional design), an unrelated player
    can't see someone else's block list, unblocking works, staff-only
    read/write on `player_notes` holds, `'escalated'` is accepted as a
    status, and a normal (unblocked) DM is completely unaffected by any
    of this.
  - Verified visually (temporary preview route, as usual): the report
    modal in its closed/open states, the submitted-plus-block-prompt
    view, and the full report-handling page — the handling-button row,
    a ban choice revealing the duration selector, and the resulting
    Confirm/Escalate bar — matching the provided wireframe's layout.
  - **Follow-up fix — reused migration number**: this round's migration
    was originally filed as `0030_simple_report_handling.sql`, reusing
    the number `0030` after the revert deleted the previous, unrelated
    `0030_report_tickets.sql`. If a migration tool tracks "applied"
    state by version prefix rather than full filename (Supabase CLI's
    `supabase_migrations.schema_migrations` does exactly this), an
    environment where the old `0030`/`0031` had already been applied
    could see this new migration silently skipped or rejected as a
    checksum mismatch — leaving `blocks`, `player_notes`, and the
    `'escalated'` status never created, while old overhaul-round tables/
    policies stayed behind. Renumbered to `0032_simple_report_handling.sql`
    (past every number ever used by either reverted round) to make that
    impossible going forward. Also swapped the blind
    `if (!row) notFound()` pattern on `/messages/[conversationId]` and
    `/mod/reports/[reportId]` for one that logs the Supabase error first
    — `.maybeSingle()` returns `{ data: null, error }` on an RLS denial
    or query error just as it does for a genuinely missing row, so a
    real failure was rendering as an indistinguishable 404 with nothing
    in the logs to tell them apart.

- **Report claiming, restored + editable player notes**
  (`0033_claiming_and_note_edits.sql`) — two independent QOL additions
  requested after the simplified round shipped.
  - **Claiming** — same design as the reverted ticket round:
    `reports.claimed_by`/`claimed_at`, any staff member can claim or
    unclaim any report (no "only the claimant can unclaim" lock, so a
    claim never gets permanently stuck if that mod goes AFK), no new RLS
    needed since reports' existing staff-only UPDATE policy
    (0027_moderation.sql) already covers the new columns. `claimReport`/
    `unclaimReport` (mod/actions.ts) are plain form actions, same
    "just does the thing" convention as `resolveReport`. Surfaced in
    three places via one shared `ClaimButton` component
    (mod/reports/claim-button.tsx): the `/mod/reports` queue rows (open/
    escalated tabs only — a claim is meaningless once a report is
    closed), the top of `/mod/reports/[reportId]`, and `ReportCard`
    (shared with `/mod/players/[userId]`'s report history) — fixed a
    latent display bug there too, where an `'escalated'` report fell
    through to the closed-report footer branch and would have rendered
    as "Dismissed by [nothing]"; the action row (now including Claim/
    Unclaim) correctly covers escalated reports too.
  - **Player notes become editable by their author** — notes were
    write-once; staff asked to fix typos/add detail to one they already
    wrote. Scoped to the author only (`"Authors can edit their own
    player notes"` RLS policy), not any staff member, since these are
    attributed record entries. `edited_at` (null until the first edit)
    shows "(edited)" without needing forum_posts' full edit_count/
    last_edited_by pair — a note has exactly one author, so there's no
    "someone else edited this" case. `updatePlayerNote` (mod/actions.ts)
    tells "edited" from "silently blocked by RLS" apart via
    `.select().maybeSingle()` on the update (a non-author's UPDATE
    matches 0 rows rather than erroring), returning a friendly "You can
    only edit your own notes." instead of a quiet no-op. `PlayerNotes`
    (mod/reports/player-notes.tsx) shows an "Edit" link only on the
    current staff member's own notes, swapping that note to an inline
    edit form; closing the form on success uses React's "adjust state
    during render when related state changes" pattern rather than a
    `useEffect` with `setState` in it (which the project's lint rules
    flag, and which would also incorrectly fire the instant the edit
    form opens, before anything is submitted).
  - Verified against local Postgres (7 scenarios): any staff member can
    claim a report, any OTHER staff member can unclaim it (no ownership
    lock), a plain player's attempted claim is silently rejected by RLS,
    a note's author can edit it, a different staff member's edit attempt
    is rejected, and the target player themself can't edit (or even see)
    a note about them.
  - Verified visually (temporary preview route, as usual): the claim
    button's three states (unclaimed / claimed by you / claimed by
    someone else) and the player-notes list swapping into inline edit
    mode with prefilled text and Save/Cancel.

- **Pets tab rework + pet detail page** (`0034_pet_bio.sql`) — inspired
  by a Flight Rising lair screenshot, "a slightly more modern version
  that gives players more room to decorate," plus a new per-pet page
  with full info and a BBCode bio.
  - **The grid card, decluttered** (`/pets`, `pets/page.tsx`) — the old
    card packed a name editor, a folder `<select>`, and a for-trade
    toggle into every tile; the whole thing is now a single `Link` to
    `/pets/[petId]`, image-forward (bigger art, rounded-xl, a subtle
    hover lift/shadow) with just name and species/rarity underneath, and
    a small "For trade" badge overlapping the top-right corner when
    applicable. An unnamed pet now reads as italic gray "Unnamed" text
    (informational) rather than a "+ Name this pet" button, since
    renaming moved to the detail page along with everything else that
    used to live on the card. This is a real tradeoff, not a pure
    improvement: managing many pets across folders one at a time now
    costs a click-through per pet instead of an inline control — bulk
    for-trade marking (`BulkForTradeButton`, folder-level) still doesn't
    require it, but a one-off folder move now does.
  - **`/pets/[petId]`** (new) — owner-only, same as the grid itself
    (pets has no public-viewing story yet — see `/u/[id]`'s "Browsing
    another player's pets isn't available yet"); a pet belonging to
    someone else 404s exactly like a nonexistent one, never revealing
    which case it is. Left column: portrait + the existing
    `PetNameEditor` reused as-is. Right column, three sections: Details
    (species, rarity, color variant if set, adopted date formatted the
    same "Month Day, Year" way as `/profile`'s "Joined" date, and the
    pet's raw id as "ID" — there's no separate friendly pet number,
    since nothing else in this app has one either); Organize (the
    existing `MoveToFolderSelect` and `ForTradeToggle`, reused as-is,
    just relocated here from the grid card); Bio (new, below).
  - **Pet bios** — same BBCode pipeline as `users.bio`
    (`bbcodeToHtml()` re-rendered fresh on every read, no separate
    rendered column) and the same "pets has never had a client UPDATE
    policy" reasoning behind `custom_name`/`folder_id`/`is_for_trade`
    (species_id/rarity/owner_id must never be client-writable, so a
    blanket owner-update policy was never an option) — `set_pet_bio()`
    is a narrow `security definer` RPC, same shape as `rename_pet()`
    (0013_pet_names.sql): validates the caller against `p_user_id`,
    trims/nulls blank input, enforces a 2000-character cap, updates only
    `bio` and only where `owner_id` matches. `PetBioEditor`
    (`pets/pet-bio-editor.tsx`, new) follows the same "call the RPC
    directly from the client" pattern as `PetNameEditor`/
    `ForTradeToggle`/`MoveToFolderSelect` rather than a server action —
    it wraps `BBCodeEditor` in a local `<form>` with an `onSubmit`
    handler (`preventDefault`, read the textarea's value via
    `FormData`) purely so `BBCodeEditor`'s existing uncontrolled-
    textarea design (built for a real form submission) still works
    without actually navigating anywhere.
  - Verified against local Postgres (5 scenarios): the owner can set a
    bio, blank input clears it, an over-2000-character bio is rejected
    (value unchanged), a caller can't pass someone else's id as
    `p_user_id` ("Not authorized"), and a caller can't touch a pet they
    don't own even with their own id ("Pet not found") — the last two
    also incidentally confirmed RLS hides the other player's pet from
    them entirely, not just blocking the write.
  - Verified visually (temporary preview route, as usual): the
    modernized grid (named/unnamed pets, the for-trade badge) and the
    full detail page layout, including the bio editor actually opening
    into `BBCodeEditor` with the existing raw source prefilled.
  - **Not built, out of scope for this round**: layered pet art
    rendering and accessory equip/unequip (still an open, unchecked
    roadmap item — the "room to decorate" language here is about the
    grid's own layout breathing room, not a new lair-decoration/
    background-customization feature) and public pet browsing (still
    explicitly unavailable per `/u/[id]`).

- **Furgarden rebrand** — prompted by a "Furgarden" hero banner
  (sky blue, spring green, sunny yellow, brown-outlined title, "Coming
  Soon") shared in chat, asking for it to be added to the site and the
  site recolored to match.
  - **The hero image** initially only reached this session as an inline
    chat image, not a file on disk (checked the whole filesystem,
    including `game-assets/` — nothing there), so a placeholder went
    up on the homepage first reserving its exact spot/aspect ratio.
    The user then pushed the real file directly to `game-assets/other/
    Furgarden Hero.png` — since it's static site chrome rather than
    admin-editable game content (a species/item/zone's art, which goes
    through Supabase Storage so it can be swapped from the admin panel),
    it was copied straight into `public/ui/furgarden-hero.png` instead
    and wired into `src/app/page.tsx` with a plain `next/image`, same
    as the existing `public/icons/`/`public/ui/` assets (edit-pencil,
    item-slot frames, etc.) — no Storage upload, no `image_url` column,
    nothing else touches this file.
  - **The palette swap is the same straight, ordered token
    substitution used for the earlier zinc→amber round**: every
    `amber-*` Tailwind class across every `.tsx` file under `src/`
    became `green-*` — backgrounds, borders, primary buttons, the
    `--color-amber-*` CSS variables (and their fallback hex values) in
    `globals.css`. `amber-` as a literal substring needs no
    longest-match-first ordering the way the zinc round's whole-class
    substitutions did — replacing that one fixed 6-character substring
    wherever it appears is unambiguous regardless of what prefix
    (`bg-`, `dark:hover:`, etc.) precedes it. `stone-*` (neutral/muted
    text) was deliberately left alone — it already reads as a warm
    gray that pairs fine with green/yellow/blue, and the ask was to
    match the hero's *accent* colors, not recolor body text. The
    header's pre-existing `green-500`/`yellow-400` (logo box/account
    panel, from a much earlier round) turned out to already match the
    hero's palette — the mismatch was everywhere else, which used
    `amber-*`/`stone-*` from the later cream/parchment round.
  - **`--background`** nudged from a pale `#cddffa` to a more vivid
    `#a9ddf9`, closer to the hero's sky blue, while staying light
    enough for the white content box and diagonal-stripe overlay to
    still read clearly on top of it.
  - **The site is now named Furgarden** — page `<title>` (`layout.tsx`),
    the footer tagline (`site-footer.tsx`), and this README's own H1,
    all swapped from "Virtual Pet Site." This wasn't explicitly asked
    for in so many words, but the hero art itself names the game
    "Furgarden," so treating "add this hero image" as also meaning "and
    the site is now called that" seemed like the obvious reading rather
    than leaving a Furgarden-branded hero sitting on a page still
    titled "Virtual Pet Site."
  - Verified with a full `next build` and `eslint` pass across every
    touched file, plus visually (temporary dev server + Playwright,
    env vars cleaned up after): the homepage's hero placeholder, header,
    and primary button, and the `/login` page's button, all render in
    the new green/yellow/blue palette with the updated page title and
    footer text.
  - **Follow-up: the header/nav/footer/background weren't part of the
    original ask's scope but should have been** — the first pass only
    touched `amber-*` classes, which never covered these (the header
    was already green/yellow from an unrelated earlier round; the nav
    was already yellow; the footer was `blue-900`; the page background
    was a flat blue). Asked to extend the recolor to "the whole site"
    and to bring some brown back in for earthy tones:
    - `site-header.tsx`/`site-nav.tsx`: added a `border-2 border-
      amber-900` (a real Tailwind brown — this is a fresh, deliberate
      use of the `amber` family for a new accent, unrelated to the
      `amber-*`-becomes-`green-*` rename from the previous round, which
      only ever touched what was already in the codebase at the time)
      to the logo box, the signed-in/signed-out account panel, and the
      nav bar itself — echoing the hero wordmark's own brown outline.
    - `site-footer.tsx`: `bg-blue-900`/`text-blue-100` → `bg-amber-950`/
      `text-amber-100`, an earthy dark-brown bar instead of navy.
    - `globals.css`: the body background gained a second
      `background-image` layer — a `linear-gradient(to bottom, sky-blue
      0%, pale-green 65%, grass-green 100%)` — sitting underneath the
      existing diagonal stripe texture, echoing the hero art's own
      sky-above/grass-below composition instead of one flat color.
      `background-attachment: fixed` on that layer (the stripe texture
      stays `scroll`, its default) keeps the blue-to-green transition
      sized to one viewport height regardless of how long a page's
      content makes it scroll — without that, a long page would stretch
      the gradient across its full scrollable height and show mostly
      blue with barely a sliver of green at the very bottom.
    - Verified visually (temporary preview route + dev server +
      Playwright, both cleaned up after): the homepage end-to-end (hero,
      gradient background, brown-bordered header) and a mock render of
      the signed-in nav bar (real component, `NavGroups`, with sample
      groups — the real `SiteNav` needs a live Supabase session to
      render anything, since it returns `null` for a signed-out
      request) against the same gradient/footer.
- **Gardening** (`0035_gardening.sql`) reuses four patterns already
  established elsewhere in this codebase rather than inventing new ones:
  - Two new `item_type` enum values, `seed` (brown placeholder art, per
    the ask) and `fertilizer` (yellow placeholder art), added via
    `alter type ... add value` followed by an explicit `commit;` in the
    migration — Postgres won't let a transaction use a brand-new enum
    value as data in the same transaction that added it (same reason
    `0008_...sql` does this).
  - **Seeds are a weighted pool, always** — `seed_plants` (seed item id,
    plant id, drop weight) is the exact same shape as the existing zone
    pet pool, resolved with the same Efraimidis-Spirakis weighted-random
    SQL (`pick_weighted_seed_plant`, mirroring `pick_weighted_zone_
    species`). A seed that "plants one specific plant" is just a pool
    with a single row — this avoids a separate seed-kind flag and
    branching logic for what's really the same mechanism at two
    different pool sizes.
  - **Garden row expansion** (`garden_rows` column + `expand_garden()`)
    is `den_size`/`expand_den()`'s escalating-cost pattern verbatim
    (cost = 300 × 1.5^rows already bought), including reuse of
    `begin_trusted_user_write()` before crediting/debiting `users`, and
    `protect_privileged_user_fields()` extended to guard the new column
    from direct client writes the same way it already guards
    `den_size`/`coin_balance`/etc.
  - **Growth pauses while a plant needs water, without a background
    job** — `garden_plantings` stores `last_watered_at`,
    `next_water_needed_at` (= last watered + 8h), and `grow_completes_at`
    (initially planted + total grow time). `water_plant()` only pushes
    `grow_completes_at` forward when watering happens *after* it was due
    (an overdue/"thirsty" gap) — by exactly that gap's length — so a
    plant watered on time never has its clock touched, and a plant
    watered late resumes exactly where it left off instead of losing
    progress. `resolve_due_garden()` (called lazily, same as
    `resolve_due_expeditions`/`resolve_due_brews`, right before any read
    of garden data — no cron) wilts anything more than 72 hours overdue,
    and separately marks anything past its completion time **and
    currently on-time for water** as ready — that second condition is
    the subtle part: without it, a plant that's been neglected past its
    nominal completion timestamp would flip to "ready" the instant it's
    watered again, even though it should've kept growing (paused) the
    whole time it was thirsty. Verified against a local Postgres
    instance with 15 scripted scenarios, including the two that exercise
    this directly: a plant simulated as complete-but-not-yet-overdue
    resolves to ready, while one simulated as complete-but-currently-
    overdue does not (stays `growing` until watered).
  - Fertilizer is a second, optional item consumed at planting time.
    `fertilizer_effects` lets one fertilizer item carry multiple named
    effects (`grow_speed_boost`, `pest_deterrence`, `double_coin_chance`
    — the three examples named in the ask, not an open-ended list):
    grow-speed multiplies the total duration down (floored at 1 hour so
    a strong boost can't make something finish instantly), pest
    deterrence multiplies down a flat 15% base pest chance rolled once
    at planting (mirroring the existing double-reward-roll-at-start
    pattern used by expeditions, rather than a recurring random event),
    and double-coin is checked once at harvest. A pest hit adds a flat
    24-hour penalty to that one roll's grow time rather than modeling
    an ongoing infestation.
  - `harvest_plot()` deletes the planting row on both outcomes: a
    wilted plant returns `{"wilted": true}` (nothing granted), a ready
    plant rolls a produce quantity, credits it to inventory, and credits
    coins directly (doubled on a `double_coin_chance` hit) — modeled as
    a coin credit rather than doubling the item quantity so "double
    coins" from the ask could be implemented literally.
  - The player-facing `/garden` page (`GardenGrid`) renders `garden_rows
    + 1` rows — the extra row always shows locked (dashed border, lock
    icon, an `ExpandGardenButton` mirroring `ExpandDenButton`'s existing
    client-RPC-then-refresh pattern) as a preview of the next unlock
    rather than only appearing once affordable. Clicking an empty plot
    opens `PlantSeedModal`, listing the player's seed and (optionally)
    fertilizer inventory; clicking Plant calls `plant_seed` directly from
    the client, same as the Water/Harvest buttons on occupied plots call
    `water_plant`/`harvest_plot` — no server actions, matching the
    existing convention for this class of simple state-changing control
    (`ForTradeToggle`, `PetNameEditor`, `ExpandDenButton`, etc.). Display
    state (which of the 3 stage images to show, whether to show the
    water-droplet icon) is computed client-side in `src/lib/garden.ts`
    by mirroring the SQL's own pause logic (freezing "now" at
    `min(actual now, next_water_needed_at)` for progress purposes) so
    the UI never shows a state a reload wouldn't also show.
  - New admin tooling: a `garden-plants` catalog CRUD (mirrors the
    `species` admin pages, but with URL-only image inputs for the 3
    growth-stage images instead of file upload — a deliberate scope
    trim, since `uploadGameImage()`'s folder type would need extending
    for a 4th case) and, on the existing item edit page, a conditional
    seed-pool editor (`type === "seed"`, reusing `SearchablePicker`) or
    fertilizer-effects editor (`type === "fertilizer"`, a plain
    `<select>` of remaining effect types) depending on the item's type.
  - Verified against a local Postgres instance (all 35 migrations
    applied cleanly) with 15 scripted scenarios covering: specific vs.
    pooled seed resolution, double-planting/out-of-bounds/other-user's-
    plot rejections, fertilizer duration/inventory effects, the 8-hour
    water rate limit, the overdue-gap catch-up math, the wilt threshold,
    both resolve_due_garden edge cases described above, harvest payouts
    for both ready and wilted plants, row expansion cost/crediting, and
    that the privileged-column trigger still blocks a direct client
    write to `garden_rows`. Verified visually with a temporary preview
    route + dev server + Playwright (cleaned up after): all three growth
    stages, the water-droplet icon and Water/Harvest buttons on the
    right plots, a wilted plot's harvest-for-nothing styling, the
    locked/expansion row, and the planting pop-up with seed and
    fertilizer (including a "None" option) selectable.
- **Growth stages were already fully wired up from the gardening round**
  (`garden_plants.image_stage{1,2,3}_url`, editable on the
  `/admin/garden-plants` form, rendered client-side by
  `getGardenPlantingDisplay()`) — asked to "make sure" this worked, the
  answer was mostly "it already does." Two small, purely-visual
  additions made it easier to see and trust, rather than changing any
  of the stage logic itself:
  - `garden-plant-form.tsx`'s three stage URL fields each gained a live
    14×14 thumbnail (a new `StageImageField` client component wrapping
    each `<input>` in local `useState`) that updates as the admin types,
    the same "see what you're pasting" idea as the file-upload preview
    on the regular item form, just URL-driven instead of
    `URL.createObjectURL` since there's still no file upload for this
    catalog (see the existing scope-trim note above).
  - The `/admin/garden-plants` list page's one column showed only the
    stage-1 thumbnail before; it now shows all three side by side (a
    dashed placeholder box for any stage left blank), so a glance at
    the list itself confirms a plant has real stage art rather than
    having to open each row.
- **Shop** (`0036_shop.sql`) is one nullable column, `items.shop_price`,
  plus one RPC, `buy_shop_item(user, item, quantity)` — no separate
  "shop listings" table. The RPC mirrors `expand_garden`'s shape exactly
  (lock the user row, validate, `begin_trusted_user_write()` before the
  `coin_balance` debit, same "not authorized"/insufficient-funds
  exception style) and grants the purchased item the same
  upsert-onto-`user_inventory` way `harvest_plot` already does. Verified
  against local Postgres with 8 scripted scenarios: a purchase debits
  coins and credits inventory correctly, a second purchase of the same
  item stacks quantity rather than creating a duplicate row,
  insufficient funds/an unpriced item/a nonexistent item/quantity 0/a
  mismatched `auth.uid()` are all correctly rejected, and the final
  balance matches exactly what the accepted purchases should have cost.
  - Deliberately not seed-specific in the schema or the RPC — any item
    can be priced for the shop from the same field on the existing item
    edit form (right below sell value, with a "blank = not sold" hint),
    consistent with this codebase's habit of avoiding special-case
    tables/branches when one general mechanism covers it. Only the two
    existing seed items are actually priced by this migration's seed
    data (15/40 coins) because that's what was asked for — an admin can
    price a fertilizer or anything else for sale later with no code
    changes, but nothing else is for sale out of the box.
  - `/shop` (new page, added to the nav's Trade group ahead of
    Marketplace) lists everything with a `shop_price` set, each item's
    art/type/rarity, the player's own quantity already owned (if any),
    and a `BuyShopItemButton` — the same client-calls-RPC-then-
    `router.refresh()` shape as `ExpandGardenButton`/`ForTradeToggle`,
    disabled with a "Not enough coins" hint when the displayed price
    exceeds the player's balance (display-only; the RPC is what actually
    enforces it).
  - Verified visually with a temporary preview route + dev server +
    Playwright (cleaned up after): the shop grid with a mix of
    affordable/unaffordable items and an "owned" quantity badge, and the
    admin plant form's new stage-image thumbnails rendering next to each
    URL field.
- **Growth stages widened from 3 to 4** (`0037_garden_plant_stage4.sql`):
  one new nullable `garden_plants.image_stage4_url` column, no RPC
  changes — `plant_seed`/`water_plant`/`resolve_due_garden`/
  `harvest_plot` never knew or cared how many visual stages there were,
  only `src/lib/garden.ts`'s client-side stage calc did.
  `getGardenPlantingDisplay()`'s thresholds moved from thirds
  (`progressFraction >= 2/3`/`>= 1/3`) to quarters (`>= 3/4`/`>= 2/4`/
  `>= 1/4`), and `GardenGrid`'s image lookup switched from a
  stage-2-or-3-or-else ternary to indexing a `[stage1, stage2, stage3,
  stage4]` array by `display.stage - 1` — reads better than a longer
  ternary chain once there's a 4th case, and the array shape makes it
  obvious how to add a 5th later if this changes again.
  `admin/garden-plants` gained a 4th `StageImageField` (the live-preview
  component added in the shop round) and its list page now shows all 4
  stage thumbnails instead of 3. Verified against local Postgres (all
  37 migrations, including this one, apply cleanly; spot-checked the
  seed data landed the right per-plant stage-4 URL for each of the 3
  existing plants) and visually via a temporary preview route (cleaned
  up after) rendering 4 mock plantings at 1/8, 3/8, 5/8, and 7/8
  progress to confirm they land on stages 1, 2, 3, and 4 respectively
  (worked out algebraically from the display math, since the sandbox
  can't load the placehold.co preview art itself to eyeball directly),
  plus the admin form showing all 4 stage fields with live thumbnails.
- **Trait-based breeding** (`0038`-`0041`) is by far the largest single
  change this project has taken on — a full rework of how a pet looks
  and where pets come from, built from a design-doc spec covering data
  model, art pipeline, rollout order, and several explicitly-undecided
  open questions. Asked to build "everything in the doc," one genuinely
  blocking question (where a second, breedable pet comes from, since
  zones stop granting pets) needed the user's own decision before any
  of this could work at all — they picked "every player gets a second
  free starter." Every other open question (inheritance split, timer
  length, coin cost, same-breed-only for v1, a bred pet's blank name)
  was resolved by taking the doc's own proposed defaults, since it
  explicitly frames those as starting points rather than blockers.
  - **Schema** (`0038_trait_breeding_schema.sql`): four new catalog
    tables — `breeds` (replaces species as the pet-identity table; a
    body shape only, no color baked in), `colors` (shared across every
    breed), `patterns`/`eye_types` (breed-specific, since their overlay
    masks must match that breed's proportions) — each on a new,
    narrower `trait_rarity` enum (common/uncommon/rare, a separate
    concept from items/pets' existing 5-tier `rarity_tier`, not a
    subset of it). `pets` gains nullable `breed_id` +
    `primary_color_id`/`secondary_color_id`/`tertiary_color_id` +
    `pattern_id`/`eye_type_id` + `gender` + `composited_image_url` +
    `parent_a_id`/`parent_b_id`, and a `pets_legacy_xor_trait` check
    constraint enforces that every pet has *exactly* one of
    `species_id` (legacy) or `breed_id` (every pet created from this
    migration forward) — never both, never neither.
  - **Deliberate deviation from the spec doc's own illustrative SQL**:
    the doc's Section 2 code sample shows `drop column species_id, drop
    column color` on `pets`, but its own Section 8 rollout plan is
    explicit that existing pets are grandfathered, not retrofitted, and
    that dropping those columns is "the only genuinely breaking change"
    that should happen "only after [breeding] is fully live and
    verified" — a later cleanup migration, not this one. This migration
    follows Section 8, not the Section 2 snippet: `species_id`/
    `color_variant` stay exactly as they are, every already-issued pet
    keeps displaying through them unchanged, and only new pets set
    `breed_id` instead.
  - **`zone_pet_pool` is dropped outright** — zones only ever grant
    items now. `pick_weighted_zone_reward` drops its pet branch entirely
    (return type changes from a `{reward_kind, species_id, item_id}`
    row to a plain `item_id`) and gains a `p_rarity_bias` parameter that
    re-weights the draw toward uncommon/rare-tier items — what
    `rarity_boost` potions now actually do, having been unimplemented
    since `0006`. `item_find_boost` (which biased a pet-vs-item split
    that no longer exists) is retired by repurposing its one existing
    potion recipe to `rarity_boost` in place, rather than leaving
    orphaned catalog content around or trying to drop the now-unusable
    enum value (Postgres can't drop enum values without recreating the
    type).
  - **Where the second starter pet comes from**: the existing tutorial
    flow already granted a starter pet instantly *and* auto-granted a
    second pet when the flavor "first adventure" tutorial expedition
    resolved 10 minutes later (previously both via zone pool rolls) —
    this shape is kept exactly, just switched from a pool roll to two
    fixed, hand-picked trait combinations (same breed, opposite gender,
    so the pair is breedable together the moment the second one
    arrives) — "granted the same way it always was," per the doc's own
    note about the tutorial pet.
  - **Compositing** (`src/lib/pet-compositor.ts`, using `sharp`): layer
    stack back to front is breed base line-art → primary/secondary/
    tertiary color fills → pattern overlay → eye-type overlay. Colors
    are applied by treating one region-mask image's R/G/B channels as
    each region's alpha coverage (`joinChannel`) — a standard multi-
    region recolor technique that needs only one mask file per breed
    rather than three. Verified directly against in-memory-generated
    test images (the sandbox can't reach placehold.co to fetch real
    layer URLs): a masked region tints to exactly the requested color,
    output is byte-for-byte deterministic for identical inputs, and
    differs for different inputs.
  - **Compositing can't run inside Postgres** (no `sharp`/Storage access
    from `plpgsql`), so every RPC that creates a trait-based pet leaves
    `composited_image_url` null; `compositeMissingPetImages()` — called
    right after `grant_starter_pet_and_tutorial`/`resolve_due_expeditions`/
    `resolve_due_breeding` on `/profile`, `/expeditions`, `/breeding` —
    finds any of the caller's pets still missing one, composites, and
    persists it via a new `set_pet_composited_image()` RPC that only
    ever fills in a currently-null value for a pet the caller owns
    (verified: a second call attempting to overwrite an already-set
    image is silently ignored) — a player can't use it to change their
    pet's display to an arbitrary URL after the fact.
  - **Deliberate deviation from the spec doc's cache-key design**: the
    doc describes caching composites by a hash of the trait combination
    alone, shared across every player who happens to roll the same
    combo. Implementing that literally would need a public storage path
    writable by any signed-in player's own session (no service-role
    client exists anywhere in this codebase — every trusted write goes
    through a Postgres security-definer RPC instead, and Storage writes
    can only happen from Node) keyed purely by the trait hash — meaning
    any player could overwrite the shared file for a trait combo they
    don't even own a pet of, potentially with offensive content that
    then displays for every player who has or later rolls that combo.
    That's a real content-safety hole, not a hypothetical one, so
    writes are scoped by owner instead (`pets/<owner_id>/<hash>.png`,
    RLS-enforced the same way `avatars` already scopes uploads by
    `auth.uid()`) — the hash-as-filename idea is kept (re-compositing
    the same combo for the same owner is still a cheap upsert), just
    not shared cross-player. A separate `previews/` path, gated by
    `current_user_is_admin()` instead, backs the admin "preview a
    random pet" button.
  - **Breeding** (`0040_breeding.sql`): `breeding_attempts` reuses
    `brew_status` verbatim (its `in_progress`/`awaiting_claim`/
    `completed` values already mean exactly what's needed) rather than
    defining a near-identical enum. `start_breeding` enforces: both pets
    owned by the caller, same non-null `breed_id` (legacy pets can't
    breed — they have none), opposite `gender`, neither pet already
    mid-breeding or mid-expedition, and a flat 200-coin cost (the doc
    leaves flat-vs-escalating as an open question; flat is its own
    simplest default). `resolve_due_breeding` rolls each of the 5 trait
    slots independently — 45% parent A / 45% parent B / 10% mutate
    (`roll_wild_color()`/`roll_wild_pattern()`/`roll_wild_eye_type()`,
    weighted by `trait_rarity` the same way a wild roll works) — the
    doc's own proposed starting percentages. `claim_egg` mirrors
    `claim_expedition_reward`'s keep/release shape exactly, computing
    the new pet's effective rarity (`effective_pet_rarity()`, the
    rarest trait tier across the five slots) and setting
    `parent_a_id`/`parent_b_id` for a future family-tree view.
  - **Admin tooling**: `/admin/breeds` (replaces `/admin/species` for
    new pets; `/admin/species` stays for editing legacy art) gets a
    "preview a random pet" button that rolls a wild combo and composites
    it on the spot — the same verification-before-shipping idea this
    project already applies to the recipe-book layout and garden
    growth-stage art, just for layer alignment instead. `/admin/colors`/
    `/admin/patterns`/`/admin/eye-types` are plain catalog CRUD (URL-only
    images with live thumbnails, matching garden plants/breeds — no
    file-upload support was added for this catalog either).
  - **Marketplace/trading fixes**: `create_pet_listing` still `join`ed
    (inner) `pets` to `species` — meaning listing *any* trait-based pet
    failed outright with "Pet not found," since an inner join excludes
    a row whose `species_id` is null. Fixed to a `coalesce`d left join
    against both `species` and `breeds` (verified: listing a starter
    pet, which has no `species_id`, now succeeds and correctly
    snapshots the breed name). Marketplace's listing *display* needed
    no changes at all — it already only reads the flat snapshot columns
    `create_pet_listing` writes, never a live join. Every place trading
    (still disabled behind `TRADING_ENABLED`) reads a pet's name/image
    directly — the picker modal, the trade detail page, the for-trade
    browse listing — was updated to the same `petImageUrl()`/
    `petTypeName()` fallback helpers (`src/lib/pet-display.ts`) pets/
    expeditions/marketplace already use, so re-enabling trading later
    isn't gated on a second pass through this code, per the doc's own
    explicit instruction to fix this even while the feature stays off.
  - Verified against local Postgres across three rounds: the schema
    migration (12 scenarios — starter-grant fixed traits, the
    `pets_legacy_xor_trait` constraint rejecting both invalid states,
    the tutorial expedition's second-pet grant, `effective_pet_rarity`'s
    max-across-five-slots math including the all-null fallback,
    `roll_wild_traits`, a 2000-roll weighting sanity check landing
    within a point of the expected ratio, confirming `zone_pet_pool` is
    gone, the new item-only `pick_weighted_zone_reward` signature,
    `item_find_boost`'s retirement, and `set_pet_composited_image`'s
    set-once guard), breeding (10 scenarios — eligibility on every
    rejected case, a successful attempt's exact coin deduction, the
    pending-lock preventing a second attempt on the same pets, the
    resolve→claim flow producing a pet with both parent links set, a
    double-claim rejection, and a 3000-roll inheritance-ratio sanity
    check landing within a point of 45/45/10), and the marketplace fix
    (listing a trait-based pet, previously broken, now succeeds). Also
    verified visually with a temporary preview route + dev server +
    Playwright (cleaned up after): all three `/breeding` states (pet
    picker, nesting countdown, egg-ready trait reveal with keep/release),
    and the admin breed/color forms with their live URL/hex previews. A
    full `next build` + `eslint` pass is clean across every touched
    file (18 pre-existing files updated, 26 new ones, spanning 4
    migrations).

- **Master site config (`src/config.ts`)**: a single file for site
  identity (`SITE_NAME`/`SITE_TAGLINE`/`FOOTER_TEXT`, wired into
  `layout.tsx`'s metadata and `site-footer.tsx`), currency display
  labels/emoji (`CURRENCY.coin`/`CURRENCY.gem`, wired into
  `site-header.tsx` and `breeding-nest.tsx`), and the `TRADING_ENABLED`
  feature flag (`src/lib/feature-flags.ts` is now a one-line re-export
  of it, so the 11 existing `from "@/lib/feature-flags"` imports keep
  working unchanged). Deliberately scoped smaller than a typical
  static-site config (e.g. lookbook's `src/config.mjs`): this is a
  live Next.js + Supabase app, so colors/layout are Tailwind classes
  baked into each component rather than a handful of theme variables,
  and real gameplay numbers (costs, rewards, timers) are enforced in
  the Supabase migrations, not the browser — `BREEDING_COST` here is
  a display-only mirror of `start_breeding()` in
  `0040_breeding.sql`, called out with a comment so it's not mistaken
  for the source of truth. The ~30 other inline `🪙`/`💎` literals
  across the trades/marketplace/shop pages were left as-is rather than
  swept into `CURRENCY` in this pass, to keep the change small and
  low-risk — worth doing as a follow-up if the emoji ever need to
  change.
