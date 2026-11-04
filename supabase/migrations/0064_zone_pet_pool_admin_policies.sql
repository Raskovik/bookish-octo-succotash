-- zone_pet_pool's admin write policies and audit trigger were added by
-- 0009_admin_panel.sql, an EARLIER migration than the one that last
-- recreated the table (0042_remove_traits_and_breeding.sql, re-applied
-- live by 0063_restore_zone_pet_pool.sql after this story's first two
-- fixes) — 0042's own recreation only restored the plain "viewable by
-- everyone" select policy it wrote inline, not the insert/update/
-- delete policies or trigger 0009 separately added to the original
-- table. 0063 faithfully copied 0042, so it inherited the same gap:
-- the admin zone-editor's "add to pool"/"remove from pool" actions
-- (src/app/admin/zones/actions.ts) write to zone_pet_pool directly
-- through RLS, not an RPC, and silently did nothing with no policy to
-- authorize them.
--
-- Exact same definitions 0009 gives every other admin-managed table —
-- current_user_is_admin() and log_admin_action() are both from 0009
-- too and used throughout the rest of the admin panel, which already
-- works, so neither is suspected missing.
drop policy if exists "Admins can insert zone pet pool rows" on public.zone_pet_pool;
create policy "Admins can insert zone pet pool rows"
  on public.zone_pet_pool for insert
  with check (public.current_user_is_admin());

drop policy if exists "Admins can update zone pet pool rows" on public.zone_pet_pool;
create policy "Admins can update zone pet pool rows"
  on public.zone_pet_pool for update
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

drop policy if exists "Admins can delete zone pet pool rows" on public.zone_pet_pool;
create policy "Admins can delete zone pet pool rows"
  on public.zone_pet_pool for delete
  using (public.current_user_is_admin());

drop trigger if exists audit_zone_pet_pool on public.zone_pet_pool;
create trigger audit_zone_pet_pool
  after insert or update or delete on public.zone_pet_pool
  for each row execute function public.log_admin_action();
