-- First sign-in account setup: pick a username + picture, then adopt a
-- fixed starter pet. Replaces the old auto-random-starter-pet +
-- auto-tutorial-expedition flow (grant_starter_pet_and_tutorial) with an
-- explicit onboarding the player drives themselves.
--
-- Username is no longer auto-filled from the Google profile on signup —
-- a brand new account now starts with display_name = null, and
-- /welcome gates on that (null means "hasn't finished account setup
-- yet"). Nothing else reads display_name as "the google name"; the
-- design's wiring note says to redirect to /welcome "only when the
-- account has no username yet", which this makes literal.

-- ── display_name becomes nullable ───────────────────────────────────────
-- users_display_name_unique_idx (0014) is a unique index on
-- lower(display_name) — a plain index already allows unlimited NULL
-- rows (NULL <> NULL), so nothing else needs to change there.
alter table public.users alter column display_name drop not null;

-- New accounts no longer get a name generated for them (full_name/name/
-- email-prefix) — that's the whole point of the new "pick a username"
-- step. The old numeric-suffix collision avoidance this once had goes
-- away with it: there's nothing to collide with anymore since nothing
-- is auto-generated.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, google_sub, email, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'provider_id', new.raw_user_meta_data ->> 'sub'),
    new.email,
    null
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ── Starter species ──────────────────────────────────────────────────────
-- Two fixed options, same for every new player (no random roll, so
-- creating throwaway accounts can't be used to farm pets). Flagged via
-- is_starter_option rather than hardcoding species ids anywhere, so an
-- admin can add a third option later just by inserting another species
-- row with is_starter_option = true (per the design's own "adding more
-- starters is just a new card" note).
--
-- starter_label/starter_blurb are separate from species.name: name is
-- now the auto-derived model number (0068), not a friendly name, so
-- these carry the "Tundrie"/"Purra" flavor text instead. They're only
-- ever read for starter-option species.
alter table public.species
  add column is_starter_option boolean not null default false,
  add column starter_label text,
  add column starter_blurb text;

comment on column public.species.is_starter_option is
  'Offered as a first-pet choice on /welcome. Every new player sees exactly the species flagged here, in the same fixed order — never a random roll.';
comment on column public.species.starter_label is
  'Friendly display name shown on the starter-pet picker (species.name is just the model number now) — also the adopted pet''s default custom_name if the player leaves the name field blank.';
comment on column public.species.starter_blurb is
  'One-line flavor text shown on the starter-pet picker, alongside starter_label.';

insert into public.breeds (name) values ('Fox'), ('Cat') on conflict (name) do nothing;

insert into public.species (breed_id, image_url, is_active, is_starter_option, starter_label, starter_blurb)
values
  (
    (select id from public.breeds where name = 'Fox'),
    '/img/pets/tundrie.webp',
    true, true,
    'Tundrie',
    'A fluffy, curious snow fox who loves a good adventure.'
  ),
  (
    (select id from public.breeds where name = 'Cat'),
    '/img/pets/purra.webp',
    true, true,
    'Purra',
    'A bright, bouncy leaf cat with very twitchy antennae.'
  );

-- ── create_player_account ────────────────────────────────────────────────
-- Screen 0 of /welcome. One-time: rejects once display_name is already
-- set, same "finish setup once" shape as starter_granted below.
-- Username rules match the design exactly (3-16, letters/numbers/
-- underscore) — deliberately stricter than, and a separate RPC from,
-- change_display_name (0014's paid 15-gem/14-day-cooldown rename),
-- which keeps its own looser 3-40/no-charset rules unchanged.
create function public.create_player_account(
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

  update public.users
  set display_name = v_name,
      display_name_changed_at = now(),
      avatar_url = p_avatar_url
  where id = p_user_id;
end;
$$;

-- ── adopt_starter_pet ─────────────────────────────────────────────────────
-- Screen 1 of /welcome. One-time, reusing starter_granted (previously
-- the sole guard for grant_starter_pet_and_tutorial) as "has adopted
-- their chosen starter pet" instead. Requires the account step to be
-- done first (display_name set) — screen order is enforced server-side,
-- not just by the client hiding screen 1 until screen 0 finishes.
--
-- Rolls are hardcoded to 5/5/5 rather than the normal random 1-10
-- default (0045) — a deliberate, explicit exception: the player chose
-- this species, so it must not also hand them a random stat roll to
-- reroll-farm via repeat signups.
create function public.adopt_starter_pet(
  p_user_id uuid,
  p_species_id uuid,
  p_custom_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_display_name text;
  v_starter_label text;
  v_pet_count integer;
  v_den_size integer;
  v_name text;
  v_pet_id uuid;
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized.';
  end if;

  select display_name, den_size into v_display_name, v_den_size
  from public.users
  where id = p_user_id
  for update;

  if not found then
    raise exception 'Account not found.';
  end if;

  if v_display_name is null then
    raise exception 'Finish setting up your account first.';
  end if;

  select starter_label into v_starter_label
  from public.species
  where id = p_species_id and is_starter_option = true and is_active = true;

  if v_starter_label is null then
    raise exception 'That is not an available starter pet.';
  end if;

  v_name := nullif(trim(coalesce(p_custom_name, '')), '');
  if v_name is not null and v_name !~ '^[A-Za-z0-9][A-Za-z0-9 ''\-]{1,15}$' then
    raise exception 'Pet name must be 2 to 16 letters, numbers, spaces, hyphens or apostrophes.';
  end if;

  perform public.begin_trusted_user_write();
  update public.users
  set starter_granted = true
  where id = p_user_id and starter_granted = false;

  if not found then
    raise exception 'You have already adopted your starter pet.';
  end if;

  select count(*) into v_pet_count from public.pets where owner_id = p_user_id;
  if v_pet_count >= v_den_size then
    raise exception 'Your den is full — expand it or release a pet instead.';
  end if;

  insert into public.pets (owner_id, species_id, custom_name, roll_strength, roll_speed, roll_defence)
  values (p_user_id, p_species_id, coalesce(v_name, v_starter_label), 5, 5, 5)
  returning id into v_pet_id;

  return v_pet_id;
end;
$$;

-- ── Retire the old auto-grant ────────────────────────────────────────────
-- Superseded entirely by create_player_account + adopt_starter_pet above
-- (including the auto-started 10-minute tutorial expedition, which the
-- player now starts themselves from the map instead). is_tutorial zones
-- are left in place untouched — start_expedition already excludes them
-- from normal player trip selection, so they're simply unused now.
drop function if exists public.grant_starter_pet_and_tutorial(uuid);
