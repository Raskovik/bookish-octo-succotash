-- Lets a player clear (delete, not just mark read) their own
-- notifications — the bell dropdown's "mark all read" only ever flips
-- is_read (0044_notifications.sql); this adds the delete-backed
-- counterpart. notifications has no delete policy for plain clients
-- (see its table comment) — same reasoning as mark_notification_read
-- needing security definer: a player must only ever be able to touch
-- their OWN rows, enforced here rather than via a raw DELETE policy.
create function public.clear_notification(p_user_id uuid, p_notification_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized';
  end if;

  delete from public.notifications
  where id = p_notification_id and user_id = p_user_id;
end;
$$;

revoke all on function public.clear_notification(uuid, uuid) from public;
grant execute on function public.clear_notification(uuid, uuid) to authenticated;

create function public.clear_all_notifications(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized';
  end if;

  delete from public.notifications
  where user_id = p_user_id;
end;
$$;

revoke all on function public.clear_all_notifications(uuid) from public;
grant execute on function public.clear_all_notifications(uuid) to authenticated;
