-- Food points: a real per-player resource (same shape as coin_balance/
-- gem_balance), earned by converting owned items into it (/items'
-- "Food points" action, per furgarden-items-package.zip) and spent by
-- feed_pet() (both /pets and /pets/[petId]'s Feed buttons — previously
-- free, see 0046_pet_energy.sql's own comment anticipating this: "easy
-- to layer a cost on top of feed_pet() later without changing its
-- shape"). Feed cost scales with how much energy is actually missing,
-- at a de-emphasized rate (max 10 points for a 0%-to-100% feed, not
-- 100) — a player's own choice when asked.
--
-- Also adds items.description — the /items detail panel shows one and
-- items had no description column (same gap shop_listings hit for the
-- same reason, 0053_shop_listings.sql).
alter table public.items
  add column description text,
  add column food_value integer check (food_value is null or food_value >= 0);

comment on column public.items.food_value is
  'Food points gained per unit converted via convert_items_to_food(). Null/0 = this item cannot be converted.';

alter table public.users
  add column food_points integer not null default 0 check (food_points >= 0);

-- Redefine (not re-create: the trigger from 0001 already points at this
-- function by name) to also guard food_points, same privileged-column
-- list as every balance/capacity column before it.
create or replace function public.protect_privileged_user_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role'
     and coalesce(current_setting('app.trusted_user_write', true), 'false') <> 'true' then
    new.is_admin := old.is_admin;
    new.coin_balance := old.coin_balance;
    new.gem_balance := old.gem_balance;
    new.den_size := old.den_size;
    new.garden_rows := old.garden_rows;
    new.google_sub := old.google_sub;
    new.email := old.email;
    new.starter_granted := old.starter_granted;
    new.food_points := old.food_points;
  end if;
  return new;
end;
$$;

-- ── Converting items into food points ───────────────────────────────
create function public.convert_items_to_food(p_user_id uuid, p_item_id uuid, p_amount integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_food_value integer;
  v_quantity integer;
  v_gained integer;
  v_new_quantity integer;
  v_new_balance integer;
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized';
  end if;

  if p_amount < 1 then
    raise exception 'Amount must be at least 1.';
  end if;

  select food_value into v_food_value from public.items where id = p_item_id and is_active;
  if not found or v_food_value is null or v_food_value <= 0 then
    raise exception 'This item can''t be turned into food points.';
  end if;

  select quantity into v_quantity
  from public.user_inventory
  where user_id = p_user_id and item_id = p_item_id
  for update;

  if v_quantity is null or v_quantity < p_amount then
    raise exception 'You don''t own that many.';
  end if;

  v_gained := v_food_value * p_amount;

  update public.user_inventory
  set quantity = quantity - p_amount
  where user_id = p_user_id and item_id = p_item_id
  returning quantity into v_new_quantity;

  perform public.begin_trusted_user_write();
  update public.users
  set food_points = food_points + v_gained
  where id = p_user_id
  returning food_points into v_new_balance;

  return jsonb_build_object(
    'item_id', p_item_id,
    'used', p_amount,
    'gained', v_gained,
    'new_quantity', v_new_quantity,
    'new_food_points', v_new_balance
  );
end;
$$;

revoke all on function public.convert_items_to_food(uuid, uuid, integer) from public;
grant execute on function public.convert_items_to_food(uuid, uuid, integer) to authenticated;

-- ── feed_pet: now costs food points ──────────────────────────────────
-- Return type changes (void -> jsonb, so the client can show the new
-- balance without a refetch), which `create or replace` can't do for
-- an existing function — drop and recreate instead. Same (p_user_id,
-- p_pet_id) argument signature, so every existing caller still works
-- unchanged (none of them read the previously-void return value).
drop function public.feed_pet(uuid, uuid);

create function public.feed_pet(p_user_id uuid, p_pet_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last_fed_at timestamptz;
  v_energy numeric;
  v_cost integer;
  v_food_points integer;
  v_new_balance integer;
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized.';
  end if;

  select last_fed_at into v_last_fed_at
  from public.pets
  where id = p_pet_id and owner_id = p_user_id
  for update;

  if not found then
    raise exception 'Pet not found.';
  end if;

  v_energy := public.calc_pet_energy_percent(v_last_fed_at);
  v_cost := ceil((100 - v_energy) / 10)::integer;

  if v_cost <= 0 then
    raise exception 'This pet is already fully fed.';
  end if;

  select food_points into v_food_points from public.users where id = p_user_id for update;

  if v_food_points < v_cost then
    raise exception 'Not enough food points: feeding this pet costs % food points, you have %', v_cost, v_food_points;
  end if;

  perform public.begin_trusted_user_write();
  update public.users
  set food_points = food_points - v_cost
  where id = p_user_id
  returning food_points into v_new_balance;

  update public.pets set last_fed_at = now() where id = p_pet_id;

  return jsonb_build_object('pet_id', p_pet_id, 'cost', v_cost, 'new_food_points', v_new_balance);
end;
$$;

revoke all on function public.feed_pet(uuid, uuid) from public;
grant execute on function public.feed_pet(uuid, uuid) to authenticated;
