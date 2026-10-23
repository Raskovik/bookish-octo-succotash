-- Pet energy — decays naturally over time, restored by feeding, and a
-- pet below MIN_ENERGY_TO_ADVENTURE can't be sent on an expedition.
--
-- Not a ticking stored value: there's no cron in this app (see
-- resolve_due_expeditions()'s own "lazy, no cron" precedent) — energy
-- is a pure function of time elapsed since last_fed_at, computed fresh
-- on every read. calc_pet_energy_percent() below is that function in
-- SQL, for the one place energy is actually enforced (start_expedition).
-- src/lib/pet-energy.ts mirrors the same formula in TypeScript for
-- display — keep the two in sync by hand if the decay rate changes,
-- same convention src/config.ts already documents for its own
-- RPC-mirroring display constants.
--
-- Feeding is a free action in this first pass: no food item, no coin
-- cost, no cooldown. There's no food-themed item in the game yet, and
-- adding one (a new item_type, seed data, a shop listing) is a bigger
-- piece than what was asked for here — easy to layer a cost on top of
-- feed_pet() later without changing its shape.
alter table public.pets
  add column last_fed_at timestamptz not null default now();

comment on column public.pets.last_fed_at is
  'Energy decay clock — see calc_pet_energy_percent() below and calcPetEnergy() in src/lib/pet-energy.ts. Reset to now() only by feed_pet(). Defaults to now() so a freshly adopted/hatched pet starts at full energy.';

-- Hours to decay from 100 to 0, and the floor to adventure — mirrored
-- in src/lib/pet-energy.ts as ENERGY_DECAY_HOURS/MIN_ENERGY_TO_ADVENTURE.
-- Kept as a SQL function (not inlined at each call site) so there's one
-- place to change the formula later if something else needs to check it.
create function public.calc_pet_energy_percent(p_last_fed_at timestamptz)
returns numeric
language sql
stable
as $$
  select greatest(0, least(100,
    100 - (extract(epoch from (now() - p_last_fed_at)) / 3600.0 / 48 * 100)
  ));
$$;

revoke all on function public.calc_pet_energy_percent(timestamptz) from public;
grant execute on function public.calc_pet_energy_percent(timestamptz) to authenticated;

create function public.feed_pet(p_user_id uuid, p_pet_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized.';
  end if;

  update public.pets
  set last_fed_at = now()
  where id = p_pet_id and owner_id = p_user_id;

  if not found then
    raise exception 'Pet not found.';
  end if;
end;
$$;

revoke all on function public.feed_pet(uuid, uuid) from public;
grant execute on function public.feed_pet(uuid, uuid) to authenticated;

-- ── start_expedition: same body as 0042's redefinition, plus an energy
-- gate right after the already-on-an-expedition check (confirm the pet
-- can physically go before worrying about which zone it's going to) ──
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

  if public.calc_pet_energy_percent(v_last_fed_at) < 75 then
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

revoke all on function public.start_expedition(uuid, uuid, uuid, uuid) from public;
grant execute on function public.start_expedition(uuid, uuid, uuid, uuid) to authenticated;
