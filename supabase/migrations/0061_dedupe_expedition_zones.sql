-- Cleanup after 0059_real_expedition_zones.sql ran more than once
-- against the live project: zones has no unique constraint on name, so
-- a second run silently inserted 3 duplicate zone rows (Lighthouse
-- Beach / Great Oak Meadow / Pine Hollow again) before the second
-- zone_loot_table insert hit a duplicate-key error against the first
-- run's already-committed loot rows. This keeps the OLDEST row per
-- name (the one from the first, successful run — already linked to
-- its loot pool) and removes any extras.
--
-- A duplicate zone is only ever deleted if nothing already points at
-- it: zone_pet_pool/zone_loot_table rows for it are cleared first (a
-- duplicate from a failed second run has none of its own loot rows —
-- that insert never got that far — but this is harmless either way),
-- and a duplicate with any real expedition against it (a player
-- happened to start one in the brief window between runs) is left in
-- place, deactivated instead of deleted, rather than risk the delete
-- failing outright on that foreign key.
with dupes as (
  select id, name, row_number() over (partition by name order by created_at asc) as rn
  from public.zones
  where name in ('Lighthouse Beach', 'Great Oak Meadow', 'Pine Hollow')
),
to_remove as (
  select id from dupes where rn > 1
)
delete from public.zone_pet_pool
where zone_id in (select id from to_remove);

with dupes as (
  select id, name, row_number() over (partition by name order by created_at asc) as rn
  from public.zones
  where name in ('Lighthouse Beach', 'Great Oak Meadow', 'Pine Hollow')
),
to_remove as (
  select id from dupes where rn > 1
)
delete from public.zone_loot_table
where zone_id in (select id from to_remove);

with dupes as (
  select id, name, row_number() over (partition by name order by created_at asc) as rn
  from public.zones
  where name in ('Lighthouse Beach', 'Great Oak Meadow', 'Pine Hollow')
),
to_remove as (
  select id from dupes where rn > 1
)
delete from public.zones
where id in (select id from to_remove)
  and not exists (select 1 from public.expeditions e where e.zone_id = zones.id);

with dupes as (
  select id, name, row_number() over (partition by name order by created_at asc) as rn
  from public.zones
  where name in ('Lighthouse Beach', 'Great Oak Meadow', 'Pine Hollow')
),
to_remove as (
  select id from dupes where rn > 1
)
update public.zones
set is_active = false
where id in (select id from to_remove);

-- Verify: should return exactly 3 rows, one per name, each active.
select id, name, is_active, created_at
from public.zones
where name in ('Lighthouse Beach', 'Great Oak Meadow', 'Pine Hollow')
order by name;
