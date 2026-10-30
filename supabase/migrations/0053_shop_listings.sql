-- Replaces the old "any item can have a shop_price" shop (0036_shop.sql)
-- with a real admin-managed catalog: shop_listings, one row per thing
-- for sale, each with its own section (which tab it shows under),
-- price(s) (coin and/or gem — an item can cost either, same dual-price
-- shape as marketplace_listings), an optional "New" flag, and an
-- optional expiry for limited-time listings. items.shop_price/
-- buy_shop_item are left in place (nothing references them from the
-- new page, but dropping a column/function on the off chance something
-- else depends on it isn't worth the risk for a one-column deprecation).
--
-- Two listing types:
-- - 'item': grants one of an existing items-catalog row, same as
--   buy_shop_item always did (user_inventory quantity += 1).
-- - 'pet': MINTS a brand-new pet of the given species for the buyer —
--   not drawn from any existing player's collection, same insert shape
--   (owner_id, species_id, rarity) as grant_starter_pet_and_tutorial/
--   resolve_due_expeditions, so it gets the same column defaults (level
--   1, random 1-10 stat rolls, full energy) a hatched/adopted pet would.
--   Still subject to the den-size cap those paths enforce.
create type public.shop_section as enum ('pets', 'food', 'den', 'specials');
create type public.shop_listing_type as enum ('item', 'pet');

create table public.shop_listings (
  id uuid primary key default gen_random_uuid(),
  section public.shop_section not null,
  listing_type public.shop_listing_type not null,
  item_id uuid references public.items (id),
  species_id uuid references public.species (id),
  -- Shop-specific flavor text (neither items nor species has a
  -- description column) — the one-liner shown under the item's name on
  -- both the card and the buy dialog. Optional; the card's .sh-desc is
  -- just omitted when null.
  description text,
  price_coins integer check (price_coins is null or price_coins >= 0),
  price_gems integer check (price_gems is null or price_gems >= 0),
  is_new boolean not null default false,
  -- Null = not time-limited. A listing past its ends_at is treated as
  -- unavailable (see buy_shop_listing and the page's own query) without
  -- needing a cron to flip is_active — same "lazy, computed on read"
  -- reasoning as expeditions/pet energy elsewhere in this app.
  ends_at timestamptz,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint shop_listings_type_target check (
    (listing_type = 'item' and item_id is not null and species_id is null)
    or (listing_type = 'pet' and species_id is not null and item_id is null)
  ),
  constraint shop_listings_has_a_price check (price_coins is not null or price_gems is not null)
);

create index shop_listings_section_idx on public.shop_listings (section, sort_order);

comment on column public.shop_listings.ends_at is
  'Limited-time listings — shown with a "Limited" tag and leave the shop on their own once this passes. Checked on read (buy_shop_listing + the page query), not by a cron.';

alter table public.shop_listings enable row level security;

create policy "Shop listings are viewable by everyone"
  on public.shop_listings for select
  using (true);

-- Admin-managed, same RLS-gated-on-current_user_is_admin()-plus-audit-
-- trigger shape as every other catalog table in 0009_admin_panel.sql.
create policy "Admins can insert shop listings"
  on public.shop_listings for insert
  with check (public.current_user_is_admin());

create policy "Admins can update shop listings"
  on public.shop_listings for update
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

create policy "Admins can delete shop listings"
  on public.shop_listings for delete
  using (public.current_user_is_admin());

create trigger audit_shop_listings
  after insert or update or delete on public.shop_listings
  for each row execute function public.log_admin_action();

-- ── Buying ───────────────────────────────────────────────────────────
create function public.buy_shop_listing(p_user_id uuid, p_listing_id uuid, p_currency text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing record;
  v_price integer;
  v_coin_balance integer;
  v_gem_balance integer;
  v_den_size integer;
  v_pet_count integer;
  v_species_rarity public.rarity_tier;
  v_new_pet_id uuid;
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized';
  end if;

  if p_currency not in ('coin', 'gem') then
    raise exception 'Invalid currency.';
  end if;

  select * into v_listing
  from public.shop_listings
  where id = p_listing_id
  for update;

  if not found or not v_listing.is_active then
    raise exception 'This listing is no longer available.';
  end if;

  if v_listing.ends_at is not null and v_listing.ends_at <= now() then
    raise exception 'This listing has expired.';
  end if;

  v_price := case when p_currency = 'coin' then v_listing.price_coins else v_listing.price_gems end;
  if v_price is null then
    raise exception 'This listing can''t be bought with that currency.';
  end if;

  select coin_balance, gem_balance into v_coin_balance, v_gem_balance
  from public.users
  where id = p_user_id
  for update;

  if p_currency = 'coin' and v_coin_balance < v_price then
    raise exception 'Not enough coins: this costs % coins, you have %', v_price, v_coin_balance;
  end if;
  if p_currency = 'gem' and v_gem_balance < v_price then
    raise exception 'Not enough gems: this costs % gems, you have %', v_price, v_gem_balance;
  end if;

  -- Checked (and, for pets, the den cap enforced) before any balance is
  -- touched, so a failure here never needs a refund.
  if v_listing.listing_type = 'pet' then
    select den_size into v_den_size from public.users where id = p_user_id;
    select count(*) into v_pet_count from public.pets where owner_id = p_user_id;

    if v_pet_count >= v_den_size then
      raise exception 'Your den is full — expand it before buying a new pet.';
    end if;
  end if;

  perform public.begin_trusted_user_write();
  if p_currency = 'coin' then
    update public.users set coin_balance = coin_balance - v_price where id = p_user_id;
  else
    update public.users set gem_balance = gem_balance - v_price where id = p_user_id;
  end if;

  if v_listing.listing_type = 'item' then
    insert into public.user_inventory (user_id, item_id, quantity)
    values (p_user_id, v_listing.item_id, 1)
    on conflict (user_id, item_id) do update
      set quantity = public.user_inventory.quantity + 1;
  else
    select rarity into v_species_rarity from public.species where id = v_listing.species_id;

    insert into public.pets (owner_id, species_id, rarity)
    values (p_user_id, v_listing.species_id, v_species_rarity)
    returning id into v_new_pet_id;
  end if;

  return jsonb_build_object(
    'listing_id', p_listing_id,
    'currency', p_currency,
    'price', v_price,
    'granted_pet_id', v_new_pet_id
  );
end;
$$;

revoke all on function public.buy_shop_listing(uuid, uuid, text) from public;
grant execute on function public.buy_shop_listing(uuid, uuid, text) to authenticated;

-- ── Seed data: carry the two existing shop_price seeds over so /shop
--    isn't empty on first load ────────────────────────────────────────
insert into public.shop_listings (section, listing_type, item_id, price_coins)
values
  ('food', 'item', '00000000-0000-0000-0000-000000000801', 15), -- Carrot Seed
  ('food', 'item', '00000000-0000-0000-0000-000000000802', 40); -- Wildflower Seed Packet
