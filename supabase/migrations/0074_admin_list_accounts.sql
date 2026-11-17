-- /admin/accounts only ever showed the signed-in admin's own row — the
-- plain authenticated client it queries through is still bound by
-- "Users can view own row" (0001_init_users.sql), which was never
-- relaxed for admins (public profile data goes through the
-- `user_profiles` view instead, and that view deliberately leaves out
-- email — see its own comment in 0065). Rather than loosen users' own
-- RLS (which would expose every player's email to every other
-- authenticated client, not just admins), this adds one narrow,
-- admin-gated, security-definer function that returns exactly the
-- columns that page needs.
create function public.admin_list_accounts(p_admin_user_id uuid, p_query text default null)
returns table (
  id uuid,
  display_id bigint,
  display_name text,
  email text,
  is_admin boolean,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pattern text;
begin
  if auth.uid() is distinct from p_admin_user_id then
    raise exception 'Not authorized.';
  end if;

  if not public.current_user_is_admin() then
    raise exception 'Admins only.';
  end if;

  v_pattern := '%' || coalesce(nullif(trim(p_query), ''), '') || '%';

  return query
    select u.id, u.display_id, u.display_name, u.email, u.is_admin, u.created_at
    from public.users u
    where p_query is null or trim(p_query) = ''
      or u.display_name ilike v_pattern
      or u.email ilike v_pattern
    order by u.created_at desc
    limit 25;
end;
$$;
