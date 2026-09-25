-- Storage bucket for server-composited pet images (Section 3 of the
-- breeding spec doc). Same public-bucket shape as game-images (0010) and
-- avatars (0025), but the writer here is a PLAYER's own session (the
-- compositor runs in Next.js, not Postgres — see src/lib/pet-compositor.ts
-- — so it has no service-role credential to bypass RLS with; it uploads
-- through the normal authenticated client, same as avatar uploads do).
--
-- Deliberate deviation from the spec doc's literal cache-key design
-- ("cache key = the trait combination itself, not the pet id... two pets
-- that happen to roll the exact same traits reuse the same composited
-- file"): that would require a public, unscoped write path keyed only by
-- a hash of the traits, which any signed-in player could then overwrite
-- for ANY trait combination — including one they don't own a pet of —
-- since RLS can gate a bucket/path pattern but can't verify the uploaded
-- bytes are actually a genuine composite. That's a real content-safety
-- hole (upload something offensive to a popular trait combo's shared
-- file, and it displays for every player who has or later rolls that
-- combo), not a hypothetical one. So writes are scoped by owner instead,
-- same as avatars: pets/<owner_id>/<hash>.png. The hash-as-filename part
-- of the design is kept (a re-composite of the same trait combo for the
-- same owner is still a cheap upsert), just not shared cross-player.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'composited-pets',
  'composited-pets',
  true,
  5242880, -- 5 MiB
  array['image/png']
)
on conflict (id) do nothing;

create policy "Anyone can view composited pet images"
  on storage.objects for select
  using (bucket_id = 'composited-pets');

create policy "Users can upload their own pet composites"
  on storage.objects for insert
  with check (
    bucket_id = 'composited-pets'
    and (storage.foldername(name))[1] = 'pets'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "Users can replace their own pet composites"
  on storage.objects for update
  using (
    bucket_id = 'composited-pets'
    and (storage.foldername(name))[1] = 'pets'
    and (storage.foldername(name))[2] = auth.uid()::text
  )
  with check (
    bucket_id = 'composited-pets'
    and (storage.foldername(name))[1] = 'pets'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- A separate, admin-only path for the "preview a random pet" tool
-- (Section 6 of the spec doc) — not tied to any owned pet, so it can't
-- use the owner-scoped policy above.
create policy "Admins can upload preview composites"
  on storage.objects for insert
  with check (
    bucket_id = 'composited-pets'
    and (storage.foldername(name))[1] = 'previews'
    and public.current_user_is_admin()
  );

create policy "Admins can replace preview composites"
  on storage.objects for update
  using (
    bucket_id = 'composited-pets'
    and (storage.foldername(name))[1] = 'previews'
    and public.current_user_is_admin()
  )
  with check (
    bucket_id = 'composited-pets'
    and (storage.foldername(name))[1] = 'previews'
    and public.current_user_is_admin()
  );
