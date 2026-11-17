-- Two small, unrelated fixes bundled together:
--
-- 1. A player's very first-ever expedition is capped at exactly 10
--    minutes, regardless of their starter pet's Speed roll (which is a
--    fixed 5/5/5 anyway — see 0070) or any duration-affecting potion.
--    The normal 60-180 minute Speed-driven roll only kicks in from the
--    second trip onward. Checked by "does this user have any expedition
--    row at all yet", so it only ever applies once per account.
--
-- 2. delete_own_account(): a player can delete their own account and
--    everything that cascades from it (pets, inventory, expeditions,
--    trades, …) — added so onboarding (0070) can be tested repeatedly
--    by deleting a test account and re-running the same Google sign-in.
--    Deliberately self-only, same as every other privileged RPC in this
--    project (see admin_grant_self_currency's comment on "no in-app way
--    to affect any account but my own") — there is no target-user
--    admin tool here, just a stronger version of what any player can
--    already do to their own data. Deleting from auth.users (not just
--    public.users) is what actually frees up the Google account to
--    sign up fresh — public.users.id references auth.users(id) on
--    delete cascade (0001), and nearly every other table cascades from
--    public.users.id in turn, so one delete here clears out the
--    account's pets/items/expeditions/trades/messages/etc. automatically.
--    A handful of tables (forum_posts.author_id, site_news_posts.
--    author_id, bans.issued_by, admin_audit_log.admin_user_id, and
--    similar) were deliberately left as plain (restrict-on-delete)
--    foreign keys when they were created, since losing who wrote a
--    forum post or issued a ban is its own real cost — deleting an
--    account that has any of that history will fail with a foreign-key
--    error instead of silently erasing it. That's fine for its purpose
--    here (clearing out fresh test accounts); a staff-managed account
--    deletion/anonymization flow for real players is a different,
--    bigger feature nobody's asked for yet.
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

  -- First-ever expedition (across the whole account, not per pet) is
  -- always exactly 10 minutes — a fast, reliable first result right
  -- after onboarding, regardless of Speed roll or any potion. Every
  -- later trip goes back to the normal Speed-driven roll above.
  select not exists (
    select 1 from public.expeditions where user_id = p_user_id
  ) into v_is_first_trip;

  if v_is_first_trip then
    v_duration_seconds := 600;
  end if;

  insert into public.expeditions
    (user_id, pet_id, zone_id, status, is_tutorial, started_at, resolves_at, item_find_bias, double_reward_chance)
  values
    (p_user_id, p_pet_id, p_zone_id, 'in_progress', false, now(), now() + make_interval(secs => v_duration_seconds), v_item_bias, v_double_chance)
  returning id into v_expedition_id;

  return v_expedition_id;
end;
$$;

create function public.delete_own_account(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized.';
  end if;

  delete from auth.users where id = p_user_id;
end;
$$;
