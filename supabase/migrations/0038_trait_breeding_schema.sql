-- Trait-based breeding system, part 1: the new catalog (breeds/colors/
-- patterns/eye_types), the redesigned `pets` table, and reworking every
-- existing system that assumed a pet resolves to one fixed species image
-- or that a zone could grant a pet at all. Breeding itself (the nest ->
-- egg -> hatch loop) is a separate migration (0039) — this one gets
-- expeditions/starter-grant/pets fully working end to end on the new
-- trait model first, matching the spec's own suggested build order.
--
-- Deliberate deviation from the spec doc's illustrative `alter table
-- pets ... drop column species_id, drop column color` snippet: this
-- migration does NOT drop species_id/color_variant. The same doc's own
-- rollout section is explicit that existing pets are grandfathered, not
-- retrofitted, and that dropping those columns is "the only genuinely
-- breaking change" and should happen "only after [breeding] is fully
-- live and verified" — a later cleanup migration, not this one. A pet
-- has exactly one identity system: `species_id is not null` (legacy,
-- pre-trait) xor `breed_id is not null` (new). Every new pet from this
-- migration forward uses breed_id; every already-issued pet keeps
-- displaying via species_id exactly as it does today.

-- ── Trait rarity: a separate, narrower enum from items/pets' rarity_tier ──
-- Flight-Rising-style "gene tiers" are common/uncommon/rare only — a
-- distinct concept from the 5-tier rarity_tier already used for
-- items/species/pets (common..legendary), not a subset of it, so this is
-- its own type rather than reusing rarity_tier.
create type public.trait_rarity as enum ('common', 'uncommon', 'rare');

create function public.trait_rarity_weight(p_tier public.trait_rarity)
returns integer
language sql
immutable
as $$
  select case p_tier
    when 'rare' then 1
    when 'uncommon' then 3
    else 10
  end;
$$;

comment on function public.trait_rarity_weight(public.trait_rarity) is
  'Relative drop weight for a wild/mutation trait roll (common ten times as likely as rare). Exact ratios are a starting point per the spec doc''s own open design questions, not a locked balance decision.';

-- ── Breeds (replaces species as the pet-identity table for new pets) ────
create table public.breeds (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  -- Drop weight for a future wild-breed roll. Nothing in this build rolls
  -- a breed weighted by this yet (starter pets use one fixed breed,
  -- breeding never changes breed_id in v1 — same-breed-only, see 0039) —
  -- kept because the spec calls for it and a later "random-breed egg"
  -- mechanic can read it with no further migration.
  rarity_weight integer not null default 1 check (rarity_weight > 0),
  base_layer_url text,
  mask_layer_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.breeds is
  'A pet body shape with no color baked in (see colors/patterns/eye_types) — the trait-system replacement for species. base_layer_url is the line art; mask_layer_url''s R/G/B channels mark the primary/secondary/tertiary colorable regions for the compositor (Section 3 of the spec doc).';

alter table public.breeds enable row level security;

create policy "Breeds are viewable by everyone"
  on public.breeds for select
  using (true);

create policy "Admins can insert breeds"
  on public.breeds for insert
  with check (public.current_user_is_admin());

create policy "Admins can update breeds"
  on public.breeds for update
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

create trigger audit_breeds
  after insert or update on public.breeds
  for each row execute function public.log_admin_action();

-- ── Colors (shared palette, not per-breed) ──────────────────────────────
create table public.colors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  hex_swatch text not null,
  rarity_tier public.trait_rarity not null default 'common',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.colors is
  'Breed-agnostic — one row can be used as any pet''s primary/secondary/tertiary color regardless of breed_id.';

alter table public.colors enable row level security;

create policy "Colors are viewable by everyone"
  on public.colors for select
  using (true);

create policy "Admins can insert colors"
  on public.colors for insert
  with check (public.current_user_is_admin());

create policy "Admins can update colors"
  on public.colors for update
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

create trigger audit_colors
  after insert or update on public.colors
  for each row execute function public.log_admin_action();

-- ── Patterns (breed-specific overlay layer — Flight Rising's "genes") ───
create table public.patterns (
  id uuid primary key default gen_random_uuid(),
  breed_id uuid not null references public.breeds (id) on delete cascade,
  name text not null,
  rarity_tier public.trait_rarity not null default 'common',
  layer_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.patterns is
  'Breed-specific (its overlay mask must match that breed''s proportions) — unlike colors.';

alter table public.patterns enable row level security;

create policy "Patterns are viewable by everyone"
  on public.patterns for select
  using (true);

create policy "Admins can insert patterns"
  on public.patterns for insert
  with check (public.current_user_is_admin());

create policy "Admins can update patterns"
  on public.patterns for update
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

create trigger audit_patterns
  after insert or update on public.patterns
  for each row execute function public.log_admin_action();

-- ── Eye types (breed-specific, same reasoning as patterns) ─────────────
create table public.eye_types (
  id uuid primary key default gen_random_uuid(),
  breed_id uuid not null references public.breeds (id) on delete cascade,
  name text not null,
  rarity_tier public.trait_rarity not null default 'common',
  layer_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.eye_types enable row level security;

create policy "Eye types are viewable by everyone"
  on public.eye_types for select
  using (true);

create policy "Admins can insert eye types"
  on public.eye_types for insert
  with check (public.current_user_is_admin());

create policy "Admins can update eye types"
  on public.eye_types for update
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

create trigger audit_eye_types
  after insert or update on public.eye_types
  for each row execute function public.log_admin_action();

-- ── Pets: trait FKs live directly on the row (not a join table) ────────
-- Every pet has exactly one of each trait (no multi-valued traits), which
-- keeps the compositing query a single-row read.
alter table public.pets
  alter column species_id drop not null,
  add column breed_id uuid references public.breeds (id),
  add column primary_color_id uuid references public.colors (id),
  add column secondary_color_id uuid references public.colors (id),
  add column tertiary_color_id uuid references public.colors (id),
  add column pattern_id uuid references public.patterns (id),
  add column eye_type_id uuid references public.eye_types (id),
  add column gender text check (gender is null or gender in ('male', 'female')),
  add column composited_image_url text,
  add column parent_a_id uuid references public.pets (id),
  add column parent_b_id uuid references public.pets (id),
  add constraint pets_legacy_xor_trait check (
    (species_id is not null and breed_id is null)
    or (species_id is null and breed_id is not null)
  );

comment on column public.pets.breed_id is
  'Null = legacy pet (pre-trait-system), displayed via species_id/species.image_url. Every pet created from this migration forward sets this instead of species_id — see pets_legacy_xor_trait.';
comment on column public.pets.composited_image_url is
  'Cache column, not a source of truth — computed server-side from the 5 trait FKs by src/lib/pet-compositor.ts and written back via set_pet_composited_image() once available. Null briefly between a trait-based pet''s creation and its first composite finishing.';
comment on column public.pets.parent_a_id is
  'Null for a wild/starter pet. Read-only after creation — set once by claim_egg (0039), never updated. Used for a future family-tree display and breeding-cooldown checks.';

-- Only ever written by security-definer RPCs (same as every other pets
-- column) — no client UPDATE policy needed for any of these.

-- A player-callable, narrowly-scoped write: composite_pets_missing_image()
-- (Next.js, using `sharp`) can't run inside Postgres, so the compositor
-- creates a trait-based pet with composited_image_url null via the normal
-- RPCs below, then calls this once the image is ready. Restricted to
-- filling in a still-null value on a pet the caller owns — never lets a
-- player overwrite an already-set image with an arbitrary URL.
create function public.set_pet_composited_image(p_user_id uuid, p_pet_id uuid, p_image_url text)
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
  set composited_image_url = p_image_url
  where id = p_pet_id and owner_id = p_user_id and composited_image_url is null;
end;
$$;

revoke all on function public.set_pet_composited_image(uuid, uuid, text) from public;
grant execute on function public.set_pet_composited_image(uuid, uuid, text) to authenticated;

-- ── Effective rarity: the rarest trait tier across the five slots ──────
create function public.effective_pet_rarity(
  p_primary_color_id uuid,
  p_secondary_color_id uuid,
  p_tertiary_color_id uuid,
  p_pattern_id uuid,
  p_eye_type_id uuid
)
returns public.rarity_tier
language sql
stable
as $$
  select case max(rank)
    when 3 then 'rare'
    when 2 then 'uncommon'
    else 'common'
  end::public.rarity_tier
  from (
    select case rarity_tier when 'rare' then 3 when 'uncommon' then 2 else 1 end as rank
    from public.colors
    where id in (p_primary_color_id, p_secondary_color_id, p_tertiary_color_id)
    union all
    select case rarity_tier when 'rare' then 3 when 'uncommon' then 2 else 1 end
    from public.patterns where id = p_pattern_id
    union all
    select case rarity_tier when 'rare' then 3 when 'uncommon' then 2 else 1 end
    from public.eye_types where id = p_eye_type_id
  ) ranks;
$$;

-- ── Wild trait rolls: per-slot (reused by breeding mutation, 0039) and
-- all-five-at-once (admin "preview a random pet" button) ───────────────
create function public.roll_wild_color()
returns uuid
language sql
as $$
  select id from public.colors
  where is_active
  order by power(random(), 1.0 / public.trait_rarity_weight(rarity_tier)) desc
  limit 1;
$$;

create function public.roll_wild_pattern(p_breed_id uuid)
returns uuid
language sql
as $$
  select id from public.patterns
  where is_active and breed_id = p_breed_id
  order by power(random(), 1.0 / public.trait_rarity_weight(rarity_tier)) desc
  limit 1;
$$;

create function public.roll_wild_eye_type(p_breed_id uuid)
returns uuid
language sql
as $$
  select id from public.eye_types
  where is_active and breed_id = p_breed_id
  order by power(random(), 1.0 / public.trait_rarity_weight(rarity_tier)) desc
  limit 1;
$$;

create function public.roll_wild_traits(p_breed_id uuid)
returns table (
  primary_color_id uuid,
  secondary_color_id uuid,
  tertiary_color_id uuid,
  pattern_id uuid,
  eye_type_id uuid
)
language sql
as $$
  select
    public.roll_wild_color(),
    public.roll_wild_color(),
    public.roll_wild_color(),
    public.roll_wild_pattern(p_breed_id),
    public.roll_wild_eye_type(p_breed_id);
$$;

grant execute on function public.roll_wild_color() to authenticated;
grant execute on function public.roll_wild_pattern(uuid) to authenticated;
grant execute on function public.roll_wild_eye_type(uuid) to authenticated;
grant execute on function public.roll_wild_traits(uuid) to authenticated;

-- ── Zones no longer grant pets — drop zone_pet_pool entirely ────────────
drop function public.pick_weighted_zone_species(uuid);
drop table public.zone_pet_pool;

-- ── Item rolls: plain weighted draw over zone_loot_table, with an
-- optional rarity bias (feeds rarity_boost potions, below) ─────────────
-- Return type changes (table -> uuid, since there's no more reward_kind
-- to report), so this needs DROP + CREATE, same as claim_expedition_reward
-- did in 0011 for its own return-type change.
drop function public.pick_weighted_zone_reward(uuid, numeric);

create function public.pick_weighted_zone_reward(p_zone_id uuid, p_rarity_bias numeric default 1.0)
returns uuid -- item_id, or null if the zone's loot table is empty
language sql
as $$
  select zlt.item_id
  from public.zone_loot_table zlt
  join public.items i on i.id = zlt.item_id
  where zlt.zone_id = p_zone_id
  order by power(
    random(),
    1.0 / (zlt.drop_weight * (case when i.rarity in ('uncommon', 'rare') then p_rarity_bias else 1.0 end))
  ) desc
  limit 1;
$$;

revoke all on function public.pick_weighted_zone_reward(uuid, numeric) from public;

-- ── Expeditions: rarity_bias replaces item_find_bias's role ─────────────
-- item_find_bias (0011) biased a pet-vs-item split that no longer exists
-- — retired in place (column kept, always null going forward, per this
-- project's habit of not dropping columns without a strong reason) rather
-- than dropped. rarity_bias is the new, analogous column a rarity_boost
-- potion writes instead.
comment on column public.expeditions.item_find_bias is
  'Retired — zones no longer grant pets, so there''s no pet-vs-item axis left to bias. Always null from this migration forward; see rarity_bias for what replaced it.';
alter table public.expeditions add column rarity_bias numeric;
comment on column public.expeditions.rarity_bias is
  'Multiplier applied to uncommon/rare item weights in the resolve-time roll, from a rarity_boost potion used at start. Null = no bias (1.0). Replaces item_find_bias.';

-- ── start_expedition: rarity_boost replaces item_find_boost ─────────────
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
  v_rarity_bias numeric;
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
    elsif v_effect_type = 'rarity_boost' then
      v_rarity_bias := v_effect_magnitude;
    elsif v_effect_type = 'double_reward_chance' then
      v_double_chance := v_effect_magnitude;
    end if;
    -- item_find_boost: recognized and consumed if somehow still held, but
    -- retired — no effect applied (see the item_find_bias comment above).
  end if;

  insert into public.expeditions
    (user_id, pet_id, zone_id, status, is_tutorial, started_at, resolves_at, rarity_bias, double_reward_chance)
  values
    (p_user_id, p_pet_id, p_zone_id, 'in_progress', false, now(), now() + make_interval(secs => v_duration_seconds), v_rarity_bias, v_double_chance)
  returning id into v_expedition_id;

  return v_expedition_id;
end;
$$;

-- ── resolve_due_expeditions: item-only for non-tutorial; tutorial branch
-- now grants a second FIXED-trait starter pet instead of a zone roll ───
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
  v_new_pet_id uuid;
  v_item_id uuid;
  v_is_double boolean;
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized.';
  end if;

  for v_expedition in
    select id, zone_id, is_tutorial, rarity_bias, double_reward_chance
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

      -- Second starter pet: same fixed, hand-picked combo idea as the
      -- first (grant_starter_pet_and_tutorial, 0038) — same breed
      -- (breedable together), opposite gender, granted automatically
      -- when this tutorial expedition's timer elapses (same timing this
      -- already worked this way before trait pets existed).
      if v_pet_count < v_den_size then
        insert into public.pets (
          owner_id, rarity, breed_id, primary_color_id, secondary_color_id, pattern_id, eye_type_id, gender
        ) values (
          p_user_id, 'common',
          '00000000-0000-0000-0000-000000001001',
          '00000000-0000-0000-0000-000000002002',
          '00000000-0000-0000-0000-000000002003',
          '00000000-0000-0000-0000-000000003001',
          '00000000-0000-0000-0000-000000004001',
          'male'
        )
        returning id into v_new_pet_id;
      end if;

      update public.expeditions
      set status = 'completed', result_pet_id = v_new_pet_id
      where id = v_expedition.id;
    else
      v_item_id := public.pick_weighted_zone_reward(v_expedition.zone_id, coalesce(v_expedition.rarity_bias, 1.0));
      v_is_double := random() < coalesce(v_expedition.double_reward_chance, 0.05);

      update public.expeditions
      set status = 'awaiting_claim', pending_item_id = v_item_id, is_double_reward = v_is_double
      where id = v_expedition.id;
    end if;
  end loop;
end;
$$;

-- ── claim_expedition_reward: item-only now (no pet branch left) ────────
drop function public.claim_expedition_reward(uuid, uuid, boolean);

create function public.claim_expedition_reward(
  p_user_id uuid,
  p_expedition_id uuid,
  p_keep boolean
)
returns jsonb -- {"bonus_kind"?: "item", "bonus_name"?: text, "bonus_image_url"?: text}
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pending_item_id uuid;
  v_zone_id uuid;
  v_is_double boolean;
  v_rarity_bias numeric;
  v_kept_item_id uuid;
  v_bonus_item_id uuid;
  v_bonus_name text;
  v_bonus_image_url text;
  v_result jsonb;
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized.';
  end if;

  select pending_item_id, zone_id, is_double_reward, rarity_bias
  into v_pending_item_id, v_zone_id, v_is_double, v_rarity_bias
  from public.expeditions
  where id = p_expedition_id and user_id = p_user_id and status = 'awaiting_claim'
  for update;

  if not found then
    raise exception 'No reward waiting to be claimed for this expedition.';
  end if;

  if p_keep and v_pending_item_id is not null then
    insert into public.user_inventory (user_id, item_id, quantity)
    values (p_user_id, v_pending_item_id, 1)
    on conflict (user_id, item_id) do update
      set quantity = public.user_inventory.quantity + 1;

    v_kept_item_id := v_pending_item_id;
  end if;

  if p_keep and v_is_double then
    v_bonus_item_id := public.pick_weighted_zone_reward(v_zone_id, coalesce(v_rarity_bias, 1.0));

    if v_bonus_item_id is not null then
      insert into public.user_inventory (user_id, item_id, quantity)
      values (p_user_id, v_bonus_item_id, 1)
      on conflict (user_id, item_id) do update
        set quantity = public.user_inventory.quantity + 1;

      select name, image_url into v_bonus_name, v_bonus_image_url
      from public.items where id = v_bonus_item_id;
    end if;
  end if;

  update public.expeditions
  set status = 'completed', result_item_id = v_kept_item_id
  where id = p_expedition_id;

  v_result := '{}'::jsonb;
  if v_bonus_item_id is not null then
    v_result := jsonb_build_object('bonus_kind', 'item', 'bonus_name', v_bonus_name, 'bonus_image_url', v_bonus_image_url);
  end if;

  return v_result;
end;
$$;

revoke all on function public.claim_expedition_reward(uuid, uuid, boolean) from public;
grant execute on function public.claim_expedition_reward(uuid, uuid, boolean) to authenticated;

-- ── Starter grant: two fixed, hand-picked trait combos instead of a
-- pool roll — the first instantly, the second when the tutorial
-- expedition it starts resolves (unchanged timing, see above) ─────────
create or replace function public.grant_starter_pet_and_tutorial(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutorial_zone_id uuid;
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

  insert into public.pets (
    owner_id, rarity, breed_id, primary_color_id, secondary_color_id, pattern_id, eye_type_id, gender
  ) values (
    p_user_id, 'common',
    '00000000-0000-0000-0000-000000001001',
    '00000000-0000-0000-0000-000000002001',
    '00000000-0000-0000-0000-000000002003',
    '00000000-0000-0000-0000-000000003001',
    '00000000-0000-0000-0000-000000004001',
    'female'
  )
  returning id into v_pet_id;

  insert into public.expeditions
    (user_id, pet_id, zone_id, status, is_tutorial, started_at, resolves_at)
  values
    (p_user_id, v_pet_id, v_tutorial_zone_id, 'in_progress', true, now(), now() + interval '10 minutes');
end;
$$;

-- ── Retire item_find_boost in place: repurpose the one recipe using it
-- rather than leaving orphaned catalog content around ──────────────────
update public.potion_recipes
set effect_type = 'rarity_boost', effect_magnitude = 3.0
where effect_type = 'item_find_boost';

-- ── Seed data: one starter breed + its trait catalog ────────────────────
insert into public.breeds (id, name, description, rarity_weight, base_layer_url, mask_layer_url) values
  (
    '00000000-0000-0000-0000-000000001001',
    'Fernback',
    'The first breed — every starter pet is one of these. Placeholder line art/mask until real assets land in game-assets/breeds/.',
    1,
    'https://placehold.co/600x600/854d0e/FFFFFF/png?text=Fernback+Base',
    'https://placehold.co/600x600/854d0e/FFFFFF/png?text=Fernback+Mask'
  );

insert into public.colors (id, name, hex_swatch, rarity_tier) values
  ('00000000-0000-0000-0000-000000002001', 'Moss Green', '#4d7c0f', 'common'),
  ('00000000-0000-0000-0000-000000002002', 'Ember Orange', '#c2410c', 'common'),
  ('00000000-0000-0000-0000-000000002003', 'Cloud White', '#f5f5f4', 'common'),
  ('00000000-0000-0000-0000-000000002004', 'Sky Blue', '#0284c7', 'uncommon'),
  ('00000000-0000-0000-0000-000000002005', 'Starlight Violet', '#7e22ce', 'rare');

insert into public.patterns (id, breed_id, name, rarity_tier, layer_url) values
  (
    '00000000-0000-0000-0000-000000003001', '00000000-0000-0000-0000-000000001001',
    'Speckled', 'common', 'https://placehold.co/600x600/00000000/854d0e/png?text=Speckled'
  ),
  (
    '00000000-0000-0000-0000-000000003002', '00000000-0000-0000-0000-000000001001',
    'Starlit', 'rare', 'https://placehold.co/600x600/00000000/7e22ce/png?text=Starlit'
  );

insert into public.eye_types (id, breed_id, name, rarity_tier, layer_url) values
  (
    '00000000-0000-0000-0000-000000004001', '00000000-0000-0000-0000-000000001001',
    'Round', 'common', 'https://placehold.co/600x600/00000000/1c1917/png?text=Round+Eyes'
  ),
  (
    '00000000-0000-0000-0000-000000004002', '00000000-0000-0000-0000-000000001001',
    'Slit', 'uncommon', 'https://placehold.co/600x600/00000000/1c1917/png?text=Slit+Eyes'
  );
