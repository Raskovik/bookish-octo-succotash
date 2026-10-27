-- The new edit-profile page (fg-edit handoff) promises "3 to 20 letters,
-- numbers or _" for usernames — tighter than change_display_name()'s
-- original rules (0014_unique_display_names.sql: 3-40 chars, any
-- characters, only whitespace collapsed). Re-enforced here, not just in
-- the new page's client-side check, since the RPC is the real backstop.
-- Same signature, so CREATE OR REPLACE is safe; existing names that
-- predate this rule are left alone (this only gates *future* changes).
create or replace function public.change_display_name(p_user_id uuid, p_new_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_changed_at timestamptz;
  v_gem_balance integer;
  v_next_available timestamptz;
  v_cost constant integer := 15;
  v_cooldown constant interval := interval '14 days';
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized';
  end if;

  v_name := coalesce(p_new_name, '');
  if char_length(v_name) < 3 or char_length(v_name) > 20 then
    raise exception 'Names are 3 to 20 characters long.';
  end if;
  if v_name !~ '^[A-Za-z0-9_]+$' then
    raise exception 'Use only letters, numbers and underscores.';
  end if;

  select display_name_changed_at, gem_balance into v_changed_at, v_gem_balance
  from public.users
  where id = p_user_id
  for update;

  if not found then
    raise exception 'Account not found.';
  end if;

  v_next_available := v_changed_at + v_cooldown;
  if now() < v_next_available then
    raise exception 'You can change your name again on %.', to_char(v_next_available, 'YYYY-MM-DD');
  end if;

  if v_gem_balance < v_cost then
    raise exception 'Changing your name costs % gems — you have %.', v_cost, v_gem_balance;
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
      gem_balance = gem_balance - v_cost
  where id = p_user_id
  returning gem_balance into v_gem_balance;

  return jsonb_build_object(
    'display_name', v_name,
    'gem_balance', v_gem_balance,
    'next_change_available_at', now() + v_cooldown
  );
end;
$$;
