-- Marketplace changes for the new design handoff:
-- 1. Listing duration becomes a fixed 7 days (the player's own call —
--    the design doesn't offer a choice; this drops the 1/3/7/14/30-day
--    picker that create_pet_listing/create_item_listing used to take
--    as p_duration_days). Removing a parameter changes the function's
--    signature, so both need drop + create, not create or replace.
-- 2. Real bug found while porting this: 0029_bans_and_staff_fixes.sql's
--    create_item_listing is missing the inventory deduction
--    0020_marketplace_item_escrow.sql's original version had — the
--    seller's quantity was never actually escrowed at listing time,
--    even though cancel_listing/resolve_expired_listings both credit
--    an escrowed quantity BACK, assuming it was removed up front. Left
--    as-is, a seller keeps full use of an item while it's listed, and
--    gets a free bonus copy back whenever that listing expires. Fixed
--    here by restoring the deduction.
-- 3. Cross-enforces "a pet that's out exploring can't be listed, and a
--    listed pet can't be sent exploring" (per the design) — neither
--    direction was actually checked before.
drop function if exists public.create_pet_listing(uuid, uuid, integer, integer, integer);

create function public.create_pet_listing(
  p_seller_id uuid,
  p_pet_id uuid,
  p_price_coins integer,
  p_price_gems integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing_id uuid;
  v_species_name text;
  v_species_image_url text;
  v_rarity public.rarity_tier;
  v_custom_name text;
begin
  if auth.uid() is distinct from p_seller_id then
    raise exception 'Not authorized';
  end if;

  if public.user_has_active_ban(p_seller_id, 'sales') then
    raise exception 'You are currently banned from creating marketplace listings.';
  end if;

  if coalesce(p_price_coins, 0) <= 0 and coalesce(p_price_gems, 0) <= 0 then
    raise exception 'Set a coin price, a gem price, or both — at least 1.';
  end if;
  if p_price_coins is not null and p_price_coins <= 0 then
    raise exception 'Coin price must be at least 1.';
  end if;
  if p_price_gems is not null and p_price_gems <= 0 then
    raise exception 'Gem price must be at least 1.';
  end if;

  if exists (
    select 1 from public.marketplace_listings
    where pet_id = p_pet_id and status = 'active'
  ) then
    raise exception 'That pet is already listed.';
  end if;

  if exists (
    select 1 from public.expeditions
    where pet_id = p_pet_id and status in ('in_progress', 'awaiting_claim')
  ) then
    raise exception 'That pet is out exploring — it needs to come home first.';
  end if;

  select s.name, s.image_url, p.rarity, p.custom_name
  into v_species_name, v_species_image_url, v_rarity, v_custom_name
  from public.pets p
  join public.species s on s.id = p.species_id
  where p.id = p_pet_id and p.owner_id = p_seller_id;

  if not found then
    raise exception 'Pet not found.';
  end if;

  insert into public.marketplace_listings (
    seller_id, listing_type, price_coins, price_gems, expires_at,
    pet_id, pet_species_name, pet_species_image_url, pet_rarity, pet_custom_name
  )
  values (
    p_seller_id, 'pet', p_price_coins, p_price_gems, now() + interval '7 days',
    p_pet_id, v_species_name, v_species_image_url, v_rarity, v_custom_name
  )
  returning id into v_listing_id;

  return v_listing_id;
end;
$$;

revoke all on function public.create_pet_listing(uuid, uuid, integer, integer) from public;
grant execute on function public.create_pet_listing(uuid, uuid, integer, integer) to authenticated;

drop function if exists public.create_item_listing(uuid, uuid, integer, integer, integer, integer);

create function public.create_item_listing(
  p_seller_id uuid,
  p_item_id uuid,
  p_quantity integer,
  p_price_coins integer,
  p_price_gems integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing_id uuid;
  v_have integer;
begin
  if auth.uid() is distinct from p_seller_id then
    raise exception 'Not authorized';
  end if;

  if public.user_has_active_ban(p_seller_id, 'sales') then
    raise exception 'You are currently banned from creating marketplace listings.';
  end if;

  if coalesce(p_price_coins, 0) <= 0 and coalesce(p_price_gems, 0) <= 0 then
    raise exception 'Set a coin price, a gem price, or both — at least 1.';
  end if;
  if p_price_coins is not null and p_price_coins <= 0 then
    raise exception 'Coin price must be at least 1.';
  end if;
  if p_price_gems is not null and p_price_gems <= 0 then
    raise exception 'Gem price must be at least 1.';
  end if;

  if p_quantity <= 0 then
    raise exception 'Quantity must be at least 1.';
  end if;

  select quantity into v_have
  from public.user_inventory
  where user_id = p_seller_id and item_id = p_item_id
  for update;

  -- Reflects whatever's left after any of this seller's OTHER active
  -- listings already escrowed their share — real inventory, not a
  -- snapshot — so listing more of the same item than actually remains
  -- unlisted fails here.
  if coalesce(v_have, 0) < p_quantity then
    raise exception 'You don''t have that many to list.';
  end if;

  update public.user_inventory
  set quantity = quantity - p_quantity
  where user_id = p_seller_id and item_id = p_item_id;

  insert into public.marketplace_listings (
    seller_id, listing_type, price_coins, price_gems, expires_at, item_id, item_quantity
  )
  values (
    p_seller_id, 'item', p_price_coins, p_price_gems, now() + interval '7 days',
    p_item_id, p_quantity
  )
  returning id into v_listing_id;

  return v_listing_id;
end;
$$;

revoke all on function public.create_item_listing(uuid, uuid, integer, integer, integer) from public;
grant execute on function public.create_item_listing(uuid, uuid, integer, integer, integer) to authenticated;

-- start_expedition (0055's body, same signature, so a plain replace)
-- gains the other half of the mutual-exclusion rule: can't send a pet
-- out while it's actively listed on the marketplace.
create or replace function public.start_expedition(
  p_user_id uuid,
  p_pet_id uuid,
  p_zone_id uuid,
  p_potion_item_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last_fed_at timestamptz;
  v_zone_active boolean;
  v_zone_is_tutorial boolean;
  v_duration_seconds integer;
  v_expedition_id uuid;
  v_potion_quantity integer;
  v_effect_type public.potion_effect_type;
  v_effect_magnitude numeric;
  v_item_bias numeric;
  v_double_chance numeric;
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized.';
  end if;

  select last_fed_at into v_last_fed_at
  from public.pets where id = p_pet_id and owner_id = p_user_id for update;
  if not found then
    raise exception 'Pet not found.';
  end if;

  if exists (
    select 1 from public.expeditions
    where pet_id = p_pet_id and status in ('in_progress', 'awaiting_claim')
  ) then
    raise exception 'That pet is already on an expedition.';
  end if;

  if exists (
    select 1 from public.marketplace_listings
    where pet_id = p_pet_id and status = 'active'
  ) then
    raise exception 'That pet is listed on the marketplace — cancel the listing first.';
  end if;

  if public.calc_pet_energy_percent(v_last_fed_at) <= 20 then
    raise exception 'This pet''s energy is too low to adventure — feed it first.';
  end if;

  select is_active, is_tutorial into v_zone_active, v_zone_is_tutorial
  from public.zones
  where id = p_zone_id;

  if v_zone_active is null or not v_zone_active or v_zone_is_tutorial then
    raise exception 'Zone not found or not available.';
  end if;

  if exists (
    select 1 from public.expeditions
    where user_id = p_user_id and zone_id = p_zone_id and status in ('in_progress', 'awaiting_claim')
  ) then
    raise exception 'You already have an expedition active in that area.';
  end if;

  v_duration_seconds := 120 + floor(random() * 61)::int; -- 120-180s (2-3 min) base roll

  if p_potion_item_id is not null then
    select quantity into v_potion_quantity
    from public.user_inventory
    where user_id = p_user_id and item_id = p_potion_item_id
    for update;

    if v_potion_quantity is null or v_potion_quantity < 1 then
      raise exception 'You don''t have that potion.';
    end if;

    select effect_type, effect_magnitude into v_effect_type, v_effect_magnitude
    from public.potion_recipes
    where output_potion_item_id = p_potion_item_id
    limit 1;

    if v_effect_type is null then
      raise exception 'That item isn''t a usable potion.';
    end if;

    update public.user_inventory
    set quantity = quantity - 1
    where user_id = p_user_id and item_id = p_potion_item_id;

    if v_effect_type = 'duration_reduction' then
      v_duration_seconds := greatest(30, round(v_duration_seconds * (1 - v_effect_magnitude))::int);
    elsif v_effect_type = 'item_find_boost' then
      v_item_bias := v_effect_magnitude;
    elsif v_effect_type = 'double_reward_chance' then
      v_double_chance := v_effect_magnitude;
    end if;
    -- rarity_boost: recognized and consumed, still no effect applied.
  end if;

  insert into public.expeditions
    (user_id, pet_id, zone_id, status, is_tutorial, started_at, resolves_at, item_find_bias, double_reward_chance)
  values
    (p_user_id, p_pet_id, p_zone_id, 'in_progress', false, now(), now() + make_interval(secs => v_duration_seconds), v_item_bias, v_double_chance)
  returning id into v_expedition_id;

  return v_expedition_id;
end;
$$;
