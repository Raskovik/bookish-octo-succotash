-- Reverts 0038-0041 entirely: traits (breeds/colors/patterns/eye_types)
-- and breeding are gone, pets go back to one fixed species image each
-- (Chicken-Smoothie-style), and zones grant pets again, not just items.
-- Assumes 0038-0041 are already applied (run this after them, same as
-- every other migration in this project — it does not stand alone on a
-- database that skipped straight from 0037 to here).
--
-- Data safety: any pet that was actually bred/rolled as a trait-based pet
-- (breed_id set, species_id null — see pets_legacy_xor_trait, 0038) is
-- reassigned to a fallback species below, before the trait columns are
-- dropped, rather than silently losing its image. If real players never
-- ended up with trait-based pets (most likely, given how recently 0038
-- shipped), this update affects zero rows and is a no-op.
--
-- Data loss that genuinely can't be avoided: zone_pet_pool's original
-- rows were deleted outright when 0038 dropped that table, so recreating
-- its structure here does NOT restore which species used to drop in which
-- zone — an admin needs to re-populate each zone's pool via /admin/zones
-- (now restored below) after this migration runs.

-- ── Breeding: drop entirely ─────────────────────────────────────────────
drop function if exists public.claim_egg(uuid, uuid, boolean);
drop function if exists public.resolve_due_breeding(uuid);
drop function if exists public.start_breeding(uuid, uuid, uuid);
drop table if exists public.breeding_attempts;

-- ── Composited-pets storage bucket: drop entirely (0039) ────────────────
drop policy if exists "Admins can replace preview composites" on storage.objects;
drop policy if exists "Admins can upload preview composites" on storage.objects;
drop policy if exists "Users can replace their own pet composites" on storage.objects;
drop policy if exists "Users can upload their own pet composites" on storage.objects;
drop policy if exists "Anyone can view composited pet images" on storage.objects;
delete from storage.objects where bucket_id = 'composited-pets';
delete from storage.buckets where id = 'composited-pets';

-- ── Marketplace: create_pet_listing back to species-only (pre-0041) ─────
create or replace function public.create_pet_listing(
  p_seller_id uuid,
  p_pet_id uuid,
  p_price_coins integer,
  p_price_gems integer,
  p_duration_days integer
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

  if p_duration_days not in (1, 3, 7, 14, 30) then
    raise exception 'Invalid listing duration.';
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
    p_seller_id, 'pet', p_price_coins, p_price_gems, now() + (p_duration_days || ' days')::interval,
    p_pet_id, v_species_name, v_species_image_url, v_rarity, v_custom_name
  )
  returning id into v_listing_id;

  return v_listing_id;
end;
$$;

-- ── Trait-only helper functions: drop ────────────────────────────────────
drop function if exists public.set_pet_composited_image(uuid, uuid, text);
drop function if exists public.effective_pet_rarity(uuid, uuid, uuid, uuid, uuid);
drop function if exists public.roll_wild_traits(uuid);
drop function if exists public.roll_wild_eye_type(uuid);
drop function if exists public.roll_wild_pattern(uuid);
drop function if exists public.roll_wild_color();
drop function if exists public.trait_rarity_weight(public.trait_rarity);

-- ── pets: fall back any trait-based pet to a species, then drop the trait
-- columns and restore species_id as required ────────────────────────────
update public.pets
set species_id = (select id from public.species where is_active order by created_at limit 1)
where breed_id is not null and species_id is null;

alter table public.pets
  drop constraint if exists pets_legacy_xor_trait,
  drop column if exists breed_id,
  drop column if exists primary_color_id,
  drop column if exists secondary_color_id,
  drop column if exists tertiary_color_id,
  drop column if exists pattern_id,
  drop column if exists eye_type_id,
  drop column if exists gender,
  drop column if exists composited_image_url,
  drop column if exists parent_a_id,
  drop column if exists parent_b_id,
  alter column species_id set not null;

-- ── Trait catalog tables: drop (eye_types/patterns reference breeds, so
-- they go first) ─────────────────────────────────────────────────────────
drop table if exists public.eye_types;
drop table if exists public.patterns;
drop table if exists public.colors;
drop table if exists public.breeds;
drop type if exists public.trait_rarity;

-- ── Zones grant pets again: restore zone_pet_pool ────────────────────────
create table public.zone_pet_pool (
  zone_id uuid not null references public.zones (id) on delete cascade,
  species_id uuid not null references public.species (id) on delete cascade,
  drop_weight integer not null default 1 check (drop_weight > 0),
  primary key (zone_id, species_id)
);

alter table public.zone_pet_pool enable row level security;

create policy "Zone pet pools are viewable by everyone"
  on public.zone_pet_pool for select
  using (true);

create function public.pick_weighted_zone_species(p_zone_id uuid)
returns uuid
language sql
as $$
  select species_id
  from public.zone_pet_pool
  where zone_id = p_zone_id
  order by power(random(), 1.0 / drop_weight) desc
  limit 1;
