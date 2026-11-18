-- Two changes, bundled together since both touch resolve_due_expeditions:
--
-- 1. Every completed (non-tutorial) expedition now always offers a
--    friend pet, not just when a Defence-driven roll succeeds — the
--    zone's own admin-curated pet pool still decides WHICH pet, same
--    as before, just no longer gated behind a chance roll at all. The
--    player still separately chooses keep/release on claim
--    (claim_expedition_reward, unchanged) — this only guarantees one
--    is always offered.
--
-- 2. Every other number that used to be hardcoded inside start_
--    expedition/resolve_due_expeditions (trip duration range, loot
--    counts, double-haul chance, coin/XP formulas, the Speed/Strength/
--    Defence saturation curve) now reads from a new admin-editable
--    game_config table instead — see /admin/game-config. Values below
--    match exactly what was hardcoded before this migration, so this
--    is a pure refactor for everything except the friend guarantee.
create table public.game_config (
  key text primary key,
  value numeric not null,
  label text not null,
  description text not null,
  updated_at timestamptz not null default now()
);

alter table public.game_config enable row level security;

create policy "Admins can manage game config"
  on public.game_config for all
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

create trigger audit_game_config
  after insert or update or delete on public.game_config
  for each row execute function public.log_admin_action();

-- security definer so it reads fine from inside start_expedition/
-- resolve_due_expeditions regardless of the calling player's own RLS,
-- same reasoning as current_user_is_admin().
create function public.gc(p_key text)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select value from public.game_config where key = p_key;
$$;

insert into public.game_config (key, value, label, description) values
  ('stat_saturation_k', 30, 'Stat saturation curve',
   'How quickly Speed/Strength/Defence level off toward their max effect. Used as x / (x + this) — lower makes stats matter more at low values; higher means a pet needs much higher stats before they matter much.'),
  ('trip_duration_min_minutes', 60, 'Shortest possible trip',
   'The fastest a (non-first) trip can ever resolve, in minutes, even for a maxed-Speed pet.'),
  ('trip_duration_max_minutes', 180, 'Longest possible trip',
   'The slowest a trip can ever take, in minutes, for a pet with minimal Speed.'),
  ('trip_duration_speed_skew', 2, 'How much Speed shortens a trip',
   'Higher values make high-Speed pets'' trips skew noticeably shorter; 0 would make Speed have no effect on duration at all.'),
  ('first_trip_duration_minutes', 10, 'First-ever trip length',
   'Every player''s very first expedition always takes exactly this many minutes, regardless of Speed.'),
  ('loot_common_base', 3, 'Minimum common items per trip',
   'Every trip brings back at least this many common items, even at zero Strength/level.'),
  ('loot_common_scale', 12, 'Bonus common items at full power',
   'Added on top of the minimum as a maxed-out pet''s power approaches 1.0 — e.g. base 3 + scale 12 = up to 15 common items.'),
  ('loot_uncommon_scale', 10, 'Uncommon items at full power',
   'How many uncommon items a fully-powered trip can bring back (0 at zero power).'),
  ('loot_rare_scale', 2, 'Rare items at full power',
   'How many rare items a fully-powered trip can bring back — rare items scale with power squared, so this only ramps up noticeably at high power.'),
  ('double_haul_base_chance', 0.05, 'Double-haul base chance',
   'Baseline chance (0-1) any trip doubles its item haul, before Strength''s own bonus chance below. A double-reward-chance potion replaces this baseline for that trip.'),
  ('double_haul_strength_weight', 0.5, 'Double-haul Strength bonus',
   'Extra double-haul chance (0-1) added on top of the base chance, scaled by the pet''s Strength saturation — a maxed-Strength pet gets up to this much additional chance.'),
  ('coin_base_per_tier', 10, 'Coins per zone tier',
   'Guaranteed coins per trip = zone tier x this number, before the random bonus below.'),
  ('coin_random_range_per_tier', 10, 'Coin variance per zone tier',
   'An extra 0 to (zone tier x this number) coins, randomly, on top of the guaranteed amount.'),
  ('xp_base', 10, 'Base XP per trip',
   'XP granted per trip at zone tier 1, before the tier scaling below.'),
  ('xp_tier_scale', 0.5, 'XP bonus per zone tier',
   'Extra XP per trip for each zone tier above 1, as a fraction of the base — e.g. 0.5 means tier 3 grants base x (1 + 0.5x2) = double XP.')
