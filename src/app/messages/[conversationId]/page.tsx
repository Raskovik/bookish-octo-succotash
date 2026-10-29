import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatForumDate } from "@/lib/format-forum-date";
import { FmPager } from "@/components/forums/fm-pager";
import { PlayerLink } from "@/components/player-link";
import { ReportButton } from "@/components/report-button";
import { STAFF_USER_ID } from "@/lib/staff-account";
import { ReplyForm } from "./reply-form";
import type { DmConversationRow, DmMessageRow } from "@/lib/supabase/types";

const PAGE_SIZE = 20;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ConversationPage(
  props: PageProps<"/messages/[conversationId]">,
) {
  const { conversationId } = await props.params;
  const searchParams = await props.searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: conversationData, error: conversationError } = await supabase
    .from("dm_conversations")
    .select("*")
    .eq("id", conversationId)
    .maybeSingle();

  if (conversationError) {
    console.error("Failed to load conversation", conversationId, conversationError);
  }

  const conversation = conversationData as DmConversationRow | null;

  // RLS's select policy also lets staff read any conversation (for
  // /mod/conversations, the moderation log viewer) — but this is the
  // player-facing page, which a moderator visiting isn't a participant
  // in still shouldn't get (they'd see a reply box that RLS would
  // silently reject on submit, since the insert policy stays
  // participants-only). A nonexistent id, someone else's conversation,
  // and a staff member peeking at one they're not part of all land here
  // as plain "not found" — staff use /mod/conversations/[id] instead.
  if (!conversation || (conversation.user_one_id !== user.id && conversation.user_two_id !== user.id)) {
    notFound();
  }

  const otherUserId =
    conversation.user_one_id === user.id ? conversation.user_two_id : conversation.user_one_id;
  const myLastReadAt =
    conversation.user_one_id === user.id ? conversation.user_one_last_read_at : conversation.user_two_last_read_at;

  const [{ data: myProfile }, { data: otherProfile }, { count }] = await Promise.all([
    supabase.from("user_profiles").select("id, display_name, avatar_url, is_admin, is_moderator").eq("id", user.id).single(),
    supabase
      .from("user_profiles")
      .select("id, display_name, avatar_url, is_admin, is_moderator")
      .eq("id", otherUserId)
      .single(),
    supabase
      .from("dm_messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", conversationId),
  ]);

  const totalMessages = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalMessages / PAGE_SIZE));

  const pageParam = first(searchParams.page);
  let page: number;
  if (pageParam) {
    const requested = Number(pageParam);
    page = Number.isInteger(requested) && requested > 0 ? Math.min(requested, totalPages) : 1;
  } else {
    // No page requested — land wherever this player's first unread
    // message is, so opening a long conversation doesn't dump them back
    // at the very start. Computed from the read marker BEFORE it gets
    // bumped to "now" below. Nothing unread (or an empty conversation)
    // naturally computes to the last page, i.e. the most recent messages.
    let readCount = 0;
    if (myLastReadAt) {
      const { count: readCountResult } = await supabase
        .from("dm_messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", conversationId)
        .lte("created_at", myLastReadAt);
      readCount = readCountResult ?? 0;
    }
    const targetPage = Math.floor(readCount / PAGE_SIZE) + 1;
    redirect(`/messages/${conversationId}?page=${Math.min(targetPage, totalPages)}`);
  }

  const offset = (page - 1) * PAGE_SIZE;
  const { data: messagesData } = await supabase
    .from("dm_messages")
    .select("id, conversation_id, sender_id, body, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .range(offset, offset + PAGE_SIZE - 1);

  // Marks the conversation read as of now for the signed-in participant —
  // same "do it as a side effect of loading the page" pattern as
  // increment_thread_view_count on the forum thread page. Runs after the
  // unread-position calculation above uses the OLD marker.
  await supabase.rpc("mark_dm_conversation_read", {
    p_user_id: user.id,
    p_conversation_id: conversationId,
  });

  const messages = (messagesData ?? []) as DmMessageRow[];
  const otherName = otherProfile?.display_name ?? "Unknown player";

  return (
    <main id="main">
      <div className="sheet">
        <div className="panel forum">
          <nav className="fm-crumbs" aria-label="Breadcrumb">
            <ol>
              <li>
                <Link href="/messages">Messages</Link>
              </li>
              <li aria-current="page">{otherName}</li>
            </ol>
          </nav>

          <section className="col fm-block" aria-labelledby="conv-h">
            <h2 className="frame-title" id="conv-h">
              <span className="sect-ico ico-mail" />
              Conversation with{" "}
              <PlayerLink
                userId={otherUserId}
                name={otherName}
                isAdmin={otherProfile?.is_admin ?? false}
                isModerator={otherProfile?.is_moderator ?? false}
              />
              <Link className="btn btn-sm btn-cream fm-new" href={`/u/${otherUserId}`}>
                View profile
              </Link>
            </h2>
            <div className="frame-body fm-flush">
              {messages.length === 0 ? (
                <p style={{ padding: "18px" }}>No messages yet — say hello to {otherName}.</p>
              ) : (
                messages.map((message) => {
                  const isMine = message.sender_id === user.id;
                  const isFromStaffAccount = message.sender_id === STAFF_USER_ID;
                  const author = isMine ? myProfile : otherProfile;
                  const authorName = isMine ? "You" : otherName;
                  return (
                    <MessageCard
                      key={message.id}
                      messageId={message.id}
                      authorId={author?.id ?? message.sender_id}
                      authorName={authorName}
                      authorAvatarUrl={author?.avatar_url ?? null}
                      authorIsAdmin={!isMine && (author?.is_admin ?? false)}
                      authorIsModerator={!isMine && (author?.is_moderator ?? false)}
                      isFromStaffAccount={isFromStaffAccount}
                      isMine={isMine}
                      createdAt={message.created_at}
                      body={message.body}
                      canReport={!isMine}
                    />
                  );
                })
              )}
              <div className="fm-foot">
                <FmPager basePath={`/messages/${conversationId}`} page={page} totalPages={totalPages} />
              </div>
            </div>
          </section>

          <section className="col fm-block" aria-labelledby="reply-h" style={{ marginTop: "14px" }}>
            <h2 className="frame-title" id="reply-h">
              <span className="sect-ico ico-mail" />
              Reply to {otherName}
            </h2>
            <div className="fm-form">
              <ReplyForm conversationId={conversationId} />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

// Same avatar-left / name-timestamp-body-right shape as forum posts'
// PostCard — messages still can't be edited, but they can now be
// reported, and a message from the Staff pseudo-account (automated
// notices) or a real staff member (a warning they sent themselves)
// renders distinctly so it doesn't read as just another player's DM.
function MessageCard({
  messageId,
  authorId,
  authorName,
  authorAvatarUrl,
  authorIsAdmin,
  authorIsModerator,
  isFromStaffAccount,
  isMine,
  createdAt,
  body,
  canReport,
}: {
  messageId: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  authorIsAdmin: boolean;
  authorIsModerator: boolean;
  isFromStaffAccount: boolean;
  isMine: boolean;
  createdAt: string;
  body: string;
  canReport: boolean;
}) {
  const isStaffStyled = isFromStaffAccount || authorIsAdmin || authorIsModerator;

  return (
    <article className={`fm-post${isMine ? " fm-mine" : ""}${isStaffStyled ? " fm-staff" : ""}`}>
      <div className="fm-author">
        <Link href={`/u/${authorId}`}>
          <div
            className="av-sq"
            role="img"
            aria-label={`${authorName}'s avatar`}
            style={authorAvatarUrl ? { backgroundImage: `url(${authorAvatarUrl})` } : undefined}
          />
        </Link>
        <PlayerLink userId={authorId} name={authorName} isAdmin={authorIsAdmin} isModerator={authorIsModerator} className="fm-name" />
        {isFromStaffAccount ? (
          <span className="fm-official">
            <ShieldAlert size={12} />
            Official
          </span>
        ) : null}
      </div>
      <div className="fm-content">
        <header className="fm-phead">
          <p className="byline">
            Sent <time>{formatForumDate(createdAt)}</time>
          </p>
          <div className="fm-acts">
            {canReport ? (
              <ReportButton
                targetType="dm_message"
                targetId={messageId}
                offendingUserId={authorId}
                triggerClassName="btn btn-sm btn-red"
              />
            ) : null}
          </div>
        </header>
        {/* Plain text, not BBCode — a DM isn't a forum post, so this is
            never passed through bbcodeToHtml()/dangerouslySetInnerHTML. */}
        <p className="msg-body">{body}</p>
      </div>
    </article>
  );
}
