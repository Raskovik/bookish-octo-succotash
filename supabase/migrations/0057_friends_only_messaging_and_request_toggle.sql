-- Re-adds the two settings the design always had but which were
-- dropped from who_can_message (0050) and the edit-profile page purely
-- because there was no friends feature to attach them to yet
-- (0056_friendships.sql fixed that): the "friends" messaging option,
-- and an "allow friend requests" toggle.

-- ── "Allow friend requests" ───────────────────────────────────────────
alter table public.users
  add column allow_friend_requests boolean not null default true;

comment on column public.users.allow_friend_requests is
  'When false, send_friend_request() rejects a new request to this player outright. Flipping this never touches an existing friendship or an already-pending request.';

-- Public via user_profiles (same reasoning as who_can_message, 0050):
-- a visitor's profile page can grey out "Add friend" up front instead
-- of only finding out from a rejected RPC call.
create or replace view public.user_profiles as
  select id, display_name, avatar_url, bio, created_at, is_admin, is_moderator,
         coin_balance, gem_balance, den_size, who_can_message, allow_friend_requests
  from public.users;

-- send_friend_request (0056) gains the allow_friend_requests check —
-- same signature/return type, so this is a straight create or replace.
create or replace function public.send_friend_request(p_user_id uuid, p_other_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allow boolean;
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized';
  end if;

  if p_user_id = p_other_user_id then
    raise exception 'You can''t friend yourself.';
  end if;

  if public.is_blocked_by(p_user_id, p_other_user_id) then
    raise exception 'You can''t send a friend request to this player.';
  end if;

  select allow_friend_requests into v_allow from public.users where id = p_other_user_id;
  if v_allow is null or not v_allow then
    raise exception 'This player isn''t accepting friend requests right now.';
  end if;

  if exists (
    select 1 from public.friendships
    where (requester_id = p_user_id and addressee_id = p_other_user_id)
       or (requester_id = p_other_user_id and addressee_id = p_user_id)
  ) then
    raise exception 'A friend request already exists between you two.';
  end if;

  insert into public.friendships (requester_id, addressee_id, status)
  values (p_user_id, p_other_user_id, 'pending');
end;
$$;

-- ── "Friends only" messaging ─────────────────────────────────────────
alter table public.users drop constraint users_who_can_message_check;
alter table public.users add constraint users_who_can_message_check
  check (who_can_message in ('everyone', 'friends', 'nobody'));

-- Same shape as is_blocked_by (0032): security definer so the dm_messages
-- policy below can see friendships rows regardless of the CALLER's own
-- visibility into that table (friendships' own SELECT policy only shows
-- rows either party is in, which the sender already is here, but this
-- keeps the same "don't rely on the caller's RLS inside a policy" rule
-- the rest of this app follows).
create function public.are_friends(p_user_a uuid, p_user_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.friendships
    where status = 'accepted'
      and ((requester_id = p_user_a and addressee_id = p_user_b)
        or (requester_id = p_user_b and addressee_id = p_user_a))
  );
$$;

-- Re-created again with one more case in the who_can_message check
-- (same additive-narrowing reasoning as 0050's own version of this):
-- 'nobody' still blocks outright, 'friends' now requires an accepted
-- friendship, 'everyone' is unchanged.
drop policy "Participants can send messages" on public.dm_messages;
create policy "Participants can send messages"
  on public.dm_messages for insert
  with check (
    sender_id = auth.uid()
    and not public.user_has_active_ban(sender_id, 'dm')
    and exists (
      select 1 from public.dm_conversations c
      where c.id = conversation_id
        and auth.uid() in (c.user_one_id, c.user_two_id)
        and not public.user_has_active_ban(
          case when c.user_one_id = sender_id then c.user_two_id else c.user_one_id end,
          'dm'
        )
        and not public.is_blocked_by(
          sender_id,
          case when c.user_one_id = sender_id then c.user_two_id else c.user_one_id end
        )
        and coalesce((
          select case who_can_message
            when 'nobody' then false
            when 'friends' then public.are_friends(sender_id, id)
            else true
          end
          from public.user_profiles
          where id = case when c.user_one_id = sender_id then c.user_two_id else c.user_one_id end
        ), false)
    )
  );
