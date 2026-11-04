-- Retires the three dev placeholder zones seeded by 0002/0003
-- ("Zone Placeholder — Meadow/Forest/Cave") now that the real zones
-- exist (0059_real_expedition_zones.sql: Lighthouse Beach, Great Oak
-- Meadow, Pine Hollow). Deactivated, not deleted: zones.id has no
-- ON DELETE behavior on expeditions.zone_id, so deleting would fail
-- outright the moment any player has ever actually explored one of
-- these (a completed expedition still references its zone_id), and
-- is_active=false is exactly what the explorable-zones query already
-- filters on, same as any zone an admin deactivates through the admin
-- panel. The fixed-length tutorial zone (id ...201, is_tutorial=true)
-- is untouched — it's a separate flow, not part of the normal
-- zone-picker list these three ever were.
update public.zones
set is_active = false
where id in (
  '00000000-0000-0000-0000-000000000202', -- Zone Placeholder — Meadow
  '00000000-0000-0000-0000-000000000203', -- Zone Placeholder — Forest
  '00000000-0000-0000-0000-000000000204'  -- Zone Placeholder — Cave
);
