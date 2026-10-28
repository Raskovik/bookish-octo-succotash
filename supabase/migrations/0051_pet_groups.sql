-- Extends pet_folders (0012) into "Groups" — a color tag + a BBCode bio
-- per group, a 12-group cap, and a tighter 20-character name limit — to
-- match the new /pets design, plus a bulk pet-move RPC (the Groups page
-- supports moving many pets at once via multi-select/drag-and-drop,
-- where move_pet_to_folder (0012) only ever handled one).
--
-- The table keeps its name and its "plain RLS-gated client CRUD, no RPC"
-- convention from 0012 — color/bio/sort_order are exactly as sensitive
-- as name was, so update/delete/insert on pet_folders still go straight
-- through RLS. Only the pets-table side still needs a security-definer
-- RPC, same reasoning as move_pet_to_folder: pets has no client UPDATE
-- policy at all.

alter table public.pet_folders
  add column color text not null default 'leaf'
    check (color in ('leaf', 'blue', 'orange', 'rose', 'plum')),
  add column bio text not null default '' check (char_length(bio) <= 500),
  add column sort_order integer not null default 0;

-- Tighten the name cap from 60 to 20 to match the new design (groups are
-- shown as small wood tabs with limited width).
alter table public.pet_folders drop constraint pet_folders_name_check;
alter table public.pet_folders add constraint pet_folders_name_check
  check (char_length(name) between 1 and 20);

-- Cap at 12 groups per player — enforced server-side (not just in the
-- UI) since creation goes straight through RLS with no RPC to gate it.
create function public.enforce_pet_folder_limit()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from public.pet_folders where owner_id = new.owner_id) >= 12 then
    raise exception 'You can only have up to 12 groups.';
  end if;
  return new;
end;
$$;

create trigger pet_folders_limit_trigger
  before insert on public.pet_folders
  for each row execute function public.enforce_pet_folder_limit();

-- Bulk version of move_pet_to_folder (0012): move every pet in
-- p_pet_ids to p_folder_id (or Unsorted, when null) in one call, for the
-- new design's multi-select/drag-and-drop bulk move + undo. Same
-- ownership checks as the single-pet RPC, just over an array; raises if
-- any requested pet isn't actually owned by p_user_id rather than
-- silently moving a partial set.
create function public.move_pets_to_folder(p_user_id uuid, p_pet_ids uuid[], p_folder_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  moved_count integer;
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized';
  end if;

  if p_folder_id is not null and not exists (
    select 1 from public.pet_folders where id = p_folder_id and owner_id = p_user_id
  ) then
    raise exception 'Folder not found';
  end if;

  update public.pets
  set folder_id = p_folder_id
  where id = any(p_pet_ids) and owner_id = p_user_id;

  get diagnostics moved_count = row_count;

  if moved_count <> coalesce(array_length(p_pet_ids, 1), 0) then
    raise exception 'One or more pets not found';
  end if;
end;
$$;

revoke all on function public.move_pets_to_folder(uuid, uuid[], uuid) from public;
grant execute on function public.move_pets_to_folder(uuid, uuid[], uuid) to authenticated;
