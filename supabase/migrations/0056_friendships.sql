-- Friend requests. Per the player's own design for this: there is no
-- dedicated friends-list page yet (deliberately out of scope here —
-- holding off so the player can design it, tentatively on /messages),
-- and the only place a request is ever ACCEPTED or DENIED is the
-- notifications tray, never the requester's profile page. Clearing a
-- friend_request notification instead of clicking Accept/Deny is
-- defined to behave exactly like clicking Deny — see the
-- clear_notification/clear_all_notifications redefinitions below.

-- ── Friendships table ────────────────────────────────────────────────
-- One row per relationship, requester/addressee rather than a
-- symmetric "user_a/user_b" pair, since direction matters while a
-- request is pending (only the addressee can accept/decline; only the
-- requester can cancel). Declined/cancelled requests are deleted
-- outright (no 'declined' status kept around) so the same two players
-- can freely try again later — only 'pending' and 'accepted' exist as
-- a result. All writes go through the RPCs below (never a plain client
-- insert/update/delete), same "RLS is select-only, RPC is the real
-- write surface" shape as every other security-definer table in this
-- app — needed here because accepting/declining means the ADDRESSEE
-- must be able to act on a row the REQUESTER created, which a plain
-- owner-column RLS policy can't express for both directions at once.
create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.users (id) on delete cascade,
  addressee_id uuid not null references public.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  check (requester_id <> addressee_id),
  unique (requester_id, addressee_id)
);

-- Covers "any row between these two people, in either direction" cheaply
-- for lookups like is_friend/is_pending without a second symmetric
-- index — every query below checks both (requester_id, addressee_id)
-- orderings explicitly rather than relying on a canonical ordering.
create index friendships_addressee_id_idx on public.friendships (addressee_id);

alter table public.friendships enable row level security;

create policy "Participants can view their own friendships"
  on public.friendships for select
  using (requester_id = auth.uid() or addressee_id = auth.uid());

-- No insert/update/delete policy — see the table comment.

-- ── Send a request ───────────────────────────────────────────────────
create function public.send_friend_request(p_user_id uuid, p_other_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
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

revoke all on function public.send_friend_request(uuid, uuid) from public;
grant execute on function public.send_friend_request(uuid, uuid) to authenticated;

-- ── Respond to a request (addressee only) ───────────────────────────
-- Deletes the matching friend_request notification as part of the same
-- call, so Accept/Deny from the tray is one atomic round-trip and the
-- notification never lingers after being actioned.
create function public.respond_to_friend_request(p_user_id uuid, p_other_user_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized';
  end if;

  if not exists (
    select 1 from public.friendships
    where requester_id = p_other_user_id and addressee_id = p_user_id and status = 'pending'
  ) then
    raise exception 'No pending friend request from that player.';
  end if;

  if p_accept then
    update public.friendships
    set status = 'accepted'
    where requester_id = p_other_user_id and addressee_id = p_user_id;
  else
    delete from public.friendships
    where requester_id = p_other_user_id and addressee_id = p_user_id;
  end if;

  delete from public.notifications
  where user_id = p_user_id and type = 'friend_request' and actor_id = p_other_user_id;
end;
$$;

revoke all on function public.respond_to_friend_request(uuid, uuid, boolean) from public;
grant execute on function public.respond_to_friend_request(uuid, uuid, boolean) to authenticated;

-- ── Cancel a request you sent (requester only) ──────────────────────
create function public.cancel_friend_request(p_user_id uuid, p_other_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized';
  end if;

  delete from public.friendships
  where requester_id = p_user_id and addressee_id = p_other_user_id and status = 'pending';

  delete from public.notifications
  where user_id = p_other_user_id and type = 'friend_request' and actor_id = p_user_id;
end;
$$;

revoke all on function public.cancel_friend_request(uuid, uuid) from public;
grant execute on function public.cancel_friend_request(uuid, uuid) to authenticated;

-- ── Unfriend ─────────────────────────────────────────────────────────
create function public.remove_friend(p_user_id uuid, p_other_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized';
  end if;

  delete from public.friendships
  where status = 'accepted'
    and ((requester_id = p_user_id and addressee_id = p_other_user_id)
      or (requester_id = p_other_user_id and addressee_id = p_user_id));
end;
$$;

revoke all on function public.remove_friend(uuid, uuid) from public;
grant execute on function public.remove_friend(uuid, uuid) to authenticated;

-- ── Notifications: two new types ────────────────────────────────────
alter type public.notification_type add value 'friend_request';
alter type public.notification_type add value 'friend_accepted';

create function public.notify_on_friend_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'pending' then
    insert into public.notifications (user_id, type, actor_id, link)
    values (new.addressee_id, 'friend_request', new.requester_id, '/u/' || new.requester_id);
  end if;

  return new;
end;
$$;

create trigger notify_on_friend_request
  after insert on public.friendships
  for each row execute function public.notify_on_friend_request();

create function public.notify_on_friend_accepted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'pending' and new.status = 'accepted' then
    insert into public.notifications (user_id, type, actor_id, link)
    values (new.requester_id, 'friend_accepted', new.addressee_id, '/u/' || new.addressee_id);
  end if;

  return new;
end;
$$;

create trigger notify_on_friend_accepted
  after update on public.friendships
  for each row execute function public.notify_on_friend_accepted();

-- ── Clearing a friend_request notification = denying it ─────────────
-- Same signatures/return types as 0052 — these replace those bodies
-- outright. Before deleting the notification row, look up its
-- type/actor; if it's a still-pending friend_request, delete the
-- matching friendships row too (scoped to status = 'pending' so this is
-- a safe no-op if the request was already resolved some other way,
-- e.g. accepted in another tab first).
create or replace function public.clear_notification(p_user_id uuid, p_notification_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type public.notification_type;
  v_actor_id uuid;
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized';
  end if;

  select type, actor_id into v_type, v_actor_id
  from public.notifications
  where id = p_notification_id and user_id = p_user_id;

  if v_type = 'friend_request' and v_actor_id is not null then
    delete from public.friendships
    where requester_id = v_actor_id and addressee_id = p_user_id and status = 'pending';
  end if;

  delete from public.notifications
  where id = p_notification_id and user_id = p_user_id;
end;
$$;

create or replace function public.clear_all_notifications(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized';
  end if;

  delete from public.friendships
  where status = 'pending'
    and addressee_id = p_user_id
    and requester_id in (
      select actor_id from public.notifications
      where user_id = p_user_id and type = 'friend_request' and actor_id is not null
    );

  delete from public.notifications
  where user_id = p_user_id;
end;
$$;