on conflict (key) do nothing;

-- ── start_expedition: duration now reads game_config ─────────────────────
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
  v_zone_is_tutorial boolean;
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

-- ── resolve_due_expeditions: friend guaranteed, odds now tunable ────────
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
  v_zone_tier integer;
  v_coins integer;
  v_xp_gain integer;
  v_strength numeric;
  v_defence numeric;
  v_gs numeric;
  v_gd numeric;
  v_power numeric;
  v_common_count integer;
  v_uncommon_count integer;
  v_rare_count integer;
  v_pass integer;
  v_item_id uuid;
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
      select tier into v_zone_tier from public.zones where id = v_expedition.zone_id;
      v_zone_tier := greatest(1, coalesce(v_zone_tier, 1));

      v_strength := v_expedition.level * 2 * (v_expedition.roll_strength / 10.0);
      v_defence := v_expedition.level * 2 * (v_expedition.roll_defence / 10.0);
      v_gs := v_strength / (v_strength + v_sat_k);
      v_gd := v_defence / (v_defence + v_sat_k);

      v_power := (v_gs + v_expedition.level::numeric / 25) / 2;
      v_power := least(1.0, greatest(0.0, v_power * coalesce(v_expedition.item_find_bias, 1.0)));

      v_common_count := public.gc('loot_common_base')::int + round(v_power * public.gc('loot_common_scale'))::int;
      v_uncommon_count := round(v_power * public.gc('loot_uncommon_scale'))::int;
      v_rare_count := round(power(v_power, 2) * public.gc('loot_rare_scale'))::int;

      v_double_chance := coalesce(v_expedition.double_reward_chance, public.gc('double_haul_base_chance'));
      v_is_double := (random() < v_double_chance) or (random() < public.gc('double_haul_strength_weight') * v_gs);

      for v_pass in 1..(case when v_is_double then 2 else 1 end) loop
        for v_i in 1..v_common_count loop
          v_item_id := public.pick_weighted_zone_item(v_expedition.zone_id, 'common');
          if v_item_id is not null then
            insert into public.expedition_loot_items (expedition_id, item_id, quantity)
            values (v_expedition.id, v_item_id, 1)
            on conflict (expedition_id, item_id) do update
              set quantity = public.expedition_loot_items.quantity + 1;
          end if;
        end loop;
        for v_i in 1..v_uncommon_count loop
          v_item_id := public.pick_weighted_zone_item(v_expedition.zone_id, 'uncommon');
          if v_item_id is not null then
            insert into public.expedition_loot_items (expedition_id, item_id, quantity)
            values (v_expedition.id, v_item_id, 1)
            on conflict (expedition_id, item_id) do update
              set quantity = public.expedition_loot_items.quantity + 1;
          end if;
        end loop;
        for v_i in 1..v_rare_count loop
          v_item_id := public.pick_weighted_zone_item(v_expedition.zone_id, 'rare');
          if v_item_id is not null then
            insert into public.expedition_loot_items (expedition_id, item_id, quantity)
            values (v_expedition.id, v_item_id, 1)
            on conflict (expedition_id, item_id) do update
              set quantity = public.expedition_loot_items.quantity + 1;
          end if;
        end loop;
      end loop;

      -- Friend: no longer a chance roll at all — every completed trip
      -- always offers one (the player still separately chooses to keep
      -- or release it on claim). The zone's own admin-curated pet pool
      -- still decides WHICH pet.
      v_species_id := public.pick_weighted_zone_species(v_expedition.zone_id);

      v_coins := (v_zone_tier * public.gc('coin_base_per_tier'))::int
        + floor(random() * (v_zone_tier * public.gc('coin_random_range_per_tier') + 1))::int;
      v_xp_gain := (public.gc('xp_base') * (1 + public.gc('xp_tier_scale') * (v_zone_tier - 1)))::int;

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
