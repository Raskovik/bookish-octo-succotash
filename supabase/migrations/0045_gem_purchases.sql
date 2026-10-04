-- Real-money gem purchases via Stripe Checkout. Gems were previously
-- grantable only by an admin testing themselves (admin_grant_self_currency,
-- 0011_currency_and_den_expansion.sql) — this is the real earn path that
-- comment anticipated. Players can also now get gems from each other via
-- Trading (re-enabled alongside this — see config.ts), which already
-- supports offering pure coins/gems with no pets/items attached, so no
-- new schema is needed for that side of it.

-- ── Gem packages: admin-managed catalog ─────────────────────────────
-- Same "deactivate rather than delete" shape as every other admin
-- catalog table (items/species/zones/forum_categories/site_news_posts).
-- price_cents is USD cents (Stripe's own smallest-unit convention, so
-- it passes straight through to a Checkout Session with no conversion).
-- No stripe_price_id column — a Checkout Session is created with ad-hoc
-- price_data built from this row at purchase time (see gems/actions.ts),
-- not a pre-synced Stripe Price object, so editing a package here is a
-- plain row edit with nothing to keep in sync on Stripe's side.
create table public.gem_packages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  gem_amount integer not null check (gem_amount > 0),
  price_cents integer not null check (price_cents > 0),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index gem_packages_sort_order_idx on public.gem_packages (sort_order);

alter table public.gem_packages enable row level security;

create policy "Gem packages are viewable by everyone"
  on public.gem_packages for select
  using (true);

create policy "Admins can insert gem packages"
  on public.gem_packages for insert
  with check (public.current_user_is_admin());

create policy "Admins can update gem packages"
  on public.gem_packages for update
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

-- No delete policy — same reasoning as every other admin catalog table.

create trigger audit_gem_packages
  after insert or update on public.gem_packages
  for each row execute function public.log_admin_action();

-- ── Gem purchases: a permanent record of each completed payment ────────
-- gem_amount/price_cents are a SNAPSHOT of the package at purchase time
-- (same reasoning as marketplace_listings' pet_species_name snapshot) —
-- what the player actually paid for stays accurate even if the package
-- is later edited or deactivated. stripe_checkout_session_id is unique
-- so the webhook (which Stripe may legitimately retry) can never credit
-- the same payment twice — see credit_gems_from_purchase below, which is
-- the only thing that ever writes to this table.
create table public.gem_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  package_id uuid references public.gem_packages (id) on delete set null,
  gem_amount integer not null check (gem_amount > 0),
  price_cents integer not null check (price_cents > 0),
  stripe_checkout_session_id text not null unique,
  stripe_payment_intent_id text,
  status text not null default 'completed' check (status in ('completed', 'refunded')),
  created_at timestamptz not null default now()
);

create index gem_purchases_user_id_created_at_idx on public.gem_purchases (user_id, created_at desc);

comment on table public.gem_purchases is
  'One row per completed Stripe payment. Written only by credit_gems_from_purchase below (called from the Stripe webhook using the service-role key) — never a plain client write, and never created when a Checkout Session merely starts, only once Stripe confirms it completed.';

alter table public.gem_purchases enable row level security;

create policy "Players can view their own gem purchases"
  on public.gem_purchases for select
  using (user_id = auth.uid());

create policy "Staff can view all gem purchases"
  on public.gem_purchases for select
  using (public.current_user_is_moderator());

-- No insert/update/delete policy for plain clients at all — see the
-- table comment. (Refund handling — flipping status to 'refunded' — is a
-- later module; the column exists now so that doesn't need a migration.)

-- ── credit_gems_from_purchase: the only thing that writes to either of
-- the above after creation ──────────────────────────────────────────
-- Deliberately NOT granted to `authenticated` — only `service_role` can
-- call this, since it has no auth.uid() check at all (the Stripe webhook
-- that calls it has no player session, just a verified webhook signature
-- — see api/stripe/webhook/route.ts). A regular player calling this
-- directly would be free-minting gems, so the grant below is the real
-- security boundary, not an in-function check.
--
-- Idempotent via the unique constraint on stripe_checkout_session_id:
-- `on conflict do nothing` means a webhook retry for an already-recorded
-- session is a silent no-op, including the gem_balance update, which
-- only runs when the insert actually inserted a new row.
create function public.credit_gems_from_purchase(
  p_user_id uuid,
  p_package_id uuid,
  p_gem_amount integer,
  p_price_cents integer,
  p_stripe_checkout_session_id text,
  p_stripe_payment_intent_id text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_purchase_id uuid;
begin
  insert into public.gem_purchases (
    user_id, package_id, gem_amount, price_cents,
    stripe_checkout_session_id, stripe_payment_intent_id
  )
  values (
    p_user_id, p_package_id, p_gem_amount, p_price_cents,
    p_stripe_checkout_session_id, p_stripe_payment_intent_id
  )
  on conflict (stripe_checkout_session_id) do nothing
  returning id into v_purchase_id;

  if v_purchase_id is not null then
    -- Same trusted-write idiom as admin_grant_self_currency
    -- (0011_currency_and_den_expansion.sql) — gem_balance is a
    -- protect_privileged_user_fields-guarded column, so a direct UPDATE
    -- without this gets silently reverted.
    perform public.begin_trusted_user_write();
    update public.users set gem_balance = gem_balance + p_gem_amount where id = p_user_id;
  end if;
end;
$$;

revoke all on function public.credit_gems_from_purchase(uuid, uuid, integer, integer, text, text) from public;
grant execute on function public.credit_gems_from_purchase(uuid, uuid, integer, integer, text, text) to service_role;
