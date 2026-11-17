-- Account deletion moves from a player self-service feature (0071's
-- delete_own_account) to an admin-only tool on the per-player staff
-- page (/mod/players/[userId]) — per the player's own call: regular
-- players won't get a self-delete option going forward, but admins
-- still need to be able to clear out test accounts while exercising
-- the onboarding flow (0070) repeatedly. Same deletion mechanics as
-- before (delete from auth.users, which cascades through nearly every
-- other table via public.users.id — see 0071's comment for the handful
-- of restrict-on-delete exceptions, e.g. admin_audit_log.admin_user_id,
-- which is exactly why the acting admin's OWN account — if it has taken
-- any admin action — can't be deleted through this either; that's a
-- feature here, not a gap, since nobody should be able to delete the
-- account they're using to do the deleting).
drop function if exists public.delete_own_account(uuid);

create function public.admin_delete_account(p_admin_user_id uuid, p_target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is distinct from p_admin_user_id then
    raise exception 'Not authorized.';
  end if;

  if not public.current_user_is_admin() then
    raise exception 'Admins only.';
  end if;

  delete from auth.users where id = p_target_user_id;
end;
$$;
