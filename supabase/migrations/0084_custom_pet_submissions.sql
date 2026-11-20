-- Player-submitted custom pets ("models"): a player spends a special
-- item to design their own one-of-one model (name + breed + art),
-- which goes in immediately as a pet only they can see ("under
-- review"), and a mod approves or rejects it. Approved ones behave
-- like any other model except they're flagged custom, carry an
-- artist credit, and never get a model_number (that numbering stays
-- exclusively for the official catalog). Rejected ones are deleted
-- outright and the item is refunded, with the reason sent as a DM
-- from the staff account (reusing send_staff_message, 0029) rather
-- than inventing a second notification mechanism.

-- ── items: a new consumable type for the submission ticket ──────────────
alter type public.item_type add value 'custom_pet_ticket';

-- ── species: custom-model fields ─────────────────────────────────────────
-- model_number is already nullable (0068) — custom models simply never
-- get one, which is the whole numbering separation this needs.
alter table public.species
  add column is_custom boolean not null default false,
  add column artist_name text,
  add column artist_user_id uuid references public.users (id) on delete set null,
  add column review_status text not null default 'approved'
    check (review_status in ('pending', 'approved', 'rejected')),
  add column rejection_reason text,
  add constraint species_custom_not_starter
    check (not is_custom or not is_starter_option);

comment on column public.species.artist_name is
  'Displayed credit on the pet page for both official and custom models — a free-text name (not necessarily a player), set by an admin for official models and auto-filled from the submitter''s display_name for custom ones.';
comment on column public.species.artist_user_id is
  'Set only when the artist is a registered player (always true for custom submissions) — lets the credit link to their profile. Null for official art credited to a non-player.';
comment on column public.species.review_status is
  'Only meaningful when is_custom — ''approved'' by default for every official model so existing rows/queries need no backfill. A pending or rejected custom model is hidden from everyone but its owner and staff (see the species/pets select policies below).';

-- species.name is normally fully derived from model_number by this
-- trigger (0068) — stringified, or literally 'Custom' when there isn't
-- one, since 0068 never anticipated a model actually needing its own
-- freely-chosen name. A custom submission's name is exactly that kind
-- of freely-chosen name (the whole point of letting a player title
-- their own creation), so it needs to be the one case this trigger
-- leaves alone rather than overwriting.
create or replace function public.set_species_name_from_model_number()
returns trigger
language plpgsql
as $$
begin
  if new.is_custom then
    return new;
  end if;
  if new.model_number is null then
    new.name := 'Custom';
  else
    new.name := new.model_number::text;
  end if;
  return new;
end;
$$;

-- ── species/pets visibility: hide not-yet-approved customs ──────────────
-- The species and pets policies below each need to check the OTHER
-- table (species needs to know if the viewer owns a pet of it; pets
-- needs to know if its species is a hidden pending/rejected custom).
-- Querying the other table directly from inside a USING clause creates
-- mutual RLS recursion the moment both policies exist at once (species
-- policy evaluates pets RLS, which evaluates species RLS, ...). These
-- two SECURITY DEFINER helpers break the cycle the same way
-- current_user_is_moderator() (0027) already does for every other
-- cross-table policy in this app — as the function owner, they bypass
-- RLS on the table they query instead of re-triggering it.
create function public.owns_pet_of_species(p_species_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.pets where species_id = p_species_id and owner_id = auth.uid()
  );
$$;

create function public.species_is_hidden_custom(p_species_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.species
    where id = p_species_id and is_custom and review_status <> 'approved'
  );
$$;

-- Previously `using (true)` (0002) — every species was fully public.
drop policy "Species are viewable by everyone" on public.species;
create policy "Species are viewable by everyone, except pending/rejected customs"
  on public.species for select
  using (
    not is_custom
    or review_status = 'approved'
    or public.current_user_is_moderator()
    or public.owns_pet_of_species(id)
  );

-- Previously `using (true)` (0048) — every pet was fully public. Same
-- gating as the species policy above, applied from the pet's side too
-- (defense in depth: without this, a pending custom pet's row — owner,
-- created_at, etc. — would still be readable even with its species
-- hidden).
drop policy "Pets are viewable by everyone" on public.pets;
create policy "Pets are viewable by everyone, except pending/rejected customs"
  on public.pets for select
  using (
    owner_id = auth.uid()
    or public.current_user_is_moderator()
    or not public.species_is_hidden_custom(species_id)
  );

-- ── storage: players can upload their own submission's art ──────────────
-- game-images (0010) is otherwise admin-only. A player's upload is
-- insert-only (no update/delete policy for players) — a rejected
-- submission's file is simply abandoned, cheap orphaned storage, same
-- as this bucket already accepts for any other failed/abandoned upload.
-- Path convention: custom-pets/<species id>.<ext>, with that species id
-- client-generated ahead of calling submit_custom_pet below (so the
-- upload can happen before the row exists, avoiding any need for a
-- player-facing UPDATE policy on species.image_url).
create policy "Players can upload their own custom pet art"
  on storage.objects for insert
  with check (
    bucket_id = 'game-images'
    and (storage.foldername(name))[1] = 'custom-pets'
    and auth.role() = 'authenticated'
  );

-- ── submit_custom_pet: spend the ticket, create the pending model+pet ───
create function public.submit_custom_pet(
  p_user_id uuid,
  p_species_id uuid,
  p_ticket_item_id uuid,
  p_name text,
  p_breed_id uuid,
  p_image_url text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_display_name text;
  v_den_size integer;
  v_pet_count integer;
  v_ticket_quantity integer;
  v_ticket_type public.item_type;
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

  v_name := trim(coalesce(p_name, ''));
  if v_name !~ '^[A-Za-z0-9][A-Za-z0-9 ''\-]{1,29}$' then
    raise exception 'Model name must be 2 to 30 letters, numbers, spaces, hyphens or apostrophes.';
  end if;

  if not exists (select 1 from public.breeds where id = p_breed_id) then
    raise exception 'Pick a breed for your model.';
  end if;

  if p_image_url is null or char_length(trim(p_image_url)) = 0 then
    raise exception 'Upload art for your model first.';
  end if;

  select type, quantity into v_ticket_type, v_ticket_quantity
  from public.items
  join public.user_inventory on user_inventory.item_id = items.id
  where items.id = p_ticket_item_id and user_inventory.user_id = p_user_id
  for update of user_inventory;

  if v_ticket_type is distinct from 'custom_pet_ticket' then
    raise exception 'That item can''t be used to submit a custom model.';
  end if;
  if v_ticket_quantity is null or v_ticket_quantity < 1 then
    raise exception 'You don''t have that item.';
  end if;

  select count(*) into v_pet_count from public.pets where owner_id = p_user_id;
  if v_pet_count >= v_den_size then
    raise exception 'Your den is full — expand it or release a pet instead.';
  end if;

  update public.user_inventory
  set quantity = quantity - 1
  where user_id = p_user_id and item_id = p_ticket_item_id;

  insert into public.species
    (id, name, model_number, breed_id, image_url, is_custom, artist_name, artist_user_id, review_status)
  values
    (p_species_id, v_name, null, p_breed_id, p_image_url, true, v_display_name, p_user_id, 'pending');

  insert into public.pets (owner_id, species_id)
  values (p_user_id, p_species_id)
  returning id into v_pet_id;

  return v_pet_id;
end;
$$;

revoke all on function public.submit_custom_pet(uuid, uuid, uuid, text, uuid, text) from public;
grant execute on function public.submit_custom_pet(uuid, uuid, uuid, text, uuid, text) to authenticated;

-- ── approve_custom_pet ───────────────────────────────────────────────────
create function public.approve_custom_pet(p_species_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.current_user_is_moderator() then
    raise exception 'Not authorized.';
  end if;

  update public.species
  set review_status = 'approved', rejection_reason = null
  where id = p_species_id and is_custom and review_status = 'pending';

  if not found then
    raise exception 'That submission is not awaiting review.';
  end if;
end;
$$;

revoke all on function public.approve_custom_pet(uuid) from public;
grant execute on function public.approve_custom_pet(uuid) to authenticated;

-- ── reject_custom_pet ────────────────────────────────────────────────────
-- Refunds one custom_pet_ticket item to the submitter (whichever item of
-- that type exists — there's exactly one, admin-managed like any other
-- item), DMs them the reason via the staff account, then deletes the
-- pending pet and its one-off species row outright.
create function public.reject_custom_pet(p_species_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_ticket_item_id uuid;
  v_reason text;
begin
  if not public.current_user_is_moderator() then
    raise exception 'Not authorized.';
  end if;

  v_reason := trim(coalesce(p_reason, ''));
  if v_reason = '' then
    raise exception 'Give a reason for the player.';
  end if;

  select owner_id into v_owner_id
  from public.pets
  where species_id = p_species_id
  limit 1;

  if v_owner_id is null then
    raise exception 'That submission is not awaiting review.';
  end if;

  if not exists (
    select 1 from public.species
    where id = p_species_id and is_custom and review_status = 'pending'
  ) then
    raise exception 'That submission is not awaiting review.';
  end if;

  select id into v_ticket_item_id from public.items where type = 'custom_pet_ticket' limit 1;

  if v_ticket_item_id is not null then
    insert into public.user_inventory (user_id, item_id, quantity)
    values (v_owner_id, v_ticket_item_id, 1)
    on conflict (user_id, item_id) do update
      set quantity = public.user_inventory.quantity + 1;
  end if;

  perform public.send_staff_message(
    v_owner_id,
    'Your custom model submission wasn''t approved: ' || v_reason || ' You can submit again with a new piece.'
  );

  delete from public.pets where species_id = p_species_id;
  delete from public.species where id = p_species_id;
end;
$$;

revoke all on function public.reject_custom_pet(uuid, text) from public;
grant execute on function public.reject_custom_pet(uuid, text) to authenticated;
