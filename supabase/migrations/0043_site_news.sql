-- Site news: short admin-authored posts shown on the homepage, next to
-- the recently-active-forums preview (both are read-only widgets — this
-- migration is just the news side; the forum-activity side reuses
-- forum_threads.last_post_at/reply_count, already maintained by
-- sync_forum_thread_stats, 0021_forums.sql).
--
-- body stores raw BBCode only (no body_html column) — same pattern as
-- pets.bio/users.bio (set_pet_bio, 0034_pet_bio.sql), not forum_posts'
-- store-both-raw-and-rendered-html shape. News posts are read far more
-- often than written and there's no editor-mode history to preserve, so
-- rendering via bbcodeToHtml() at read time (src/lib/bbcode.ts) avoids
-- a second column that could drift out of sync with the first.
create table public.site_news_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.users (id),
  title text not null check (char_length(title) between 1 and 200),
  body text not null check (char_length(body) between 1 and 10000),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  edited_at timestamptz
);

create index site_news_posts_created_at_idx on public.site_news_posts (created_at desc);

comment on column public.site_news_posts.is_active is
  'Same "deactivate rather than delete" convention as forum_categories/canned_staff_messages — an inactive post is hidden from the homepage but still visible to admins in /admin/news.';

alter table public.site_news_posts enable row level security;

create policy "Site news is viewable by everyone"
  on public.site_news_posts for select
  using (true);

create policy "Admins can insert site news"
  on public.site_news_posts for insert
  with check (public.current_user_is_admin());

create policy "Admins can update site news"
  on public.site_news_posts for update
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

-- No delete policy — same reasoning as forum_categories/items/species:
-- deactivate instead.

create trigger audit_site_news_posts
  after insert or update on public.site_news_posts
  for each row execute function public.log_admin_action();
