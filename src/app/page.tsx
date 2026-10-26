import { createClient } from "@/lib/supabase/server";
import { SiteNewsPanel } from "@/components/site-news-panel";
import { ForumActivityPanel } from "@/components/forum-activity-panel";
import type { RecentForumThread, SiteNewsPostWithAuthor } from "@/lib/supabase/types";

const NEWS_LIMIT = 5;
const FORUM_ACTIVITY_LIMIT = 6;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Row shapes of the joined/looked-up selects below. Hand-cast, like the
// other joined selects in this project — see the comment on
// PetWithSpecies in lib/supabase/types.ts. user_profiles is a view, so
// (unlike forum_categories, a real table) its rows can't be embedded via
// a foreign-key select — author names are resolved with a second lookup
// query instead, same pattern as TradeWithParticipants/forum threads.
type SiteNewsPostJoinRow = {
  id: string;
  author_id: string;
  title: string;
  body: string;
  is_active: boolean;
  created_at: string;
  edited_at: string | null;
};
type ForumThreadJoinRow = {
  id: string;
  category_id: string;
  author_id: string;
  title: string;
  reply_count: number;
  last_post_at: string;
  forum_categories: { name: string } | null;
};

// ?banned=account&until=...&reason=... is set by /auth/callback when an
// account-banned player tries to sign in — the OAuth handshake itself
// can't be intercepted, so the session is allowed, checked, then
// immediately signed back out and redirected here with these params
// before this page ever renders a "you're signed in" state for them.
export default async function Home(props: PageProps<"/">) {
  const supabase = await createClient();

  const searchParams = await props.searchParams;
  const banned = first(searchParams.banned);
  const until = first(searchParams.until);
  const reason = first(searchParams.reason);

  if (banned === "account") {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
        <h1 className="max-w-xl text-3xl font-semibold tracking-tight text-red-700 dark:text-red-400">
          Your account is banned
        </h1>
        <p className="max-w-md text-lg text-stone-600 dark:text-stone-400">
          You can&apos;t sign in right now.
          {until ? ` This ban is in effect until ${new Date(until).toLocaleString()}.` : ""}
        </p>
        {reason ? (
          <p className="max-w-md rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            &ldquo;{reason}&rdquo;
          </p>
        ) : null}
      </main>
    );
  }

  const [{ data: newsData }, { data: threadsData }] = await Promise.all([
    supabase
      .from("site_news_posts")
      .select("id, author_id, title, body, is_active, created_at, edited_at")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(NEWS_LIMIT),
    supabase
      .from("forum_threads")
      .select("id, category_id, author_id, title, reply_count, last_post_at, forum_categories!inner(name, is_active)")
      .eq("forum_categories.is_active", true)
      .order("last_post_at", { ascending: false })
      .limit(FORUM_ACTIVITY_LIMIT),
  ]);

  const newsRows = (newsData ?? []) as SiteNewsPostJoinRow[];
  const threadRows = (threadsData ?? []) as unknown as ForumThreadJoinRow[];

  const authorIds = [...new Set([...newsRows.map((n) => n.author_id), ...threadRows.map((t) => t.author_id)])];
  const { data: profiles } =
    authorIds.length > 0
      ? await supabase.from("user_profiles").select("id, display_name, is_admin, is_moderator").in("id", authorIds)
      : { data: [] };
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const newsPosts: SiteNewsPostWithAuthor[] = newsRows.map((post) => {
    const author = profileById.get(post.author_id);
    return {
      ...post,
      authorName: author?.display_name ?? "Unknown",
      authorIsAdmin: author?.is_admin ?? false,
      authorIsModerator: author?.is_moderator ?? false,
    };
  });

  const recentThreads: RecentForumThread[] = threadRows.map((thread) => ({
    id: thread.id,
    category_id: thread.category_id,
    title: thread.title,
    reply_count: thread.reply_count,
    last_post_at: thread.last_post_at,
    categoryName: thread.forum_categories?.name ?? "Unknown",
    authorName: profileById.get(thread.author_id)?.display_name ?? "Unknown",
  }));

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-12">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <SiteNewsPanel posts={newsPosts} />
        <ForumActivityPanel threads={recentThreads} />
      </div>
    </main>
  );
}
