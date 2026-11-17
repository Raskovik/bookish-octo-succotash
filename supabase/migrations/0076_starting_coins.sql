-- New players get 500 free coins the moment they finish screen 0 of
-- /welcome (the "Create account" button) — coin_balance is a
-- protected column (protect_privileged_user_fields, 0001/0011/…), so
-- this needs begin_trusted_user_write() first, same as starter_granted
-- in adopt_starter_pet just below it. create_player_account is
-- one-time (rejects once display_name is already set — see its own
-- comment above this), so this can never be collected twice.
create or replace function public.create_player_account(
  p_user_id uuid,
  p_display_name text,
  p_avatar_url text,
  p_agreed boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_already_named boolean;
  v_starting_coins constant integer := 500;
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized.';
  end if;

  if not coalesce(p_agreed, false) then
    raise exception 'You must agree to the Rules and Terms of Service.';
  end if;

  v_name := trim(coalesce(p_display_name, ''));
  if v_name !~ '^[A-Za-z0-9_]{3,16}$' then
    raise exception 'Username must be 3 to 16 letters, numbers or underscores.';
  end if;

  select display_name is not null into v_already_named
  from public.users
  where id = p_user_id
  for update;

  if not found then
    raise exception 'Account not found.';
  end if;

  if v_already_named then
    raise exception 'Your account is already set up.';
  end if;

  if exists (
    select 1 from public.users
    where lower(display_name) = lower(v_name) and id <> p_user_id
  ) then
    raise exception 'That name is already taken.';
  end if;

  perform public.begin_trusted_user_write();
  update public.users
  set display_name = v_name,
      display_name_changed_at = now(),
      avatar_url = p_avatar_url,
      coin_balance = coin_balance + v_starting_coins
  where id = p_user_id;
end;
$$;
