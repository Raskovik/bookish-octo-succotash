-- admin_delete_account (0072) was still blocked by admin_audit_log's
-- restrict-on-delete FK whenever the target account had taken any
-- admin action — including the admin's own account, the exact case
-- hit while testing account deletion itself. Per the player's own
-- call: for now (testing only, to be revisited/removed later), deleting
-- an account also deletes its own audit log entries rather than being
-- blocked by them. Every other restrict-on-delete FK onto users (bans.
-- issued_by, forum_posts.author_id, site_news_posts.author_id, …) is
-- left exactly as-is — this only touches admin_audit_log, the one that
-- was actually hit.
alter table public.admin_audit_log
  drop constraint admin_audit_log_admin_user_id_fkey,
  add constraint admin_audit_log_admin_user_id_fkey
    foreign key (admin_user_id) references public.users (id) on delete cascade;
