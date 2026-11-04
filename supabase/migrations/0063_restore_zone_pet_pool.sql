-- Live-DB repair, continued (see 0062's comment for the first half of
-- this story). zone_pet_pool itself doesn't exist on the live
-- database either: 0038_trait_breeding_schema.sql dropped the
-- original table, and 0042_remove_traits_and_breeding.sql's own
-- recreation of it — same migration whose pick_weighted_zone_reward
-- fix 0062 just re-applied — apparently didn't take effect either.
-- pick_weighted_zone_species (0042 also (re)creates this one fresh;
-- 0038 dropped the original outright, same as the table) is almost
-- certainly missing for the same reason, which breaks more than just
-- expeditions: grant_starter_pet_and_tutorial — new-player signup's
-- starter pet — calls it too.
--
-- Both are re-created exactly as 0042 defines them, guarded so this is
-- safe to run whether they're fully missing (the live state found so
-- far) or already correct (nothing here changes behavior either way).
--
-- Per 0042's own original comment: this does NOT restore which
-- species used to drop in which zone — that data was deleted outright
-- when 0038 dropped the table. Re-populate each zone's pet pool via
-- the admin panel after running this.
create table if not exists public.zone_pet_pool (
  zone_id uuid not null references public.zones (id) on delete cascade,
  species_id uuid not null references public.species (id) on delete cascade,
  drop_weight integer not null default 1 check (drop_weight > 0),
  primary key (zone_id, species_id)
);

alter table public.zone_pet_pool enable row level security;

drop policy if exists "Zone pet pools are viewable by everyone" on public.zone_pet_pool;
create policy "Zone pet pools are viewable by everyone"
  on public.zone_pet_pool for select
  using (true);

drop function if exists public.pick_weighted_zone_species(uuid);

create function public.pick_weighted_zone_species(p_zone_id uuid)
returns uuid
language sql
as $$
  select species_id
  from public.zone_pet_pool
  where zone_id = p_zone_id
  order by power(random(), 1.0 / drop_weight) desc
  limit 1;
$$;

revoke all on function public.pick_weighted_zone_species(uuid) from public;
