-- game_config (0080) was admin-select-only, same as the content filter's
-- banned lists — but unlike those, there's nothing sensitive here, and
-- the client NEEDS to read the live trip-duration values to show an
-- accurate "back in about X to Y minutes" estimate before sending a pet
-- out (expeditions-app.tsx). Without this, that estimate silently used
-- its own hardcoded copy of the formula constants, which drifted out of
-- sync the moment an admin tuned anything on /admin/game-config.
--
-- Multiple policies on the same command are OR'd together, so this
-- doesn't loosen insert/update/delete at all — those still require
-- "Admins can manage game config" (0080) to pass; this only adds an
-- additional, unconditional allowance for select.
create policy "Game config is viewable by everyone"
  on public.game_config for select
  using (true);
