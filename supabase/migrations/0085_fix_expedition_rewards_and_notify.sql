-- Two real bugs reported by the user, both in the expedition-resolve
-- path:
--
-- 1. Items found on a trip were never actually granted. resolve_due_
--    expeditions (last rewritten in 0082) records each stack into
--    expedition_loot_items — a per-expedition ledger the reveal screen
--    reads from (expeditions-app.tsx) — but nothing ever copies that
--    into user_inventory. This goes back further than 0082: even
--    0069's original multi-item rewrite had the same gap (its own
--    comment on claim_expedition_reward claims "items ... are already
--    granted by resolve_due_expeditions," which was true for coins/XP
--    in that same function but was never actually true for items).
--    Coins and XP are granted immediately and unconditionally in
--    resolve_due_expeditions; items now get the same treatment,
--    alongside the existing ledger write (which stays — the reveal
--    screen still needs "what did this trip yield" as its own list).
--
-- 2. No notification ever fires when a trip finishes. Every other
--    "something happened while you were away" event in this app (a DM,
--    a forum reply, a trade offer, a marketplace sale) has a
--    notify_on_* trigger (0044_notifications.sql) — an expedition
--    finishing simply never got one.

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
            insert into public.expedition_loot_items (expedition_id, item_id, quantity)
            values (v_expedition.id, v_loot.item_id, v_loot.amount)
            on conflict (expedition_id, item_id) do update
              set quantity = public.expedition_loot_items.quantity + v_loot.amount;

            -- The actual grant — expedition_loot_items above is only
            -- the "what did this trip yield" ledger the reveal screen
            -- reads from; this is what makes the player actually own
            -- it, same as coins/XP below.
            insert into public.user_inventory (user_id, item_id, quantity)
            values (p_user_id, v_loot.item_id, v_loot.amount)
            on conflict (user_id, item_id) do update
              set quantity = public.user_inventory.quantity + v_loot.amount;
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

-- ── Notify when a trip finishes ──────────────────────────────────────────
alter type public.notification_type add value 'expedition_complete';

create function public.notify_on_expedition_complete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_zone_name text;
begin
  -- Tutorial trips resolve straight to 'completed' (no claim step —
  -- see resolve_due_expeditions above), everything else to
  -- 'awaiting_claim'; either is "done, come look" from the player's
  -- side, so both fire this the same way.
  if old.status = 'in_progress' and new.status in ('awaiting_claim', 'completed') then
    select name into v_zone_name from public.zones where id = new.zone_id;

    insert into public.notifications (user_id, type, target_label, link)
    values (new.user_id, 'expedition_complete', v_zone_name, '/expeditions');
  end if;

  return new;
end;
$$;

create trigger notify_on_expedition_complete
  after update on public.expeditions
  for each row execute function public.notify_on_expedition_complete();
