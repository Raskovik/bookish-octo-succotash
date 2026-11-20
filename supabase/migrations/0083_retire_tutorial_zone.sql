-- Retires the "Starter Pool (Placeholder Zone)" (id ...201, is_tutorial
-- = true) the same way 0060 retired the other three dev placeholder
-- zones. It's been fully unreachable since 0070 replaced the old
-- auto-random-starter-pet + auto-tutorial-expedition flow
-- (grant_starter_pet_and_tutorial, dropped there) with the current
-- explicit onboarding (adopt_starter_pet, gated on
-- species.is_starter_option — nothing to do with this zone) — 0070's
-- own comment already noted start_expedition excludes is_tutorial
-- zones from normal trip selection, so it's simply unused.
--
-- Not deleted: expeditions.zone_id has no cascade/delete behavior, so
-- deleting would fail outright the moment it hit any of this zone's
-- historical expedition rows from before 0070. Deactivated instead,
-- same as the other three placeholders — is_active is what both RLS
-- ("Active zones are viewable by everyone") and every player-facing
-- zone query already gate on.
--
-- zones.is_tutorial itself can go now that its only zone is retired the
-- normal (is_active) way — nothing needs the separate flag anymore.
-- expeditions.is_tutorial is untouched: it's a different column on a
-- different table, still meaningful for historical rows, and
-- resolve_due_expeditions (0082) still branches on it for any — purely
-- hypothetical at this point — still-unresolved legacy tutorial trip.
update public.zones
set is_active = false
where id = '00000000-0000-0000-0000-000000000201';

alter table public.zones drop column is_tutorial;

-- start_expedition (0080's version) selected zones.is_tutorial
-- specifically to reject it even if somehow still active — redundant
-- now that the column (and the zone's own is_active) already covers it,
-- so this just drops that half of the check.
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
  v_level integer;
  v_roll_speed smallint;
  v_speed numeric;
  v_gp numeric;
  v_k numeric;
  v_u numeric;
  v_duration_minutes numeric;
  v_zone_active boolean;
  v_duration_seconds integer;
  v_expedition_id uuid;
  v_potion_quantity integer;
  v_effect_type public.potion_effect_type;
  v_effect_magnitude numeric;
  v_item_bias numeric;
  v_double_chance numeric;
  v_is_first_trip boolean;
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized.';
  end if;

  select last_fed_at, level, roll_speed into v_last_fed_at, v_level, v_roll_speed
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

  select is_active into v_zone_active
  from public.zones
  where id = p_zone_id;

  if v_zone_active is null or not v_zone_active then
    raise exception 'Zone not found or not available.';
  end if;

  if exists (
    select 1 from public.expeditions
    where user_id = p_user_id and zone_id = p_zone_id and status in ('in_progress', 'awaiting_claim')
  ) then
    raise exception 'You already have an expedition active in that area.';
  end if;

  v_speed := v_level * 2 * (v_roll_speed / 10.0);
  v_gp := v_speed / (v_speed + public.gc('stat_saturation_k'));
  v_k := 1 + public.gc('trip_duration_speed_skew') * v_gp;
  v_u := power(random(), v_k);
  v_duration_minutes := public.gc('trip_duration_min_minutes')
    + (public.gc('trip_duration_max_minutes') - public.gc('trip_duration_min_minutes')) * v_u;
  v_duration_seconds := round(v_duration_minutes * 60)::int;

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
      v_duration_seconds := greatest(600, round(v_duration_seconds * (1 - v_effect_magnitude))::int);
    elsif v_effect_type = 'item_find_boost' then
      v_item_bias := v_effect_magnitude;
    elsif v_effect_type = 'double_reward_chance' then
      v_double_chance := v_effect_magnitude;
    end if;
  end if;

  select not exists (
    select 1 from public.expeditions where user_id = p_user_id
  ) into v_is_first_trip;

  if v_is_first_trip then
    v_duration_seconds := round(public.gc('first_trip_duration_minutes') * 60)::int;
  end if;

  insert into public.expeditions
    (user_id, pet_id, zone_id, status, is_tutorial, started_at, resolves_at, item_find_bias, double_reward_chance)
  values
    (p_user_id, p_pet_id, p_zone_id, 'in_progress', false, now(), now() + make_interval(secs => v_duration_seconds), v_item_bias, v_double_chance)
  returning id into v_expedition_id;

  return v_expedition_id;
end;
$$;
