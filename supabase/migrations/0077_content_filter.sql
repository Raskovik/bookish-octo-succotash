-- Global text filter: rejects any insert/update that contains a banned
-- word/phrase or a banned link, across every player-facing (and
-- staff-facing) free-text field in the app — usernames, bios, pet
-- names/bios, group names/bios, forum threads/posts, DMs, trade notes,
-- site news, canned staff messages, ban reasons, and staff notes about
-- a player. Enforced at the TABLE level via triggers, not inside
-- individual RPCs — that's deliberate: it guarantees every current and
-- future write path is covered (including pet_folders/groups, which
-- have always gone straight through RLS with no RPC in between at
-- all — see 0012/0051), rather than relying on remembering to add a
-- check to every RPC that touches text.
--
-- Explicitly NOT filtered: reports.details (a player's own report
-- description) — a player reporting harassment or a slur needs to be
-- able to describe or quote exactly what happened. Reports are
-- staff-only, never shown publicly.
--
-- ── Admin-managed lists ──────────────────────────────────────────────────
create table public.banned_phrases (
  id uuid primary key default gen_random_uuid(),
  phrase text not null unique check (char_length(phrase) between 1 and 100),
  created_at timestamptz not null default now()
);

create table public.banned_domains (
  id uuid primary key default gen_random_uuid(),
  domain text not null unique check (char_length(domain) between 1 and 200),
  created_at timestamptz not null default now()
);

alter table public.banned_phrases enable row level security;
alter table public.banned_domains enable row level security;

-- Admin-only both ways (not public-select like zones/items/breeds) —
-- showing players the exact banned list makes evasion trivial, and
-- nothing else ever needs to read these directly: enforcement goes
-- through assert_clean_text() below, which is security definer and so
-- bypasses this regardless of who triggered the check.
create policy "Admins can manage banned phrases"
  on public.banned_phrases for all
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

create policy "Admins can manage banned domains"
  on public.banned_domains for all
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

create trigger audit_banned_phrases
  after insert or update or delete on public.banned_phrases
  for each row execute function public.log_admin_action();

create trigger audit_banned_domains
  after insert or update or delete on public.banned_domains
  for each row execute function public.log_admin_action();

-- Starter seed — common profanity/slurs. Admin can add to or remove
-- from this list any time from /admin/content-filter; nothing here
-- needs a code deploy to change.
insert into public.banned_phrases (phrase) values
  ('fuck'), ('shit'), ('bitch'), ('asshole'), ('bastard'), ('cunt'),
  ('dick'), ('piss'), ('cock'), ('pussy'), ('whore'), ('slut'),
  ('nigger'), ('nigga'), ('faggot'), ('fag'), ('retard'), ('tranny'),
  ('rape'), ('porn'), ('nazi')
on conflict (phrase) do nothing;

insert into public.banned_domains (domain) values
  ('bit.ly'), ('tinyurl.com'), ('discord.gg'), ('pornhub.com'), ('xvideos.com'), ('onlyfans.com')
on conflict (domain) do nothing;

-- ── Matching ──────────────────────────────────────────────────────────
-- Lowercases, maps common leetspeak substitutions (0->o, 1->i, 3->e,
-- 4->a, 5->s, 7->t, 8->b, 9->g, @->a, $->s, !->i, |->i), then strips
-- every remaining non-alphanumeric character (including spaces) —
-- "s.h.i.t", "s h i t" and "5h1t" all normalize to the same token as
-- "shit". Banned phrases are normalized the same way before matching,
-- so a multi-word banned phrase doesn't need its own separate word-
-- boundary handling — it's just a substring check at that point.
--
-- This is a known-limited approach (the classic "Scunthorpe problem":
-- a short banned fragment can appear inside an innocent word, e.g.
-- banning "ass" would also catch "assassin" or "class" once spaces are
-- stripped) — admins curating the list should prefer whole words/
-- longer phrases over short fragments. No simple filter is unbeatable;
-- this catches casual evasion (spacing, punctuation, basic leetspeak),
-- not every possible trick.
create function public.normalize_for_filter(p_text text)
returns text
language sql
immutable
as $$
  select regexp_replace(
    translate(lower(p_text), '01345789@$!|', 'oieastbgasii'),
    '[^a-z0-9]+', '', 'g'
  );
$$;

-- Raises on a match; a silent no-op on null/blank input or a clean
-- string. security definer so it (and the trigger below that calls it)
-- can read banned_phrases/banned_domains regardless of the admin-only
-- RLS above — every caller needs this check to run, not just admins.
create function public.assert_clean_text(p_text text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_normalized text;
  v_hit boolean;
begin
  if p_text is null or trim(p_text) = '' then
    return;
  end if;

  v_normalized := public.normalize_for_filter(p_text);
  if v_normalized = '' then
    return;
  end if;

  select exists (
    select 1 from public.banned_phrases
    where position(public.normalize_for_filter(phrase) in v_normalized) > 0
  ) into v_hit;
  if v_hit then
    raise exception 'That text contains a word or phrase that isn''t allowed.';
  end if;

  select exists (
    select 1 from public.banned_domains
    where position(public.normalize_for_filter(domain) in v_normalized) > 0
  ) into v_hit;
  if v_hit then
    raise exception 'That text contains a link that isn''t allowed.';
  end if;
end;
$$;

-- Generic BEFORE INSERT OR UPDATE trigger: checks whichever columns are
-- named as trigger arguments (see each "create trigger ... execute
-- function public.enforce_text_filter('col1', 'col2')" below) against
-- NEW's actual values via to_jsonb, rather than needing a bespoke
-- trigger function per table.
create function public.enforce_text_filter()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_col text;
begin
  foreach v_col in array TG_ARGV loop
    perform public.assert_clean_text(to_jsonb(NEW) ->> v_col);
  end loop;
  return NEW;
end;
$$;

-- ── Attach to every free-text field in the app ──────────────────────────
create trigger filter_text
  before insert or update of display_name, bio on public.users
  for each row execute function public.enforce_text_filter('display_name', 'bio');

create trigger filter_text
  before insert or update of custom_name, bio on public.pets
  for each row execute function public.enforce_text_filter('custom_name', 'bio');

create trigger filter_text
  before insert or update of name, bio on public.pet_folders
  for each row execute function public.enforce_text_filter('name', 'bio');

create trigger filter_text
  before insert or update of title on public.forum_threads
  for each row execute function public.enforce_text_filter('title');

create trigger filter_text
  before insert or update of body_raw on public.forum_posts
  for each row execute function public.enforce_text_filter('body_raw');

create trigger filter_text
  before insert on public.dm_messages
  for each row execute function public.enforce_text_filter('body');

create trigger filter_text
  before insert or update of note on public.trades
  for each row execute function public.enforce_text_filter('note');

create trigger filter_text
  before insert or update of title, body on public.site_news_posts
  for each row execute function public.enforce_text_filter('title', 'body');

create trigger filter_text
  before insert or update of label, body on public.canned_staff_messages
  for each row execute function public.enforce_text_filter('label', 'body');

create trigger filter_text
  before insert or update of reason on public.bans
  for each row execute function public.enforce_text_filter('reason');

create trigger filter_text
  before insert or update of body on public.player_notes
  for each row execute function public.enforce_text_filter('body');

-- reports.details (the reporting player's own description) is
-- deliberately left out — only resolution_note (staff-written) is
-- filtered.
create trigger filter_text
  before insert or update of resolution_note on public.reports
  for each row execute function public.enforce_text_filter('resolution_note');
