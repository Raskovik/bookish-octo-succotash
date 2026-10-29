import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatShortDate } from "@/lib/format-forum-date";
import { isConversationUnread } from "@/lib/dm-unread";
import { NewMessageForm } from "./new-message-form";
import type { DmConversationRow, DmConversationSummary } from "@/lib/supabase/types";

export default async function MessagesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: conversationsData } = await supabase
    .from("dm_conversations")
    .select("*")
    .or(`user_one_id.eq.${user.id},user_two_id.eq.${user.id}`)
    .order("last_message_at", { ascending: false });

  const conversations = (conversationsData ?? []) as DmConversationRow[];

  const otherUserIds = [
    ...new Set(
      conversations.map((c) => (c.user_one_id === user.id ? c.user_two_id : c.user_one_id)),
    ),
  ];

  const { data: profilesData } =
    otherUserIds.length > 0
      ? await supabase
          .from("user_profiles")
          .select("id, display_name, avatar_url, is_admin, is_moderator")
          .in("id", otherUserIds)
      : { data: [] };

  const profileById = new Map((profilesData ?? []).map((p) => [p.id, p]));

  const summaries: DmConversationSummary[] = conversations.map((c) => {
    const otherUserId = c.user_one_id === user.id ? c.user_two_id : c.user_one_id;
    const otherProfile = profileById.get(otherUserId);

    return {
      id: c.id,
      last_message_at: c.last_message_at,
      last_message_body: c.last_message_body,
      otherUserId,
      otherUserName: otherProfile?.display_name ?? "Unknown player",
      otherUserAvatarUrl: otherProfile?.avatar_url ?? null,
      otherUserIsAdmin: otherProfile?.is_admin ?? false,
      otherUserIsModerator: otherProfile?.is_moderator ?? false,
      lastMessageIsMine: c.last_message_sender_id === user.id,
      isUnread: isConversationUnread(c, user.id),
    };
  });

  return (
    <main id="main">
      <div className="sheet">
        <div className="panel forum">
          <section className="col" aria-labelledby="inbox-h">
            <h2 className="frame-title" id="inbox-h">
              <span className="sect-ico ico-mail" />
              Messages
            </h2>
            <div className="frame-body fm-flush">
              <div className="fm-form">
                <NewMessageForm />
              </div>
              {summaries.length === 0 ? (
                <p style={{ padding: "0 18px 18px" }}>
                  No conversations yet. Start one from a player&apos;s profile, or above.
                </p>
              ) : (
                <ul className="fm-list">
                  {summaries.map((c) => (
                    <li className={`fm-row${c.isUnread ? " fm-unread" : ""}`} key={c.id}>
                      <span className={`tile ${c.isUnread ? "t-orange " : ""}i-mail`} aria-hidden="true" />
                      <div className="fm-main">
                        <Link className="thread-title" href={`/messages/${c.id}`}>
                          {c.otherUserName}
                        </Link>
                        <p className="fm-sub fm-trunc">
                          {c.lastMessageIsMine ? "You: " : ""}
                          {c.last_message_body ?? "No messages yet."}
                        </p>
                      </div>
                      <time className="fm-when">{formatShortDate(c.last_message_at)}</time>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
