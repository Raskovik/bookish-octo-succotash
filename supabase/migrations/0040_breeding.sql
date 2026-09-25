-- Breeding: the nest -> egg -> hatch loop (Section 5 of the breeding
-- spec doc). Same lazy-resolve, in_progress -> awaiting_claim ->
-- completed shape as expeditions/brewing — reuses brew_status (its 3
-- values already mean exactly this) rather than defining a near-
-- identical new enum.
--
-- Judgment calls on the doc's own open design questions (Section 9),
-- since it explicitly says these need an answer before this can be
-- built and doesn't lock in defaults for all of them:
--  - Coin cost: flat 200 coins (not escalating, doesn't scale with
--    parent rarity or breed count) — the doc explicitly flags this as
--    undecided and a flat cost is the simplest starting point.
--  - Breeding timer: fixed 3 minutes, exactly as the doc itself proposes.
--  - Inheritance split: 45% parent A / 45% parent B / 10% mutate per
--    slot, exactly as the doc itself proposes.
--  - Cross-breed: same-breed-only for v1, exactly as the doc itself
--    assumes.
--  - A bred pet's custom_name: left null (blank/"Unnamed"), matching the
--    existing Chicken-Smoothie-style convention every other new pet in
--    this codebase already follows (custom_name is set later via
--    PetNameEditor, never at creation time).

create table public.breeding_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  pet_a_id uuid not null references public.pets (id),
  pet_b_id uuid not null references public.pets (id),
  status public.brew_status not null default 'in_progress',
  started_at timestamptz not null default now(),
  resolves_at timestamptz not null,
  -- Rolled once, at resolve time (same "the roll happens now, not at
  -- claim time" rule expeditions already follow) — parked here pending
  -- the player's keep/release choice via claim_egg.
  pending_breed_id uuid references public.breeds (id),
  pending_primary_color_id uuid references public.colors (id),
  pending_secondary_color_id uuid references public.colors (id),
  pending_tertiary_color_id uuid references public.colors (id),
  pending_pattern_id uuid references public.patterns (id),
  pending_eye_type_id uuid references public.eye_types (id),
  pending_gender text check (pending_gender is null or pending_gender in ('male', 'female')),
  result_pet_id uuid references public.pets (id),
  created_at timestamptz not null default now()
);

create index breeding_attempts_user_status_idx on public.breeding_attempts (user_id, status, resolves_at);

alter table public.breeding_attempts enable row level security;

create policy "Users can view own breeding attempts"
  on public.breeding_attempts for select
  using (auth.uid() = user_id);

-- No insert/update policies: only the security-definer functions below
-- ever write this table.

