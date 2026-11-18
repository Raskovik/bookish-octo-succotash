-- Schema side of the admin panel redesign (furgarden-admin-panel
-- package). Per the player's own scoping decisions:
--   - Zone map position (map_x/y/width/height) stays in the DB — the
--     new simplified zone form just doesn't expose it. New zones get
--     their map position set directly by a developer, same as the
--     existing three.
--   - zones.tier is replaced with a flat per-zone reward override
--     (reward_coins_base/reward_coins_variance/reward_xp) instead of
--     the old shared tier-multiplier formula.
--   - items.rarity stays — it's load-bearing for the marketplace,
--     trades browser, item pickers and the loot reveal UI well beyond
--     admin. Only items.shop_price/is_active (confirmed dead outside
--     admin) are dropped.
--   - species.is_active is dropped entirely; is_starter_option alone
--     now gates the starter-pet picker (0070).
--   - shop_listings moves from is_active/is_new to starts_at/ends_at,
--     with status and tags computed from the dates.
--   - The rarity-tiered loot split (common/uncommon/rare) is replaced
--     with a single flat weighted item pool where each pool row also
--     carries its own amount (e.g. "10 Blueberries" and "5 Blueberries"
--     are two separate rows) — a "stack" is one row picked from that
--     pool, and a trip rolls a configurable number of stacks instead of
--     a fixed split across three rarity buckets.

-- ── zones ─────────────────────────────────────────────────────────────
alter table public.zones
  drop column tier,
  drop column unlock_requirement,
  add column reward_coins_base integer not null default 10 check (reward_coins_base >= 0),
  add column reward_coins_variance integer not null default 10 check (reward_coins_variance >= 0),
  add column reward_xp integer not null default 10 check (reward_xp >= 0);

comment on column public.zones.reward_coins_base is
  'Guaranteed coins per completed trip in this zone. Random bonus of 0..reward_coins_variance is added on top.';
comment on column public.zones.reward_xp is
  'XP granted per completed trip in this zone.';

-- ── items ─────────────────────────────────────────────────────────────
-- shop_price was superseded by shop_listings (0053) and read by nothing
-- but the now-dead buy_shop_item() this drops below. is_active has no
-- non-admin reader anywhere.
drop function if exists public.buy_shop_item(uuid, uuid, integer);

alter table public.items
  drop column shop_price,
  drop column is_active;

-- ── species ───────────────────────────────────────────────────────────
alter table public.species drop column is_active;

