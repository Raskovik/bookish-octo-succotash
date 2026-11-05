-- Reworks how pets are catalogued, per the player's own design:
--
-- 1. "Species" now means the breed/lineart (Cat, Dog, …) — a new, small
--    managed list (breeds). What this app has called `species` all
--    along (one row per named variant, e.g. what used to display as
--    "Green Cat (Mini)") is what the player calls a MODEL — kept as the
--    `species` table/`species_id` FK everywhere (renaming that across
--    every call site is its own, much larger, not-requested change),
--    but it now belongs to a breed via the new `breed_id` column.
--
-- 2. Every model gets a model_number: a sequential catalog number
--    (like a toy mold number) that's global across every breed and
--    never resets back to 1 for a new breed — pet 103 is always the
--    same model (say, a blue cat) regardless of what pet 104 turns out
--    to be. Admin-assigned automatically (nextval), not hand-typed.
--    Nullable — reserved for a future "Custom" pet model that has no
--    catalog number at all.
--
-- 3. species.name is no longer admin-typed. It's derived straight from
--    model_number (stringified, or "Custom" when there isn't one) by
--    a trigger, so every existing call site that already reads
--    species.name / pet_species_name keeps working completely
--    unchanged — it just displays "102" instead of "Green Cat (Mini)"
--    now, matching "the name I give the pet should be the model
--    number."
--
-- 4. Pet rarity is dropped entirely — species.rarity, pets.rarity, and
--    marketplace_listings.pet_rarity all go away, along with every
--    function that read or wrote them. Item rarity (rarity_tier on
--    items) is untouched; the enum type itself stays for that.

-- ── Breeds ────────────────────────────────────────────────────────────
-- 0042_remove_traits_and_breeding.sql already tried to drop patterns,
-- eye_types, colors, and breeds (in that order, for their FK chain) as
-- part of retiring the old trait/mold-based breeding system — but per
-- this project's track record of migrations not always fully applying
-- live, at least the old `breeds` table (id, name, description,
-- rarity_weight — one seed row, "Fernback") survived on this database.
-- Finish that cleanup here before creating the real thing: a small
-- managed list of lineart groups (Cat, Dog, …), unrelated to the old
-- trait system's breeds.
drop table if exists public.patterns cascade;
drop table if exists public.eye_types cascade;
drop table if exists public.colors cascade;
drop table if exists public.breeds cascade;

create table public.breeds (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

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

-- No delete policy, same reasoning as species/items: models already
-- reference a breed, so there's nothing safe to delete into.

create trigger audit_breeds
  after insert or update on public.breeds
  for each row execute function public.log_admin_action();

-- Every existing model needs SOME breed before breed_id can be required
-- going forward — admin reassigns each one's real breed afterward via
-- /admin/species.
insert into public.breeds (name) values ('Unsorted');

alter table public.species add column breed_id uuid references public.breeds (id);
update public.species set breed_id = (select id from public.breeds where name = 'Unsorted');
alter table public.species alter column breed_id set not null;

-- ── Model numbers ─────────────────────────────────────────────────────
create sequence public.species_model_number_seq;

alter table public.species add column model_number bigint;

with ordered as (
  select id, row_number() over (order by created_at, id) as rn
  from public.species
)
update public.species
set model_number = ordered.rn, name = ordered.rn::text
from ordered
where ordered.id = species.id;

select setval(
  'public.species_model_number_seq',
  coalesce((select max(model_number) from public.species), 0) + 1,
  false
);

alter table public.species
  alter column model_number set default nextval('public.species_model_number_seq');

alter sequence public.species_model_number_seq owned by public.species.model_number;

-- A plain unique index already allows any number of NULL rows (NULL is
-- never equal to NULL), so this doesn't need a partial/where clause to
-- permit multiple future "Custom" models.
create unique index species_model_number_unique_idx on public.species (model_number);

comment on column public.species.model_number is
  'Sequential catalog number shared by every individual pet of this model (like a toy mold number) — global across every breed, auto-assigned, never hand-typed. Null is reserved for a future "Custom" model with no number. species.name is kept in sync with this by set_species_name_from_model_number() below.';

comment on column public.species.breed_id is
  'The lineart/animal group this model belongs to (what players call "species") — see public.breeds. Not the same thing as the species table itself, which is a model/variant within a breed.';

create function public.set_species_name_from_model_number()
returns trigger
language plpgsql
as $$
begin
  if new.model_number is null then
    new.name := 'Custom';
  else
    new.name := new.model_number::text;
  end if;
  return new;
end;
$$;

create trigger species_name_from_model_number
before insert or update of model_number on public.species
for each row execute function public.set_species_name_from_model_number();

-- ── Drop pet rarity entirely ────────────────────────────────────────────
-- rarity_tier itself stays — items still use it.
alter table public.pets drop column rarity;
alter table public.species drop column rarity;
alter table public.marketplace_listings drop column pet_rarity;

-- ── Every function that read/wrote one of the dropped columns ──────────

-- create_pet_listing (0066's signature: p_seller_id, p_pet_id,
-- p_price_coins, p_price_gems) — drops v_rarity and pet_rarity.
create or replace function public.create_pet_listing(
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

  select s.name, s.image_url, p.custom_name
  into v_species_name, v_species_image_url, v_custom_name
  from public.pets p
  join public.species s on s.id = p.species_id
  where p.id = p_pet_id and p.owner_id = p_seller_id;

  if not found then
    raise exception 'Pet not found.';
  end if;

  insert into public.marketplace_listings (
    seller_id, listing_type, price_coins, price_gems, expires_at,
    pet_id, pet_species_name, pet_species_image_url, pet_custom_name
  )
  values (
    p_seller_id, 'pet', p_price_coins, p_price_gems, now() + interval '7 days',
    p_pet_id, v_species_name, v_species_image_url, v_custom_name
  )
  returning id into v_listing_id;

  return v_listing_id;
end;
$$;

-- resolve_due_expeditions (0058's version) — drops v_species_rarity.
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
  v_new_pet_id uuid;
  v_item_bias numeric;
  v_double_chance numeric;
  v_is_double boolean;
  v_zone_tier integer;
  v_coins integer;
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
          insert into public.pets (owner_id, species_id)
          values (p_user_id, v_species_id)
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

      select tier into v_zone_tier from public.zones where id = v_expedition.zone_id;
      v_zone_tier := greatest(1, coalesce(v_zone_tier, 1));
      v_coins := v_zone_tier * 10 + floor(random() * (v_zone_tier * 10 + 1))::int;

      perform public.begin_trusted_user_write();
      update public.users set coin_balance = coin_balance + v_coins where id = p_user_id;

      update public.expeditions
      set status = 'awaiting_claim',
        pending_species_id = v_species_id,
        pending_item_id = v_item_id,
        is_double_reward = v_is_double,
        coins_reward = v_coins
      where id = v_expedition.id;
    end if;
  end loop;
end;
$$;

-- claim_expedition_reward (0042's version) — drops v_species_rarity/
-- v_bonus_rarity.
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
  v_pending_item_id uuid;
  v_zone_id uuid;
  v_is_double boolean;
  v_item_bias numeric;
  v_den_size integer;
  v_pet_count integer;
  v_new_pet_id uuid;
  v_kept_item_id uuid;
  v_bonus_kind text;
  v_bonus_species_id uuid;
  v_bonus_item_id uuid;
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

    insert into public.pets (owner_id, species_id)
    values (p_user_id, v_pending_species_id)
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
        insert into public.pets (owner_id, species_id) values (p_user_id, v_bonus_species_id);
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

-- grant_starter_pet_and_tutorial (0042's version) — drops v_species_rarity.
create or replace function public.grant_starter_pet_and_tutorial(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutorial_zone_id uuid;
  v_species_id uuid;
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

  insert into public.pets (owner_id, species_id)
  values (p_user_id, v_species_id)
  returning id into v_pet_id;

  insert into public.expeditions
    (user_id, pet_id, zone_id, status, is_tutorial, started_at, resolves_at)
  values
    (p_user_id, v_pet_id, v_tutorial_zone_id, 'in_progress', true, now(), now() + interval '10 minutes');
end;
$$;

-- buy_shop_listing (0053's version) — drops v_species_rarity.
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