-- ── Start a breeding attempt ─────────────────────────────────────────
create function public.start_breeding(p_user_id uuid, p_pet_a_id uuid, p_pet_b_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_breed_a uuid;
  v_breed_b uuid;
  v_gender_a text;
  v_gender_b text;
  v_coin_balance integer;
  v_cost integer := 200;
  v_attempt_id uuid;
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized.';
  end if;

  if p_pet_a_id = p_pet_b_id then
    raise exception 'A pet can''t breed with itself.';
  end if;

  select breed_id, gender into v_breed_a, v_gender_a
  from public.pets where id = p_pet_a_id and owner_id = p_user_id for update;
  if not found then
    raise exception 'Pet not found.';
  end if;

  select breed_id, gender into v_breed_b, v_gender_b
  from public.pets where id = p_pet_b_id and owner_id = p_user_id for update;
  if not found then
    raise exception 'Pet not found.';
  end if;

  if v_breed_a is null or v_breed_b is null then
    raise exception 'Legacy pets can''t breed yet.';
  end if;

  if v_breed_a is distinct from v_breed_b then
    raise exception 'Both pets must be the same breed to breed together.';
  end if;

  if v_gender_a is null or v_gender_b is null or v_gender_a = v_gender_b then
    raise exception 'Breeding needs one male and one female pet.';
  end if;

  if exists (
    select 1 from public.breeding_attempts
    where (pet_a_id in (p_pet_a_id, p_pet_b_id) or pet_b_id in (p_pet_a_id, p_pet_b_id))
      and status in ('in_progress', 'awaiting_claim')
  ) then
    raise exception 'One of these pets already has a pending breeding attempt.';
  end if;

  if exists (
    select 1 from public.expeditions
    where pet_id in (p_pet_a_id, p_pet_b_id) and status in ('in_progress', 'awaiting_claim')
  ) then
    raise exception 'One of these pets is busy on an expedition.';
  end if;

  select coin_balance into v_coin_balance from public.users where id = p_user_id for update;
  if v_coin_balance < v_cost then
    raise exception 'Not enough coins: breeding costs % coins, you have %', v_cost, v_coin_balance;
  end if;

  perform public.begin_trusted_user_write();
  update public.users set coin_balance = coin_balance - v_cost where id = p_user_id;

  insert into public.breeding_attempts (user_id, pet_a_id, pet_b_id, status, started_at, resolves_at)
  values (p_user_id, p_pet_a_id, p_pet_b_id, 'in_progress', now(), now() + interval '3 minutes')
  returning id into v_attempt_id;

  return v_attempt_id;
end;
$$;

revoke all on function public.start_breeding(uuid, uuid, uuid) from public;
grant execute on function public.start_breeding(uuid, uuid, uuid) to authenticated;

-- ── Resolve: roll the offspring's traits the moment the timer elapses ──
create function public.resolve_due_breeding(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt record;
  v_pet_a public.pets%rowtype;
  v_pet_b public.pets%rowtype;
  v_r numeric;
  v_primary uuid;
  v_secondary uuid;
  v_tertiary uuid;
  v_pattern uuid;
  v_eye uuid;
  v_gender text;
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized.';
  end if;

  for v_attempt in
    select id, pet_a_id, pet_b_id
    from public.breeding_attempts
    where user_id = p_user_id and status = 'in_progress' and resolves_at <= now()
    for update
  loop
    select * into v_pet_a from public.pets where id = v_attempt.pet_a_id;
    select * into v_pet_b from public.pets where id = v_attempt.pet_b_id;

    -- Per slot, independently: 45% parent A, 45% parent B, 10% mutate
    -- (roll a fresh value from the breed's full pool, weighted by
    -- rarity_tier) — mutation is the only path to a trait not already
    -- present in either parent.
    v_r := random();
    v_primary := case when v_r < 0.45 then v_pet_a.primary_color_id
                       when v_r < 0.90 then v_pet_b.primary_color_id
                       else public.roll_wild_color() end;

    v_r := random();
    v_secondary := case when v_r < 0.45 then v_pet_a.secondary_color_id
                         when v_r < 0.90 then v_pet_b.secondary_color_id
                         else public.roll_wild_color() end;

    v_r := random();
    v_tertiary := case when v_r < 0.45 then v_pet_a.tertiary_color_id
                        when v_r < 0.90 then v_pet_b.tertiary_color_id
                        else public.roll_wild_color() end;

    v_r := random();
    v_pattern := case when v_r < 0.45 then v_pet_a.pattern_id
                       when v_r < 0.90 then v_pet_b.pattern_id
                       else public.roll_wild_pattern(v_pet_a.breed_id) end;

    v_r := random();
    v_eye := case when v_r < 0.45 then v_pet_a.eye_type_id
                  when v_r < 0.90 then v_pet_b.eye_type_id
                  else public.roll_wild_eye_type(v_pet_a.breed_id) end;

    v_gender := case when random() < 0.5 then 'male' else 'female' end;

    update public.breeding_attempts
    set status = 'awaiting_claim',
      pending_breed_id = v_pet_a.breed_id,
      pending_primary_color_id = v_primary,
      pending_secondary_color_id = v_secondary,
      pending_tertiary_color_id = v_tertiary,
      pending_pattern_id = v_pattern,
      pending_eye_type_id = v_eye,
      pending_gender = v_gender
    where id = v_attempt.id;
  end loop;
end;
$$;

revoke all on function public.resolve_due_breeding(uuid) from public;
grant execute on function public.resolve_due_breeding(uuid) to authenticated;

-- ── Claim: keep (creates the pet) or release ────────────────────────────
create function public.claim_egg(p_user_id uuid, p_attempt_id uuid, p_keep boolean)
returns uuid -- the newly granted pet's id, if kept; null otherwise
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt record;
  v_den_size integer;
  v_pet_count integer;
  v_rarity public.rarity_tier;
  v_new_pet_id uuid;
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized.';
  end if;

  select * into v_attempt
  from public.breeding_attempts
  where id = p_attempt_id and user_id = p_user_id and status = 'awaiting_claim'
  for update;

  if not found then
    raise exception 'No egg waiting to be claimed for this attempt.';
  end if;

  if p_keep then
    select den_size into v_den_size from public.users where id = p_user_id;
    select count(*) into v_pet_count from public.pets where owner_id = p_user_id;

    if v_pet_count >= v_den_size then
      raise exception 'Your den is full — expand it or release this egg instead.';
    end if;

    v_rarity := public.effective_pet_rarity(
      v_attempt.pending_primary_color_id, v_attempt.pending_secondary_color_id,
      v_attempt.pending_tertiary_color_id, v_attempt.pending_pattern_id, v_attempt.pending_eye_type_id
    );

    insert into public.pets (
      owner_id, rarity, breed_id, primary_color_id, secondary_color_id, tertiary_color_id,
      pattern_id, eye_type_id, gender, parent_a_id, parent_b_id
    ) values (
      p_user_id, v_rarity, v_attempt.pending_breed_id,
      v_attempt.pending_primary_color_id, v_attempt.pending_secondary_color_id, v_attempt.pending_tertiary_color_id,
      v_attempt.pending_pattern_id, v_attempt.pending_eye_type_id, v_attempt.pending_gender,
      v_attempt.pet_a_id, v_attempt.pet_b_id
    )
    returning id into v_new_pet_id;
  end if;

  update public.breeding_attempts
  set status = 'completed', result_pet_id = v_new_pet_id
  where id = p_attempt_id;

  return v_new_pet_id;
end;
$$;

revoke all on function public.claim_egg(uuid, uuid, boolean) from public;
grant execute on function public.claim_egg(uuid, uuid, boolean) to authenticated;