-- adopt_starter_pet (0070) checked is_active = true alongside
-- is_starter_option = true — drop that half of the check now that the
-- column's gone; is_starter_option alone decides.
create or replace function public.adopt_starter_pet(
  p_user_id uuid,
  p_species_id uuid,
  p_custom_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_display_name text;
  v_starter_label text;
  v_pet_count integer;
  v_den_size integer;
  v_name text;
  v_pet_id uuid;
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized.';
  end if;

  select display_name, den_size into v_display_name, v_den_size
  from public.users
  where id = p_user_id
  for update;

  if not found then
    raise exception 'Account not found.';
  end if;

  if v_display_name is null then
    raise exception 'Finish setting up your account first.';
  end if;

  select starter_label into v_starter_label
  from public.species
  where id = p_species_id and is_starter_option = true;

  if v_starter_label is null then
    raise exception 'That is not an available starter pet.';
  end if;

  v_name := nullif(trim(coalesce(p_custom_name, '')), '');
  if v_name is not null and v_name !~ '^[A-Za-z0-9][A-Za-z0-9 ''\-]{1,15}$' then
    raise exception 'Pet name must be 2 to 16 letters, numbers, spaces, hyphens or apostrophes.';
  end if;

  perform public.begin_trusted_user_write();
  update public.users
  set starter_granted = true
  where id = p_user_id and starter_granted = false;

  if not found then
    raise exception 'You have already adopted your starter pet.';
  end if;

  select count(*) into v_pet_count from public.pets where owner_id = p_user_id;
  if v_pet_count >= v_den_size then
    raise exception 'Your den is full — expand it or release a pet instead.';
  end if;

  insert into public.pets (owner_id, species_id, custom_name, roll_strength, roll_speed, roll_defence)
  values (p_user_id, p_species_id, coalesce(v_name, v_starter_label), 5, 5, 5)
  returning id into v_pet_id;

  return v_pet_id;
end;
$$;

-- ── zone_loot_table: amount per row, same item can repeat at a
--    different amount ──────────────────────────────────────────────────
alter table public.zone_loot_table
  add column amount integer not null default 1 check (amount > 0);

alter table public.zone_loot_table drop constraint zone_loot_table_pkey;
alter table public.zone_loot_table add primary key (zone_id, item_id, amount);

comment on column public.zone_loot_table.amount is
  'How many of the item one "stack" (one pick from this pool) grants — e.g. a row of 10 and a row of 5 for the same item are two separate, independently-weighted entries.';

-- pick_weighted_zone_item no longer takes a rarity — the whole pool is
-- one flat weighted draw now — and returns the picked row''s amount
-- alongside its item_id, since the caller grants that amount, not
-- always 1.
drop function if exists public.pick_weighted_zone_item(uuid, public.rarity_tier);

create function public.pick_weighted_zone_item(p_zone_id uuid)
returns table (item_id uuid, amount integer)
language sql
stable
as $$
  select zlt.item_id, zlt.amount
  from public.zone_loot_table zlt
  where zlt.zone_id = p_zone_id
  order by power(random(), 1.0 / zlt.drop_weight) desc
  limit 1;
$$;

revoke all on function public.pick_weighted_zone_item(uuid) from public;

-- ── shop_listings: date-driven, not a boolean ───────────────────────────
alter table public.shop_listings
  add column starts_at timestamptz not null default now(),
  drop column is_active,
  drop column is_new;

comment on column public.shop_listings.starts_at is
  'When this listing becomes available. Status/tags (Scheduled/In the shop/Ended, New, Limited) are computed from starts_at/ends_at at read time, not stored.';
comment on column public.shop_listings.description is
  'Override shown instead of the item''s own description (species have none) — null falls back to the item''s description at read time.';

-- ── buy_shop_listing: availability from dates, not is_active ───────────
create or replace function public.buy_shop_listing(p_user_id uuid, p_listing_id uuid, p_currency text)
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

  if not found or now() < v_listing.starts_at then
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
    insert into public.pets (owner_id, species_id)
    values (p_user_id, v_listing.species_id)
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

-- ── game_config: drop tier/rarity-split knobs, add stack count ─────────
delete from public.game_config
where key in (
  'loot_common_base', 'loot_common_scale', 'loot_uncommon_scale', 'loot_rare_scale',
  'coin_base_per_tier', 'coin_random_range_per_tier', 'xp_base', 'xp_tier_scale'
);

insert into public.game_config (key, value, label, description) values
  ('stacks_per_trip_min', 1, 'Fewest item stacks per trip',
   'A "stack" is one find from the zone''s Item pool (e.g. 10 Blueberries, if that''s how the pool entry is set up) — this is the minimum number of stacks even at zero Strength/level.'),
  ('stacks_per_trip_max', 8, 'Most item stacks per trip',
   'The most stacks a fully-powered trip can bring back.')
on conflict (key) do nothing;

-- ── resolve_due_expeditions: flat weighted stacks + per-zone rewards ────
create or replace function public.resolve_due_expeditions(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expedition record;
  v_den_size integer;
  v_pet_count integer;
  v_species_id uuid;
  v_new_pet_id uuid;
  v_item_bias numeric;
  v_double_chance numeric;
  v_is_double boolean;
  v_reward_coins_base integer;
  v_reward_coins_variance integer;
  v_reward_xp integer;
  v_coins integer;
  v_xp_gain integer;
  v_strength numeric;
  v_defence numeric;
  v_gs numeric;
  v_gd numeric;
  v_power numeric;
  v_stack_count integer;
  v_pass integer;
  v_loot record;
  v_i integer;
  v_sat_k numeric;
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized.';
  end if;

  v_sat_k := public.gc('stat_saturation_k');

  for v_expedition in
    select e.id, e.zone_id, e.is_tutorial, e.item_find_bias, e.double_reward_chance, e.pet_id,
      p.level, p.roll_strength, p.roll_defence
    from public.expeditions e
    join public.pets p on p.id = e.pet_id
    where e.user_id = p_user_id
      and e.status = 'in_progress'
      and e.resolves_at <= now()
    for update of e
  loop
    if v_expedition.is_tutorial then
      v_new_pet_id := null;

      select den_size into v_den_size from public.users where id = p_user_id;
      select count(*) into v_pet_count from public.pets where owner_id = p_user_id;

      if v_pet_count < v_den_size then
        v_species_id := public.pick_weighted_zone_species(v_expedition.zone_id);

        if v_species_id is not null then
          insert into public.pets (owner_id, species_id)
          values (p_user_id, v_species_id)
          returning id into v_new_pet_id;
        end if;
      end if;

      update public.expeditions
      set status = 'completed', result_pet_id = v_new_pet_id
      where id = v_expedition.id;
    else
      select reward_coins_base, reward_coins_variance, reward_xp
      into v_reward_coins_base, v_reward_coins_variance, v_reward_xp
      from public.zones where id = v_expedition.zone_id;

      v_strength := v_expedition.level * 2 * (v_expedition.roll_strength / 10.0);
      v_defence := v_expedition.level * 2 * (v_expedition.roll_defence / 10.0);
      v_gs := v_strength / (v_strength + v_sat_k);
      v_gd := v_defence / (v_defence + v_sat_k);

      v_power := (v_gs + v_expedition.level::numeric / 25) / 2;
      v_power := least(1.0, greatest(0.0, v_power * coalesce(v_expedition.item_find_bias, 1.0)));

      v_stack_count := round(
        public.gc('stacks_per_trip_min')
        + v_power * (public.gc('stacks_per_trip_max') - public.gc('stacks_per_trip_min'))
      )::int;

      v_double_chance := coalesce(v_expedition.double_reward_chance, public.gc('double_haul_base_chance'));
      v_is_double := (random() < v_double_chance) or (random() < public.gc('double_haul_strength_weight') * v_gs);

      for v_pass in 1..(case when v_is_double then 2 else 1 end) loop
        for v_i in 1..v_stack_count loop
          select * into v_loot from public.pick_weighted_zone_item(v_expedition.zone_id);
          if v_loot.item_id is not null then
            insert into public.expedition_loot_items (expedition_id, item_id, quantity)
            values (v_expedition.id, v_loot.item_id, v_loot.amount)
            on conflict (expedition_id, item_id) do update
              set quantity = public.expedition_loot_items.quantity + v_loot.amount;
          end if;
        end loop;
      end loop;

      v_species_id := public.pick_weighted_zone_species(v_expedition.zone_id);

      v_coins := coalesce(v_reward_coins_base, 10) + floor(random() * (coalesce(v_reward_coins_variance, 10) + 1))::int;
      v_xp_gain := coalesce(v_reward_xp, 10);

      perform public.begin_trusted_user_write();
      update public.users set coin_balance = coin_balance + v_coins where id = p_user_id;
      update public.pets set xp = xp + v_xp_gain where id = v_expedition.pet_id;

      update public.expeditions
      set status = 'awaiting_claim',
        pending_species_id = v_species_id,
        is_double_reward = v_is_double,
        coins_reward = v_coins,
        xp_reward = v_xp_gain
      where id = v_expedition.id;
    end if;
  end loop;
end;
$$;
