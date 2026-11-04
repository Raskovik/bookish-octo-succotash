-- The three real expedition zones from the map/planner design handoff
-- (furgarden-expeditions-package), replacing the dev placeholder zones
-- 0002/0003 seeded ("Zone Placeholder — Meadow/Forest/Cave"). Those
-- placeholder rows are untouched here — zones are admin-managed in the
-- live project, so this only adds new rows rather than guessing at the
-- live state of old ones; deactivate/delete the placeholders yourself
-- via the admin panel if they're still active.
--
-- map_x/y/width/height are the handoff's pixel rectangles (on its
-- 2048x1361 map) converted to percentages of the map image, same
-- scheme map_x/y/width/height already used (0003_expedition_map.sql).
-- Tier is a judgment call (not given by the handoff, which only gave a
-- "base" trip-length-in-hours placeholder we aren't using — duration
-- stays the existing flat 2-3 minute roll per the player's own call):
-- ordered by the handoff's own "base" value (beach 1 < meadow 2 <
-- forest 4), tier 1/2/3 respectively, which also sets each zone's
-- coin-reward range (0058_expedition_coin_rewards.sql: 10x-20x tier).
-- Easy to retune in the admin panel later.
insert into public.zones (name, tier, description, image_url, is_tutorial, is_active, map_x, map_y, map_width, map_height)
values
  (
    'Lighthouse Beach',
    1,
    'Sun, sand and a lighthouse watching over the shallows. A gentle first expedition.',
    '/img/expeditions/beach.webp',
    false,
    true,
    11.1328125,
    47.83250551,
    43.26171875,
    48.3468038
  ),
  (
    'Great Oak Meadow',
    2,
    'Wildflowers and tall grass ringing a single ancient oak.',
    '/img/expeditions/meadow.webp',
    false,
    true,
    26.4160156,
    20.2057311,
    43.3105469,
    53.3431301
  ),
  (
    'Pine Hollow',
    3,
    'A quiet stand of pines — the furthest and most overgrown of the three.',
    '/img/expeditions/forest.webp',
    false,
    true,
    47.0703125,
    50.3306407,
    39.59960938,
    43.5709038
  );

-- Loot pools, by item name (not a hardcoded id — these items are
-- admin-managed, added through an earlier design handoff, not present
-- in this repo's own migrations). Verify afterward that each zone
-- actually got 2 rows in zone_loot_table; a name that doesn't match
-- any real item silently inserts nothing, rather than failing loudly.
with z as (
  select id, name from public.zones
  where name in ('Lighthouse Beach', 'Great Oak Meadow', 'Pine Hollow')
),
i as (
  select id, name from public.items
  where name in ('Blue Feather', 'Blueberry', 'Cranberry', 'Brown Mushroom')
)
insert into public.zone_loot_table (zone_id, item_id, drop_weight)
select z.id, i.id, 1
from z
join i on (
  (z.name = 'Lighthouse Beach' and i.name in ('Blue Feather', 'Blueberry'))
  or (z.name = 'Great Oak Meadow' and i.name in ('Blueberry', 'Blue Feather'))
  or (z.name = 'Pine Hollow' and i.name in ('Brown Mushroom', 'Cranberry'))
);
