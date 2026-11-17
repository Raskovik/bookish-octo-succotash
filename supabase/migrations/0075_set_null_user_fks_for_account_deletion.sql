-- admin_delete_account (0072) kept hitting a different restrict-on-
-- delete foreign key every time it was tried on another real test
-- account — first admin_audit_log (fixed by cascading it away in
-- 0073, since it's just the deleted admin's own log), now
-- reports.target_post_author_id for an account that had been reported.
-- Rather than keep whack-a-moling each one as it's hit, this sweeps
-- every remaining restrict-on-delete FK onto users(id) at once.
--
-- Unlike admin_audit_log (which only ever contains rows ABOUT the
-- account itself, so cascading loses nothing but its own log), every FK
-- here is a reference FROM a row that can be about, or belong to,
-- someone else entirely — a report about a different player, a staff
-- note about a different player, a forum thread other people replied
-- to, a ban record, a site news post. Deleting those rows outright
-- (cascade) would destroy real content/history that has nothing to do
-- with the account being removed. So these all become "on delete set
-- null" instead — standard "deleted user" forum convention: the row
-- survives, it just loses the dangling attribution to an account that
-- no longer exists. Each affected column is made nullable first where
-- it wasn't already.
alter table public.forum_threads alter column author_id drop not null;
alter table public.forum_threads
  drop constraint forum_threads_author_id_fkey,
  add constraint forum_threads_author_id_fkey
    foreign key (author_id) references public.users (id) on delete set null;

alter table public.forum_posts alter column author_id drop not null;
alter table public.forum_posts
  drop constraint forum_posts_author_id_fkey,
  add constraint forum_posts_author_id_fkey
    foreign key (author_id) references public.users (id) on delete set null;

alter table public.forum_posts
  drop constraint forum_posts_last_edited_by_fkey,
  add constraint forum_posts_last_edited_by_fkey
    foreign key (last_edited_by) references public.users (id) on delete set null;

alter table public.reports
  drop constraint reports_resolved_by_fkey,
  add constraint reports_resolved_by_fkey
    foreign key (resolved_by) references public.users (id) on delete set null;

alter table public.reports
  drop constraint reports_target_post_author_id_fkey,
  add constraint reports_target_post_author_id_fkey
    foreign key (target_post_author_id) references public.users (id) on delete set null;

alter table public.reports
  drop constraint reports_target_message_sender_id_fkey,
  add constraint reports_target_message_sender_id_fkey
    foreign key (target_message_sender_id) references public.users (id) on delete set null;

alter table public.reports
  drop constraint reports_claimed_by_fkey,
  add constraint reports_claimed_by_fkey
    foreign key (claimed_by) references public.users (id) on delete set null;

alter table public.bans alter column issued_by drop not null;
alter table public.bans
  drop constraint bans_issued_by_fkey,
  add constraint bans_issued_by_fkey
    foreign key (issued_by) references public.users (id) on delete set null;

alter table public.bans
  drop constraint bans_lifted_by_fkey,
  add constraint bans_lifted_by_fkey
    foreign key (lifted_by) references public.users (id) on delete set null;

-- player_notes.user_id (the note's SUBJECT) already cascades — deleting
-- who the note is ABOUT correctly deletes the note. author_id (who
-- WROTE it) did not: deleting the staff member who wrote a note about a
-- still-existing, unrelated player must not delete that note.
alter table public.player_notes alter column author_id drop not null;
alter table public.player_notes
  drop constraint player_notes_author_id_fkey,
  add constraint player_notes_author_id_fkey
    foreign key (author_id) references public.users (id) on delete set null;

alter table public.site_news_posts alter column author_id drop not null;
alter table public.site_news_posts
  drop constraint site_news_posts_author_id_fkey,
  add constraint site_news_posts_author_id_fkey
    foreign key (author_id) references public.users (id) on delete set null;

alter table public.marketplace_listings
  drop constraint marketplace_listings_buyer_id_fkey,
  add constraint marketplace_listings_buyer_id_fkey
    foreign key (buyer_id) references public.users (id) on delete set null;
