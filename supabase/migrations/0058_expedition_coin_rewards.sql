-- Expeditions have always paid out a pet-or-item roll only, never
-- coins — this was always a placeholder gap, not a deliberate design
-- choice (see start_expedition's "real zone tiers will widen this
-- later" comment, 0003_expedition_map.sql). The new map/planner design
-- assumes every completed expedition also pays coins automatically
-- (shown going up in the header the moment the trip finishes), so this
-- adds that: a coin amount scaled by the zone's tier, 10x-20x tier
-- (tier 1: 10-20, tier 2: 20-40, ...), paid the moment the expedition
-- resolves (not at claim time) so the amount is already settled and
-- waiting by the time the player opens the reward panel — same "paid
-- for you automatically, the panel just reports it" shape the design
-- asks for. These numbers are a starting point, easy to retune later;
-- nothing else about the pet-or-item keep/leave flow changes.

alter table public.expeditions
  add column coins_reward integer not null default 0;

comment on column public.expeditions.coins_reward is
  'Set once, by resolve_due_expeditions, the moment this expedition leaves in_progress — already added to the player''s coin_balance by then. 0 for tutorial expeditions (no coins).';

-- Same body as 0042's version, plus the coin roll/payout for the
-- non-tutorial branch. Return type and parameters are unchanged, so
-- this is a straight create or replace.
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
  v_species_rarity public.rarity_tier;
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
          select rarity into v_species_rarity from public.species where id = v_species_id;

          insert into public.pets (owner_id, species_id, rarity)
          values (p_user_id, v_species_id, v_species_rarity)
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
