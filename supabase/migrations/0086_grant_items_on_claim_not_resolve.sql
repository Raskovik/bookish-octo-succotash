-- Follow-up to 0085: items should only become the player's once they
-- actually dismiss the reveal screen (the same "Keep it"/"Leave it"/
-- "Done" button that already exists there, calling
-- claim_expedition_reward), not the instant the trip resolves in the
-- background. 0085 granted them unconditionally inside resolve_due_
-- expeditions, which is too early — the player should see what they
-- found and click through before it's actually added to their
-- inventory, matching how the friend-pet decision already works.
--
-- resolve_due_expeditions goes back to only writing the
-- expedition_loot_items ledger (what the reveal screen reads); the
-- grant itself moves to claim_expedition_reward, which now also sums
-- that expedition's ledger rows into user_inventory. Unconditional on
-- p_keep — items were never part of the pet keep/release choice, that
-- choice is scoped to the friend pet alone.

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
  v_reward_coins_base integer;
  v_reward_coins_variance integer;
  v_reward_xp integer;
  v_coins integer;
  v_xp_gain integer;
  v_strength numeric;
  v_defence numeric;
  v_gs numeric;
  v_gd numeric;
  v_power numeric;
  v_stack_count integer;
  v_pass integer;
  v_loot record;
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
      select reward_coins_base, reward_coins_variance, reward_xp
      into v_reward_coins_base, v_reward_coins_variance, v_reward_xp
      from public.zones where id = v_expedition.zone_id;

      v_strength := v_expedition.level * 2 * (v_expedition.roll_strength / 10.0);
      v_defence := v_expedition.level * 2 * (v_expedition.roll_defence / 10.0);
      v_gs := v_strength / (v_strength + v_sat_k);
      v_gd := v_defence / (v_defence + v_sat_k);

      v_power := (v_gs + v_expedition.level::numeric / 25) / 2;
      v_power := least(1.0, greatest(0.0, v_power * coalesce(v_expedition.item_find_bias, 1.0)));

      v_stack_count := round(
        public.gc('stacks_per_trip_min')
        + v_power * (public.gc('stacks_per_trip_max') - public.gc('stacks_per_trip_min'))
      )::int;

      v_double_chance := coalesce(v_expedition.double_reward_chance, public.gc('double_haul_base_chance'));
      v_is_double := (random() < v_double_chance) or (random() < public.gc('double_haul_strength_weight') * v_gs);

      for v_pass in 1..(case when v_is_double then 2 else 1 end) loop
        for v_i in 1..v_stack_count loop
          select * into v_loot from public.pick_weighted_zone_item(v_expedition.zone_id);
          if v_loot.item_id is not null then
            -- Ledger only — what the reveal screen shows. Not granted
            -- to user_inventory until the player claims it (see
            -- claim_expedition_reward below).
            insert into public.expedition_loot_items (expedition_id, item_id, quantity)
            values (v_expedition.id, v_loot.item_id, v_loot.amount)
            on conflict (expedition_id, item_id) do update
              set quantity = public.expedition_loot_items.quantity + v_loot.amount;
          end if;
        end loop;
      end loop;

      v_species_id := public.pick_weighted_zone_species(v_expedition.zone_id);

      v_coins := coalesce(v_reward_coins_base, 10) + floor(random() * (coalesce(v_reward_coins_variance, 10) + 1))::int;
      v_xp_gain := coalesce(v_reward_xp, 10);

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
  v_loot record;
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

  -- Grant every item this trip found — the player has already seen the
  -- full list on the reveal screen by the time this is called (whether
  -- they're keeping or releasing the friend pet is a separate choice
  -- that never applied to items).
  for v_loot in
    select item_id, quantity from public.expedition_loot_items where expedition_id = p_expedition_id
  loop
    insert into public.user_inventory (user_id, item_id, quantity)
    values (p_user_id, v_loot.item_id, v_loot.quantity)
    on conflict (user_id, item_id) do update
      set quantity = public.user_inventory.quantity + v_loot.quantity;
  end loop;

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