$$;

revoke all on function public.pick_weighted_zone_species(uuid) from public;

-- ── Reward roll: pet-or-item again (return type changes, needs drop) ────
drop function if exists public.pick_weighted_zone_reward(uuid, numeric);

create function public.pick_weighted_zone_reward(p_zone_id uuid, p_item_bias numeric default 1.0)
returns table (reward_kind text, species_id uuid, item_id uuid)
language sql
as $$
  select reward_kind, species_id, item_id
  from (
    select 'pet' as reward_kind, species_id, null::uuid as item_id,
      power(random(), 1.0 / drop_weight) as roll
    from public.zone_pet_pool
    where zone_id = p_zone_id
    union all
    select 'item' as reward_kind, null::uuid as species_id, item_id,
      power(random(), 1.0 / (drop_weight * p_item_bias)) as roll
    from public.zone_loot_table
    where zone_id = p_zone_id
  ) combined
  order by roll desc
  limit 1;
$$;

-- ── start_expedition: item_find_bias again, not rarity_bias ─────────────
comment on column public.expeditions.rarity_bias is
  'Retired — restored to the pet-or-item zone roll model, which has no separate item-rarity axis to bias. Always null from this migration forward; see item_find_bias for what''s live again.';

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

  perform 1 from public.pets where id = p_pet_id and owner_id = p_user_id for update;
  if not found then
    raise exception 'Pet not found.';
  end if;

  if exists (
    select 1 from public.expeditions
    where pet_id = p_pet_id and status in ('in_progress', 'awaiting_claim')
  ) then
    raise exception 'That pet is already on an expedition.';
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

-- ── resolve_due_expeditions: tutorial rolls a species pet again, non-
-- tutorial rolls pet-or-item via pick_weighted_zone_reward ──────────────
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
  v_item_id uuid;
  v_species_rarity public.rarity_tier;
  v_new_pet_id uuid;
  v_item_bias numeric;
  v_double_chance numeric;
  v_is_double boolean;
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized.';
  end if;

  for v_expedition in
    select id, zone_id, is_tutorial, item_find_bias, double_reward_chance
    from public.expeditions
    where user_id = p_user_id
      and status = 'in_progress'
      and resolves_at <= now()
    for update
  loop
    if v_expedition.is_tutorial then
      v_new_pet_id := null;

      select den_size into v_den_size from public.users where id = p_user_id;
      select count(*) into v_pet_count from public.pets where owner_id = p_user_id;

      if v_pet_count < v_den_size then
        v_species_id := public.pick_weighted_zone_species(v_expedition.zone_id);

        if v_species_id is not null then
          select rarity into v_species_rarity from public.species where id = v_species_id;

          insert into public.pets (owner_id, species_id, rarity)
          values (p_user_id, v_species_id, v_species_rarity)
          returning id into v_new_pet_id;
        end if;
      end if;

      update public.expeditions
      set status = 'completed', result_pet_id = v_new_pet_id
      where id = v_expedition.id;
    else
      v_item_bias := coalesce(v_expedition.item_find_bias, 1.0);
      v_double_chance := coalesce(v_expedition.double_reward_chance, 0.05);

      select species_id, item_id into v_species_id, v_item_id
      from public.pick_weighted_zone_reward(v_expedition.zone_id, v_item_bias);

      v_is_double := random() < v_double_chance;

      update public.expeditions
      set status = 'awaiting_claim',
        pending_species_id = v_species_id,
        pending_item_id = v_item_id,
        is_double_reward = v_is_double
      where id = v_expedition.id;
    end if;
  end loop;
end;
$$;

