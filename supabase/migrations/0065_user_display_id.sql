-- A short, sequential, public-facing id for profile URLs — 1 for the
-- first account, 2 for the second, and so on (the player's own call,
-- after seeing how chickensmoothie.com does it). NOT the real primary
-- key: auth.users.id stays a uuid (Supabase's own auth schema requires
-- that, and every other table in this project foreign-keys to
-- users.id as uuid already) — display_id is purely an additional,
-- public, sequential handle for the URL and nothing else ever joins
-- against it.
--
-- bigserial backfills every existing row in one shot, assigning values
-- in whatever order Postgres happens to read them — not guaranteed to
-- match created_at order on its own, so this explicitly numbers
-- existing rows by created_at first (oldest = 1), then lets the
-- sequence continue from there for every new signup afterward.
alter table public.users add column display_id bigint;

with ordered as (
  select id, row_number() over (order by created_at, id) as rn
  from public.users
)
update public.users
set display_id = ordered.rn
from ordered
where ordered.id = users.id;

create sequence if not exists public.users_display_id_seq;
select setval('public.users_display_id_seq', coalesce((select max(display_id) from public.users), 0) + 1, false);

alter table public.users
  alter column display_id set default nextval('public.users_display_id_seq'),
  alter column display_id set not null;

alter sequence public.users_display_id_seq owned by public.users.display_id;

create unique index users_display_id_unique_idx on public.users (display_id);

comment on column public.users.display_id is
  'Sequential, public-facing profile id (1 = first account) — URL/display only, never a foreign key target. Real primary key stays id (uuid).';

-- Existing privileged-column guard (0054's version) gains display_id —
-- a player must never be able to pick/change their own number.
create or replace function public.protect_privileged_user_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role'
     and coalesce(current_setting('app.trusted_user_write', true), 'false') <> 'true' then
    new.is_admin := old.is_admin;
    new.coin_balance := old.coin_balance;
    new.gem_balance := old.gem_balance;
    new.den_size := old.den_size;
    new.garden_rows := old.garden_rows;
    new.google_sub := old.google_sub;
    new.email := old.email;
    new.starter_granted := old.starter_granted;
    new.food_points := old.food_points;
    new.display_id := old.display_id;
  end if;
  return new;
end;
$$;

-- Public via user_profiles (same reasoning as every other public field
-- on this view): profile links are built from this everywhere.
--
-- Dropped and recreated rather than create or replace: that only
-- allows appending a new column at the very end and otherwise
-- requires every existing column to stay in the exact same name/order
-- it already has, which errors (42P16) the moment the live view's
-- actual current column order doesn't match what's assumed here —
-- already hit twice now, so rather than keep guessing the live order,
-- this sidesteps the constraint entirely. The explicit select list
-- below is deliberately exhaustive (not select *) so this stays
-- correct regardless of what order the underlying table's columns
-- are actually in. Grants don't survive a drop, so select is
-- re-granted after (same as the view's original grant, 0001).
--
-- dm_messages' own insert policy (0057) reads through this view
-- inside its WITH CHECK, so Postgres refuses the drop outright
-- (2BP01, "other objects depend on it") unless that policy goes too —
-- dropped here and recreated verbatim (0057's own text, unchanged)
-- right after the view exists again, rather than DROP ... CASCADE,
-- which would take the policy down with it and never put it back.
drop policy if exists "Participants can send messages" on public.dm_messages;

drop view if exists public.user_profiles;

create view public.user_profiles as
  select id, display_id, display_name, avatar_url, bio, created_at, is_admin, is_moderator,
         coin_balance, gem_balance, den_size, who_can_message, allow_friend_requests
  from public.users;

grant select on public.user_profiles to anon, authenticated;

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

-- notify_on_friend_request/notify_on_friend_accepted (0056) each bake
-- a '/u/' || <uuid> link straight into the notifications row at insert
-- time — the only two notification triggers in the whole app that
-- build a profile link at all. Left un-updated, every NEW friend
-- notification from here on would still point at a dead /u/<uuid> URL,
-- not just old ones. Same signatures/trigger wiring, so this is a
-- plain create or replace.
create or replace function public.notify_on_friend_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_requester_display_id bigint;
begin
  if new.status = 'pending' then
    select display_id into v_requester_display_id from public.users where id = new.requester_id;

    insert into public.notifications (user_id, type, actor_id, link)
    values (new.addressee_id, 'friend_request', new.requester_id, '/u/' || v_requester_display_id);
  end if;

  return new;
end;
$$;

create or replace function public.notify_on_friend_accepted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_addressee_display_id bigint;
begin
  if old.status = 'pending' and new.status = 'accepted' then
    select display_id into v_addressee_display_id from public.users where id = new.addressee_id;

    insert into public.notifications (user_id, type, actor_id, link)
    values (new.requester_id, 'friend_accepted', new.addressee_id, '/u/' || v_addressee_display_id);
  end if;

  return new;
end;
$$;
