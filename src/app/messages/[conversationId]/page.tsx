import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Mail, ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatForumDate } from "@/lib/format-forum-date";
import { ForumPanel, ForumPanelSection } from "@/components/forums/forum-panel";
import { PaginationBar } from "@/components/forums/pagination-bar";
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
        <div className="panel flex flex-col gap-5">
      <Link
        href="/messages"
        className="flex w-fit items-center gap-1.5 text-sm text-stone-500 hover:underline"
      >
        <ArrowLeft size={14} />
        Back to messages
      </Link>

      <ForumPanel
        icon={<Mail size={18} />}
        title={
          <>
            Conversation with{" "}
            <PlayerLink
              userId={otherUserId}
              name={otherName}
              isAdmin={otherProfile?.is_admin ?? false}
              isModerator={otherProfile?.is_moderator ?? false}
              className="hover:underline"
            />
          </>
        }
        action={
          <Link href={`/u/${otherUserId}`} className="text-sm text-white/90 underline hover:text-white">
            View profile
          </Link>
        }
      >
        <div>
          {messages.length === 0 ? (
            <p className="px-6 py-6 text-sm italic text-stone-500">
              No messages yet — say hello to {otherName}.
            </p>
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
                  createdAt={message.created_at}
                  body={message.body}
                  canReport={!isMine}
                />
              );
            })
          )}
        </div>

        <PaginationBar basePath={`/messages/${conversationId}`} page={page} totalPages={totalPages} />
      </ForumPanel>

      <div className="overflow-hidden rounded-xl border border-green-300 shadow-sm">
        <ForumPanelSection title={`Reply to ${otherName}`}>
          <div className="p-5">
            <ReplyForm conversationId={conversationId} />
          </div>
        </ForumPanelSection>
      </div>
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
  createdAt: string;
  body: string;
  canReport: boolean;
}) {
  const isStaffStyled = isFromStaffAccount || authorIsAdmin || authorIsModerator;

  return (
    <article
      className={`flex flex-col gap-4 border-t p-6 first:border-t-0 sm:flex-row ${
        isStaffStyled
          ? "border-green-200 bg-green-50/60 dark:border-stone-800 dark:bg-green-950/20"
          : "border-green-100"
      }`}
    >
      <div className="flex shrink-0 flex-row items-center gap-3 sm:w-32 sm:flex-col sm:text-center">
        {authorAvatarUrl ? (
          <Image
            src={authorAvatarUrl}
            alt=""
            width={72}
            height={72}
            className="h-16 w-16 rounded-md border-2 border-green-400 object-cover sm:h-[72px] sm:w-[72px]"
          />
        ) : (
          <div className="h-16 w-16 rounded-md border-2 border-dashed border-green-300 sm:h-[72px] sm:w-[72px]" />
        )}
        <PlayerLink
          userId={authorId}
          name={authorName}
          isAdmin={authorIsAdmin}
          isModerator={authorIsModerator}
          className="text-sm font-semibold hover:underline"
        />
        {isFromStaffAccount ? (
          <span className="flex items-center gap-1 text-xs font-semibold text-green-700 dark:text-green-400">
            <ShieldAlert size={12} />
            Official
          </span>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="text-sm text-stone-500">Sent {formatForumDate(createdAt)}</div>
          {canReport ? (
            <ReportButton targetType="dm_message" targetId={messageId} offendingUserId={authorId} />
          ) : null}
        </div>
        {/* Plain text, not BBCode — a DM isn't a forum post, so this is
            never passed through bbcodeToHtml()/dangerouslySetInnerHTML. */}
        <p className="whitespace-pre-wrap break-words text-base leading-relaxed">{body}</p>
      </div>
    </article>
  );
}
