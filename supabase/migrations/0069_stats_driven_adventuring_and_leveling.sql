-- Stats-driven adventuring + real pet leveling, per the player's
-- "furgarden-stats-handoff.md" design (prototyped in a standalone
-- simulator first) plus the follow-up decisions made with the player
-- directly:
--
-- * Pets now actually level up (nothing did this before) by earning XP
--   per completed trip. Capped at level 25, tuned so an average pet
--   (every roll 5.5) reaches it in about 10 days of play at the zone's
--   easiest tier, 8 check-ins/day.
-- * Trip duration moves from a flat 2-3 minutes to 1-3 hours, shaped by
--   Speed (higher Speed skews toward the short end; never changes the
--   3-hour ceiling).
-- * Strength (blended with overall level, per the player's own call)
--   now drives how much loot a trip brings home: 3 items (all common)
--   at the low end, up to 15 common + 10 uncommon + 2 rare (27 total)
--   at the high end — doubled on a "double haul" (Strength's own
--   chance, ORed with the existing double_reward_chance potion, which
--   still replaces the long-standing 5% baseline chance when used,
--   exactly as before this migration).
-- * Defence now drives whether a trip brings home a new pet at all (a
--   "friend") — per the player's call, the zone's own admin-curated pet
--   pool is UNCHANGED and still decides which species; Defence only
--   decides whether that roll happens this trip.
-- * Zone pet pools, coins formula, birth rolls, energy/eligibility
--   rules, and potions are otherwise untouched, per the design doc.
--
-- A trip's reward is no longer "one single thing" (today's single
-- pending_species_id/pending_item_id slot) — it's now a bundle: 0-54
-- items (public.expedition_loot_items, new), optionally one friend
-- (pending_species_id, unchanged column), and coins/XP (unchanged
-- coins_reward column, new xp_reward column). Items/coins/XP are
-- credited the moment the trip resolves (same as coins always were) —
-- only the optional friend still needs the player's own keep-or-release
-- decision (den capacity is a real constraint; items/coins/XP never
-- were). The claim/reveal screen still exists for every non-tutorial
-- trip so there's always a "here's what you got" moment, matching this
-- project's "no setback — a trip never ends in nothing" design goal.
--
-- Every constant here (K=30, the Speed k-exponent of 2, the loot curve
-- shape, the friend-chance numbers, xpBase, the duration-reduction
-- potion's new 10-minute floor) is explicitly a placeholder per the
-- design doc — easy to retune in a later migration, none of it is a
-- load-bearing architectural choice.

-- ── Pet leveling ─────────────────────────────────────────────────────
alter table public.pets add column xp bigint not null default 0 check (xp >= 0);

comment on column public.pets.xp is
  'Total lifetime XP, earned only from resolve_due_expeditions (10 x (1 + 0.5 x (zone tier - 1)) per non-tutorial trip). Drives level via level_for_xp()/set_pet_level_from_xp() below — level is kept in sync automatically, never set directly.';

-- XP to go from level L to L+1 = xpBase x L^0.6, capped at level 25.
-- xpBase solved (2026-11-06, with the player) so an average pet (every
-- roll 5.5, so Strength/Defence/Speed all mid-saturated) reaches level
-- 25 in ~10 days of continuous play on a tier-1 zone at 8 trips/day —
-- see furgarden-stats-handoff.md for the full worked numbers.
create function public.level_for_xp(p_xp bigint)
returns integer
language plpgsql
immutable
as $$
declare
  v_xp_base constant numeric := 7.6789244325870625;
  v_max_level constant integer := 25;
  v_level integer := 1;
  v_cumulative numeric := 0;
  v_next numeric;
begin
  while v_level < v_max_level loop
    v_next := v_xp_base * power(v_level, 0.6);
    if v_cumulative + v_next > p_xp then
      exit;
    end if;
    v_cumulative := v_cumulative + v_next;
    v_level := v_level + 1;
  end loop;
  return v_level;
end;
$$;

create function public.set_pet_level_from_xp()
returns trigger
language plpgsql
as $$
begin
  new.level := public.level_for_xp(new.xp);
  return new;
end;
$$;

create trigger pet_level_from_xp
before insert or update of xp on public.pets
for each row execute function public.set_pet_level_from_xp();

alter table public.pets drop constraint if exists pets_level_check;
alter table public.pets add constraint pets_level_check check (level between 1 and 25);

comment on column public.pets.level is
  'Derived automatically from xp by the pet_level_from_xp trigger — never set directly. Capped at 25. Stats are still Level x Rate x (Roll / 10); see src/lib/pet-combat.ts.';

-- ── Shared stat-effect curve ─────────────────────────────────────────
-- Every stat effect below (duration, loot, friend chance) runs its raw
-- stat value through this same saturating curve: g(x) = x / (x + K).
-- K=30 is a placeholder — a stat of 30 gives half the maximum effect; a
-- level-25, roll-10 pet has a stat of 50, g ~= 0.625.
create function public.stat_saturation(p_stat numeric)
returns numeric
language sql
immutable
as $$
  select p_stat / (p_stat + 30);
$$;

-- ── Multi-item loot (replaces the old single pending_item_id slot) ──
create table public.expedition_loot_items (
  id uuid primary key default gen_random_uuid(),
  expedition_id uuid not null references public.expeditions (id) on delete cascade,
  item_id uuid not null references public.items (id),
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now(),
  unique (expedition_id, item_id)
);

create index expedition_loot_items_expedition_id_idx on public.expedition_loot_items (expedition_id);

alter table public.expedition_loot_items enable row level security;

create policy "Users can view their own expedition loot"
  on public.expedition_loot_items for select
  using (
    exists (
      select 1 from public.expeditions e
      where e.id = expedition_id and e.user_id = auth.uid()
    )
  );

-- No insert/update/delete policy: written only by resolve_due_expeditions
-- below (security definer), same pattern as every other expedition
-- reward field.

-- Weighted item pick within one rarity tier of a zone's existing loot
-- table — same algorithm as pick_weighted_zone_species/
-- pick_weighted_zone_reward (power(random(), 1/drop_weight), highest
-- wins). Null (not an error) when the zone has nothing of that rarity,
-- same "silently inserts nothing" tolerance 0059's loot seeding used.
create function public.pick_weighted_zone_item(p_zone_id uuid, p_rarity public.rarity_tier)
returns uuid
language sql
stable
as $$
  select zlt.item_id
  from public.zone_loot_table zlt
  join public.items i on i.id = zlt.item_id
  where zlt.zone_id = p_zone_id and i.rarity = p_rarity
  order by power(random(), 1.0 / zlt.drop_weight) desc
  limit 1;
$$;

revoke all on function public.pick_weighted_zone_item(uuid, public.rarity_tier) from public;

-- ── expeditions: drop the old single-item slots, add xp_reward ──────
alter table public.expeditions drop column if exists pending_item_id;
alter table public.expeditions drop column if exists result_item_id;
alter table public.expeditions add column xp_reward integer not null default 0;

comment on column public.expeditions.xp_reward is
  'XP this trip granted its pet (already applied to pets.xp at resolve time) — stored here only so the reveal screen can show it without recomputing the formula.';

-- ── start_expedition: duration now Speed-driven, 1-3 hours ──────────
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

  -- Speed-driven duration: 60-180 minutes, k = 1 + 2*gp (placeholder) —
  -- higher Speed skews the roll toward the short end without ever
  -- raising the 3-hour ceiling.
  v_speed := v_level * 2 * (v_roll_speed / 10.0);
  v_gp := public.stat_saturation(v_speed);
  v_k := 1 + 2 * v_gp;
  v_u := power(random(), v_k);
  v_duration_minutes := 60 + (180 - 60) * v_u;
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
      -- 10-minute floor (was 30 seconds, back when trips were 2-3
      -- minutes) — scaled up for the new 1-3 hour range.
      v_duration_seconds := greatest(600, round(v_duration_seconds * (1 - v_effect_magnitude))::int);
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

-- ── resolve_due_expeditions: Strength/level loot, Defence friend
-- chance, XP grant ────────────────────────────────────────────────────
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
  v_friend_chance numeric;
  v_common_count integer;
  v_uncommon_count integer;
  v_rare_count integer;
  v_pass integer;
  v_item_id uuid;
  v_i integer;
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized.';
  end if;

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

      -- Strength/Defence as they stand right now — this pet can't have
      -- levelled up mid-trip (it's been busy the whole time, and XP
      -- only comes from a trip's own resolve, below).
      v_strength := v_expedition.level * 2 * (v_expedition.roll_strength / 10.0);
      v_defence := v_expedition.level * 2 * (v_expedition.roll_defence / 10.0);
      v_gs := public.stat_saturation(v_strength);
      v_gd := public.stat_saturation(v_defence);

      -- "Power" blends Strength's saturation with overall level
      -- progress (0-1 each) per the player's "Strength and pet level
      -- combined" call. An item_find_boost potion (v_item_bias, the
      -- recipe's own effect_magnitude, e.g. 2.0) temporarily multiplies
      -- it for this trip only — its old role (biasing the since-retired
      -- single pet-or-item roll) no longer exists.
      v_power := (v_gs + v_expedition.level::numeric / 25) / 2;
      v_power := least(1.0, greatest(0.0, v_power * coalesce(v_expedition.item_find_bias, 1.0)));

      -- 3 items (all common) at power 0, up to 15 common + 10 uncommon +
      -- 2 rare (27 total) at power 1 — rare stays at 0 until power is
      -- fairly high (squared term). All placeholders, tune freely.
      v_common_count := 3 + round(v_power * 12)::int;
      v_uncommon_count := round(v_power * 10)::int;
      v_rare_count := round(power(v_power, 2) * 2)::int;

      -- Double haul: Strength's own chance (P = 0.5 x gs) ORed with the
      -- existing double_reward_chance potion's chance — a potion, when
      -- used, still REPLACES the long-standing 5% baseline exactly as
      -- it did before this migration, just now also ORed with
      -- Strength's own roll.
      v_double_chance := coalesce(v_expedition.double_reward_chance, 0.05);
      v_is_double := (random() < v_double_chance) or (random() < 0.5 * v_gs);

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

      -- Friend: Defence decides whether one shows up at all; the zone's
      -- own admin-curated pet pool (unchanged) still decides which pet.
      v_friend_chance := 0.18 + 0.12 * v_gd;
      if random() < v_friend_chance then
        v_species_id := public.pick_weighted_zone_species(v_expedition.zone_id);
      else
        v_species_id := null;
      end if;

      v_coins := v_zone_tier * 10 + floor(random() * (v_zone_tier * 10 + 1))::int;
      v_xp_gain := (10 * (1 + 0.5 * (v_zone_tier - 1)))::int;

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

-- ── claim_expedition_reward: only the friend still needs a decision —
-- items/coins/XP are already granted by resolve_due_expeditions above,
-- same way coins always worked ──────────────────────────────────────
create or replace function public.claim_expedition_reward(
  p_user_id uuid,
  p_expedition_id uuid,
  p_keep boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pending_species_id uuid;
  v_den_size integer;
  v_pet_count integer;
  v_new_pet_id uuid;
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized.';
  end if;

  select pending_species_id into v_pending_species_id
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

    insert into public.pets (owner_id, species_id)
    values (p_user_id, v_pending_species_id)
    returning id into v_new_pet_id;
  end if;

  update public.expeditions
  set status = 'completed', result_pet_id = v_new_pet_id
  where id = p_expedition_id;

  return jsonb_build_object('granted_pet_id', v_new_pet_id);
end;
$$;
