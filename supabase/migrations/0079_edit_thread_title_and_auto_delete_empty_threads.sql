-- 1. A thread's title has only ever been staff-editable (updateThreadFlags,
--    forum_threads' staff-only UPDATE policy, 0027) — the player's own
--    call: when they're editing their thread's FIRST post (the one that
--    created it), they should be able to fix the title too, same as any
--    other forum where editing your own opening post lets you retitle
--    the thread. Kept as its own narrow RPC rather than widening
--    forum_threads' UPDATE RLS policy to "author or staff" — that would
--    also hand authors is_pinned/is_locked, which must stay staff-only.
--    Scoped tightly: only the post's own author, and only when that post
--    is actually the thread's first (earliest) one — editing your own
--    reply never lets you retitle someone else's thread.
create function public.rename_thread_for_first_post(
  p_user_id uuid,
  p_thread_id uuid,
  p_post_id uuid,
  p_title text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post_author_id uuid;
  v_post_thread_id uuid;
  v_first_post_id uuid;
  v_title text;
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized.';
  end if;

  select author_id, thread_id into v_post_author_id, v_post_thread_id
  from public.forum_posts
  where id = p_post_id;

  if not found or v_post_thread_id <> p_thread_id then
    raise exception 'Post not found.';
  end if;

  if v_post_author_id <> p_user_id then
    raise exception 'You can only retitle a thread from your own first post.';
  end if;

  select id into v_first_post_id
  from public.forum_posts
  where thread_id = p_thread_id
  order by created_at
  limit 1;

  if v_first_post_id <> p_post_id then
    raise exception 'Only the thread''s first post can change its title.';
  end if;

  v_title := trim(coalesce(p_title, ''));
  if char_length(v_title) = 0 then
    raise exception 'Title can''t be empty.';
  end if;
  if char_length(v_title) > 200 then
    raise exception 'Title must be 200 characters or fewer.';
  end if;

  update public.forum_threads set title = v_title where id = p_thread_id;
end;
$$;

-- 2. A thread that loses its last post (whether a player or a moderator
--    deleted it — see "Staff can delete posts", 0027; this trigger fires
--    on the delete regardless of who performed it) is just dead, empty
--    clutter in the category listing. Extends sync_forum_thread_stats'
--    existing post-delete branch (0027) rather than a separate trigger,
--    since it already recomputes state from forum_posts for this exact
--    thread on every post delete.
create or replace function public.sync_forum_thread_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    update public.forum_threads
    set reply_count = reply_count + 1,
        last_post_at = new.created_at
    where id = new.thread_id;
    return new;
  else
    update public.forum_threads
    set reply_count = greatest(0, reply_count - 1),
        last_post_at = coalesce(
          (select max(created_at) from public.forum_posts where thread_id = old.thread_id),
          forum_threads.created_at
        )
    where id = old.thread_id;

    if not exists (select 1 from public.forum_posts where thread_id = old.thread_id) then
      delete from public.forum_threads where id = old.thread_id;
    end if;

    return old;
  end if;
end;
$$;