-- ── claim_expedition_reward: pet-or-item again, same jsonb return shape
-- as before 0038 so this is a plain replace, not a drop + recreate ──────
create or replace function public.claim_expedition_reward(
  p_user_id uuid,
  p_expedition_id uuid,
  p_keep boolean
)
returns jsonb -- {"granted_pet_id": uuid|null, "bonus_kind"?: "pet"|"item", "bonus_name"?: text, "bonus_image_url"?: text}
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pending_species_id uuid;
  v_pending_item_id uuid;
  v_zone_id uuid;
  v_is_double boolean;
  v_item_bias numeric;
  v_species_rarity public.rarity_tier;
  v_den_size integer;
  v_pet_count integer;
  v_new_pet_id uuid;
  v_kept_item_id uuid;
  v_bonus_kind text;
  v_bonus_species_id uuid;
  v_bonus_item_id uuid;
  v_bonus_rarity public.rarity_tier;
  v_bonus_name text;
  v_bonus_image_url text;
  v_result jsonb;
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized.';
  end if;

  select pending_species_id, pending_item_id, zone_id, is_double_reward, item_find_bias
  into v_pending_species_id, v_pending_item_id, v_zone_id, v_is_double, v_item_bias
  from public.expeditions
  where id = p_expedition_id and user_id = p_user_id and status = 'awaiting_claim'
  for update;

  if not found then
    raise exception 'No reward waiting to be claimed for this expedition.';
  end if;

  if p_keep and v_pending_species_id is not null then
    select den_size into v_den_size from public.users where id = p_user_id;
    select count(*) into v_pet_count from public.pets where owner_id = p_user_id;

    if v_pet_count >= v_den_size then
      raise exception 'Your den is full — expand it or release this pet instead.';
    end if;

    select rarity into v_species_rarity from public.species where id = v_pending_species_id;

    insert into public.pets (owner_id, species_id, rarity)
    values (p_user_id, v_pending_species_id, v_species_rarity)
    returning id into v_new_pet_id;
  elsif p_keep and v_pending_item_id is not null then
    insert into public.user_inventory (user_id, item_id, quantity)
    values (p_user_id, v_pending_item_id, 1)
    on conflict (user_id, item_id) do update
      set quantity = public.user_inventory.quantity + 1;

    v_kept_item_id := v_pending_item_id;
  end if;

  -- Bonus roll from a double_reward_chance potion — only when keeping the
  -- primary reward; released along with it otherwise. Reuses the same
  -- item_find_bias the primary roll used, for a coherent effect.
  if p_keep and v_is_double then
    select reward_kind, species_id, item_id
    into v_bonus_kind, v_bonus_species_id, v_bonus_item_id
    from public.pick_weighted_zone_reward(v_zone_id, coalesce(v_item_bias, 1.0));

    if v_bonus_kind = 'pet' and v_bonus_species_id is not null then
      select den_size into v_den_size from public.users where id = p_user_id;
      select count(*) into v_pet_count from public.pets where owner_id = p_user_id;

      if v_pet_count < v_den_size then
        select rarity into v_bonus_rarity from public.species where id = v_bonus_species_id;
        insert into public.pets (owner_id, species_id, rarity) values (p_user_id, v_bonus_species_id, v_bonus_rarity);
        select name, image_url into v_bonus_name, v_bonus_image_url from public.species where id = v_bonus_species_id;
      else
        v_bonus_kind := null; -- den full: bonus silently forfeited, same as any other never-guaranteed outcome
      end if;
    elsif v_bonus_kind = 'item' and v_bonus_item_id is not null then
      insert into public.user_inventory (user_id, item_id, quantity)
      values (p_user_id, v_bonus_item_id, 1)
      on conflict (user_id, item_id) do update
        set quantity = public.user_inventory.quantity + 1;
      select name, image_url into v_bonus_name, v_bonus_image_url from public.items where id = v_bonus_item_id;
    else
      v_bonus_kind := null;
    end if;
  end if;

  update public.expeditions
  set status = 'completed', result_pet_id = v_new_pet_id, result_item_id = v_kept_item_id
  where id = p_expedition_id;

  v_result := jsonb_build_object('granted_pet_id', v_new_pet_id);
  if v_bonus_kind is not null then
    v_result := v_result || jsonb_build_object(
      'bonus_kind', v_bonus_kind,
      'bonus_name', v_bonus_name,
      'bonus_image_url', v_bonus_image_url
    );
  end if;

  return v_result;
end;
$$;

-- ── Starter grant: back to one fixed-pool species pet + a tutorial
-- expedition (which itself grants a second species pet on resolve, same
-- as any other expedition — see resolve_due_expeditions above) ──────────
create or replace function public.grant_starter_pet_and_tutorial(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutorial_zone_id uuid;
  v_species_id uuid;
  v_species_rarity public.rarity_tier;
  v_pet_id uuid;
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized.';
  end if;

  perform public.begin_trusted_user_write();
  update public.users
  set starter_granted = true
  where id = p_user_id and starter_granted = false;

  if not found then
    return;
  end if;

  select id into v_tutorial_zone_id
  from public.zones
  where is_tutorial and is_active
  limit 1;

  if v_tutorial_zone_id is null then
    raise exception 'No active tutorial/starter zone configured.';
  end if;

  v_species_id := public.pick_weighted_zone_species(v_tutorial_zone_id);

  if v_species_id is null then
    raise exception 'Tutorial/starter zone has no species in its pet pool.';
  end if;

  select rarity into v_species_rarity from public.species where id = v_species_id;

  insert into public.pets (owner_id, species_id, rarity)
  values (p_user_id, v_species_id, v_species_rarity)
  returning id into v_pet_id;

  insert into public.expeditions
    (user_id, pet_id, zone_id, status, is_tutorial, started_at, resolves_at)
  values
    (p_user_id, v_pet_id, v_tutorial_zone_id, 'in_progress', true, now(), now() + interval '10 minutes');
end;
$$;

-- ── Potion recipe: 0038 repurposed the item_find_boost recipe into
-- rarity_boost (which no longer does anything useful without the item-
-- rarity-biased roll it was written for) — put it back ──────────────────
update public.potion_recipes
set effect_type = 'item_find_boost', effect_magnitude = 2.0
where effect_type = 'rarity_boost';
