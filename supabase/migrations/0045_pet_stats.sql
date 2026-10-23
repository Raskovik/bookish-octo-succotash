-- Pet stats data, per the "Pet Stats and 1v1 Combat Spec" doc (chale,
-- 2026-10-22). Combat itself (baseDamage/resolveAttack/runFight) is a
-- later module — this migration only adds what a pet needs stats
-- computed FROM. Strength/Speed/Defence are never stored: they're a
-- pure function of level/roll/rate (Stat = Level x Rate x (Roll / 10)),
-- computed on read in src/lib/pet-combat.ts.
--
-- roll_strength/roll_speed/roll_defence default to a random 1-10
-- integer. Postgres forces a full table rewrite for a volatile DEFAULT
-- like random() (it can't just backfill one precomputed value into
-- every row the way a constant default would), re-evaluating the
-- expression separately for every existing row — so this single ALTER
-- both gives every pet already in the game its own independent rolls,
-- and keeps working as the column's default for every pet created
-- afterward by a plain INSERT (grant_starter_pet_and_tutorial,
-- resolve_due_expeditions), matching the spec's "random, set once at
-- birth, never changes" with no application code needed to generate it.
--
-- level has no such default needed — the spec never describes it as
-- random, only as growing over time with no cap, so 1 is the right
-- starting point for both new and backfilled pets.
alter table public.pets
  add column level integer not null default 1 check (level >= 1),
  add column roll_strength smallint not null default floor(random() * 10 + 1)::smallint check (roll_strength between 1 and 10),
  add column roll_speed smallint not null default floor(random() * 10 + 1)::smallint check (roll_speed between 1 and 10),
  add column roll_defence smallint not null default floor(random() * 10 + 1)::smallint check (roll_defence between 1 and 10);

comment on column public.pets.level is
  'Grows over time, no cap — no leveling mechanic exists yet (later module). Stats are Level x Rate x (Roll / 10); see src/lib/pet-combat.ts. Never updated by anything in this migration.';
comment on column public.pets.roll_strength is
  'Permanent birth roll, 1-10 — set once by this column''s own DEFAULT at insert time, never updated after. pets has never had a client UPDATE policy (see custom_name/bio), so there''s no path to change it anyway.';
comment on column public.pets.roll_speed is 'See roll_strength — same shape, for the Speed stat.';
comment on column public.pets.roll_defence is 'See roll_strength — same shape, for the Defence stat.';
