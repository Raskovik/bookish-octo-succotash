-- A unified notification system: one `notifications` table covering
-- every event a player might want a heads-up about (a DM, a reply to
-- their forum thread, a trade offer, a marketplace sale, a ban) plus one
-- staff-only event (a new report filed). Deliberately NOT a replacement
-- for the existing unread-DM badge (dm_conversations' own read-marker
-- columns, 0026_direct_messages.sql) — that stays as-is for the inbox;
-- this is a separate activity feed surfaced as a bell icon next to it.
--
-- Rows are only ever created by the trigger functions below (security
-- definer, same "no plain client write" shape as dm_conversations/
-- marketplace_listings) — there's no insert policy for plain clients.
-- Read state is flipped via mark_notification_read/
-- mark_all_notifications_read, not a raw UPDATE policy, same reasoning
-- as mark_dm_conversation_read needing security definer: a player must
-- only ever be able to mark their OWN rows read.
create type public.notification_type as enum (
  'dm',
  'forum_reply',
  'trade_offer',
  'trade_response',
  'marketplace_sold',
  'marketplace_expired',
  'ban_issued',
  'report_filed'
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  type public.notification_type not null,
  -- Who/what caused this, for the dropdown to resolve a name via
  -- user_profiles at read time (same "batched lookup, not a stored
  -- name" pattern as the homepage's SiteNewsPanel/ForumActivityPanel).
  -- Null for report_filed's fan-out-to-staff rows isn't needed here
  -- (the reporter IS the actor), but left nullable for any future event
  -- type that has no single "who."
  actor_id uuid references public.users (id) on delete set null,
  -- A short plain-text snapshot used to fill in the notification
  -- sentence (a thread title, an item/pet name, a ban type, a trade's
  -- resolved status) — same snapshot reasoning as marketplace_listings'
  -- pet_species_name: the underlying row can change or disappear later,
  -- but the notification should still read sensibly.
  target_label text,
  link text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_user_id_created_at_idx on public.notifications (user_id, created_at desc);
create index notifications_user_id_unread_idx on public.notifications (user_id) where not is_read;

comment on table public.notifications is
  'One row per notification event. Written only by the notify_on_* triggers below, never a plain client write — see mark_notification_read/mark_all_notifications_read for the only client-facing writes.';

alter table public.notifications enable row level security;

create policy "Users can view their own notifications"
  on public.notifications for select
  using (user_id = auth.uid());

-- No insert/update/delete policy — see the table comment.

-- ── Read-marking RPCs ────────────────────────────────────────────────
create function public.mark_notification_read(p_user_id uuid, p_notification_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized';
  end if;

  update public.notifications
  set is_read = true
  where id = p_notification_id and user_id = p_user_id;
end;
$$;

revoke all on function public.mark_notification_read(uuid, uuid) from public;
grant execute on function public.mark_notification_read(uuid, uuid) to authenticated;

create function public.mark_all_notifications_read(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized';
  end if;

  update public.notifications
  set is_read = true
  where user_id = p_user_id and not is_read;
end;
$$;

revoke all on function public.mark_all_notifications_read(uuid) from public;
grant execute on function public.mark_all_notifications_read(uuid) to authenticated;

-- ── DMs: notify the OTHER participant on every new message ────────────
-- Covers staff warning DMs too, for free — send_staff_message (0029)
-- inserts into dm_messages directly, so this fires for those exactly the
-- same as a player-to-player message.
create function public.notify_on_dm_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipient_id uuid;
begin
  select case when user_one_id = new.sender_id then user_two_id else user_one_id end
  into v_recipient_id
  from public.dm_conversations
  where id = new.conversation_id;

  insert into public.notifications (user_id, type, actor_id, target_label, link)
  values (v_recipient_id, 'dm', new.sender_id, left(new.body, 80), '/messages/' || new.conversation_id);

  return new;
end;
$$;

create trigger notify_on_dm_message
  after insert on public.dm_messages
  for each row execute function public.notify_on_dm_message();

-- ── Forum replies: notify the thread's author ──────────────────────────
-- forum_threads.reply_count counts the opening post too (see 0021), so
-- this also fires for it — skipped via the author-mismatch check, which
-- naturally covers both "this is your own thread's first post" and "you
-- replied to your own thread" without a separate case for either.
create function public.notify_on_forum_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_thread record;
begin
  select category_id, title, author_id into v_thread
  from public.forum_threads
  where id = new.thread_id;

  if v_thread.author_id is distinct from new.author_id then
    insert into public.notifications (user_id, type, actor_id, target_label, link)
    values (
      v_thread.author_id,
      'forum_reply',
      new.author_id,
      v_thread.title,
      '/forums/' || v_thread.category_id || '/' || new.thread_id
    );
  end if;

  return new;
end;
$$;

create trigger notify_on_forum_reply
  after insert on public.forum_posts
  for each row execute function public.notify_on_forum_reply();

-- ── Trades: offer received, then accepted/declined ─────────────────────
-- Trading is currently hidden behind TRADING_ENABLED (config.ts) — a
-- view-layer flag only, the trades schema/RPCs underneath are untouched
-- and fully intact — so these triggers are dormant in practice right
-- now, not unreachable, and cost nothing to keep wired up for whenever
-- the flag flips back on.
create function public.notify_on_trade_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, actor_id, link)
  values (new.recipient_id, 'trade_offer', new.initiator_id, '/trades/' || new.id);

  return new;
end;
$$;

create trigger notify_on_trade_created
  after insert on public.trades
  for each row execute function public.notify_on_trade_created();

create function public.notify_on_trade_response()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'pending' and new.status in ('completed', 'declined') then
    insert into public.notifications (user_id, type, actor_id, target_label, link)
    values (new.initiator_id, 'trade_response', new.recipient_id, new.status::text, '/trades/' || new.id);
  end if;

  return new;
end;
$$;

create trigger notify_on_trade_response
  after update on public.trades
  for each row execute function public.notify_on_trade_response();

-- ── Marketplace: a listing sells, or expires unsold ────────────────────
-- One trigger covers both transitions (active -> sold, active ->
-- expired) — buy_listing and resolve_expired_listings (0018/0019) both
-- just flip marketplace_listings.status, so a single AFTER UPDATE
-- trigger catches either path regardless of which RPC caused it, same
-- "trigger, not N call sites" reasoning as every other notify_on_*
-- function here.
create function public.notify_on_marketplace_listing_resolved()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_label text;
begin
  if old.status = 'active' and new.status in ('sold', 'expired') then
    if new.listing_type = 'pet' then
      v_label := coalesce(new.pet_custom_name, new.pet_species_name);
    else
      select name into v_label from public.items where id = new.item_id;
    end if;

    insert into public.notifications (user_id, type, actor_id, target_label, link)
    values (
      new.seller_id,
      case when new.status = 'sold' then 'marketplace_sold' else 'marketplace_expired' end::public.notification_type,
      case when new.status = 'sold' then new.buyer_id else null end,
      v_label,
      '/marketplace/mine'
    );
  end if;

  return new;
end;
$$;

create trigger notify_on_marketplace_listing_resolved
  after update on public.marketplace_listings
  for each row execute function public.notify_on_marketplace_listing_resolved();

-- ── Bans: notify the banned player ──────────────────────────────────────
create function public.notify_on_ban_issued()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, actor_id, target_label, link)
  values (new.user_id, 'ban_issued', new.issued_by, new.ban_type::text, '/profile');

  return new;
end;
$$;

create trigger notify_on_ban_issued
  after insert on public.bans
  for each row execute function public.notify_on_ban_issued();

-- ── Reports: notify every current staff member ──────────────────────────
-- The one fan-out case here — unlike every other event above, there's no
-- single recipient, so this inserts one row per current moderator/admin
-- rather than one row total. Staff rosters are small on a hobby-project
-- scale, so this is cheap; revisit if that ever stops being true.
create function public.notify_on_report_filed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, actor_id, target_label, link)
  select id, 'report_filed', new.reporter_id, new.category, '/mod/reports'
  from public.users
  where is_admin or is_moderator;

  return new;
end;
$$;

create trigger notify_on_report_filed
  after insert on public.reports
  for each row execute function public.notify_on_report_filed();
