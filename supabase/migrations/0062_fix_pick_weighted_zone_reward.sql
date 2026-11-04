-- Live-DB repair: resolve_due_expeditions started erroring with
-- "column species_id does not exist" on every non-tutorial expedition
-- (ERROR 42703), which is why rewards got permanently stuck showing
-- "wrapping up" — the error happens inside the RPC, which the app
-- calls fire-and-forget on page load, so it was failing silently every
-- time. Root cause: pick_weighted_zone_reward(uuid, numeric) on the
-- live database was still the single-item-only version from an older
-- point in this project's history (returns plain uuid), not the
-- "pet-or-item" table-returning version (reward_kind, species_id,
-- item_id) that 0042_remove_traits_and_breeding.sql's own migration
-- already defines and every expedition RPC since has assumed is live
-- — that one DROP+CREATE apparently never actually took effect here.
--
-- Return type changes need an explicit drop first (same reason 0042
-- itself needed one) — a plain `create or replace` can't change a
-- function's return type. Re-running the exact fix is safe no matter
-- which of the two shapes is currently live.
drop function if exists public.pick_weighted_zone_reward(uuid, numeric);

create function public.pick_weighted_zone_reward(p_zone_id uuid, p_item_bias numeric default 1.0)
returns table (reward_kind text, species_id uuid, item_id uuid)
language sql
as $$
  select reward_kind, species_id, item_id
  from (
    select 'pet' as reward_kind, species_id, null::uuid as item_id,
      power(random(), 1.0 / drop_weight) as roll
    from public.zone_pet_pool
    where zone_id = p_zone_id
    union all
    select 'item' as reward_kind, null::uuid as species_id, item_id,
      power(random(), 1.0 / (drop_weight * p_item_bias)) as roll
    from public.zone_loot_table
    where zone_id = p_zone_id
  ) combined
  order by roll desc
  limit 1;
$$;

revoke all on function public.pick_weighted_zone_reward(uuid, numeric) from public;
