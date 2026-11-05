import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, PlayerNoteRow, PlayerNoteWithAuthor, ReportRow, ReportWithDetails } from "@/lib/supabase/types";

// Shared by /mod/reports and /mod/players/[userId] — both need the same
// reporter/target-content resolution (batched user_profiles/forum_posts/
// dm_messages lookups, never per-row joins) to go from raw ReportRow[] to
// something a ReportCard can render.
export async function resolveReportDetails(
  supabase: SupabaseClient<Database>,
  reports: ReportRow[],
): Promise<ReportWithDetails[]> {
  const userIds = [
    ...new Set(
      reports.flatMap((r) => [
        r.reporter_id,
        r.target_user_id,
        r.resolved_by,
        r.claimed_by,
        r.target_post_author_id,
        r.target_message_sender_id,
      ].filter((id): id is string => id !== null)),
    ),
  ];
  const postIds = [...new Set(reports.map((r) => r.target_post_id).filter((id): id is string => id !== null))];
  const messageIds = [
    ...new Set(reports.map((r) => r.target_message_id).filter((id): id is string => id !== null)),
  ];

  const [{ data: profilesData }, { data: postsData }, { data: messagesData }] = await Promise.all([
    userIds.length > 0
      ? supabase.from("user_profiles").select("id, display_id, display_name").in("id", userIds)
      : Promise.resolve({ data: [] }),
    postIds.length > 0
      ? supabase.from("forum_posts").select("id, thread_id, body_raw").in("id", postIds)
      : Promise.resolve({ data: [] }),
    messageIds.length > 0
      ? supabase.from("dm_messages").select("id, conversation_id, body").in("id", messageIds)
      : Promise.resolve({ data: [] }),
  ]);

  const profileById = new Map((profilesData ?? []).map((p) => [p.id, p]));
  const postById = new Map((postsData ?? []).map((p) => [p.id, p]));
  const messageById = new Map((messagesData ?? []).map((m) => [m.id, m]));

  const threadIds = [...new Set((postsData ?? []).map((p) => p.thread_id))];
  const { data: threadsData } =
    threadIds.length > 0
      ? await supabase.from("forum_threads").select("id, category_id, title").in("id", threadIds)
      : { data: [] };
  const threadById = new Map((threadsData ?? []).map((t) => [t.id, t]));

  return reports.map((r) => {
    const post = r.target_post_id ? postById.get(r.target_post_id) : null;
    const thread = post ? threadById.get(post.thread_id) : null;
    const message = r.target_message_id ? messageById.get(r.target_message_id) : null;

    return {
      id: r.id,
      target_type: r.target_type,
      category: r.category,
      details: r.details,
      status: r.status,
      resolved_at: r.resolved_at,
      resolution_note: r.resolution_note,
      created_at: r.created_at,
      reporterId: r.reporter_id,
      reporterDisplayId: profileById.get(r.reporter_id)?.display_id ?? 0,
      reporterName: profileById.get(r.reporter_id)?.display_name ?? "Unknown",
      targetUserId: r.target_user_id,
      targetUserDisplayId: r.target_user_id ? (profileById.get(r.target_user_id)?.display_id ?? 0) : null,
      targetUserName: r.target_user_id ? (profileById.get(r.target_user_id)?.display_name ?? "Unknown") : null,
      targetPostId: r.target_post_id,
      targetPostBody: post?.body_raw ?? null,
      targetPostAuthorId: r.target_post_author_id,
      targetPostAuthorDisplayId: r.target_post_author_id
        ? (profileById.get(r.target_post_author_id)?.display_id ?? 0)
        : null,
      targetPostAuthorName: r.target_post_author_id
        ? (profileById.get(r.target_post_author_id)?.display_name ?? "Unknown")
        : null,
      targetThreadId: post?.thread_id ?? null,
      targetCategoryId: thread?.category_id ?? null,
      targetMessageId: r.target_message_id,
      targetMessageBody: message?.body ?? null,
      targetMessageSenderId: r.target_message_sender_id,
      targetMessageSenderDisplayId: r.target_message_sender_id
        ? (profileById.get(r.target_message_sender_id)?.display_id ?? 0)
        : null,
      targetMessageSenderName: r.target_message_sender_id
        ? (profileById.get(r.target_message_sender_id)?.display_name ?? "Unknown")
        : null,
      targetMessageConversationId: message?.conversation_id ?? null,
      resolvedByName: r.resolved_by ? (profileById.get(r.resolved_by)?.display_name ?? "Unknown") : null,
      claimedById: r.claimed_by,
      claimedByName: r.claimed_by ? (profileById.get(r.claimed_by)?.display_name ?? "Unknown") : null,
    };
  });
}

// Same author-name-resolution pattern as resolveReportDetails, for the
// private per-player notes shown on the report-handling page.
export async function resolvePlayerNotes(
  supabase: SupabaseClient<Database>,
  notes: PlayerNoteRow[],
): Promise<PlayerNoteWithAuthor[]> {
  const authorIds = [...new Set(notes.map((n) => n.author_id))];
  const { data: profilesData } =
    authorIds.length > 0
      ? await supabase.from("user_profiles").select("id, display_name").in("id", authorIds)
      : { data: [] };
  const nameById = new Map((profilesData ?? []).map((p) => [p.id, p.display_name]));

  return notes.map((n) => ({
    id: n.id,
    body: n.body,
    created_at: n.created_at,
    edited_at: n.edited_at,
    authorId: n.author_id,
    authorName: nameById.get(n.author_id) ?? "Unknown",
  }));
}
