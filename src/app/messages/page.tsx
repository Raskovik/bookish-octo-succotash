import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Mail, MailOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatShortDate } from "@/lib/format-forum-date";
import { isConversationUnread } from "@/lib/dm-unread";
import { ForumPanel } from "@/components/forums/forum-panel";
import { staffNameColorClass } from "@/components/player-link";
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
        <div className="panel flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
          <p className="text-sm text-stone-500">Private conversations with other players.</p>
        </div>
        <NewMessageForm />
      </div>

      <ForumPanel icon={<Mail size={18} />} title="Inbox">
        {summaries.length === 0 ? (
          <p className="px-5 py-6 text-sm italic text-stone-500">
            No conversations yet. Start one from a player&apos;s profile, or above.
          </p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {summaries.map((c) => (
                <tr key={c.id} className="border-t border-green-100 first:border-t-0 hover:bg-green-50">
                  <td className="w-12 px-5 py-4" aria-hidden>
                    {c.isUnread ? (
                      <Mail size={20} className="text-green-600" />
                    ) : (
                      <MailOpen size={20} className="text-stone-400" />
                    )}
                  </td>
                  <td className="w-14 py-4 pr-2">
                    {c.otherUserAvatarUrl ? (
                      <Image
                        src={c.otherUserAvatarUrl}
                        alt=""
                        width={40}
                        height={40}
                        className="h-10 w-10 rounded-md object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-md bg-green-200 dark:bg-stone-800" />
                    )}
                  </td>
                  <td className="min-w-0 px-2 py-4">
                    <Link
                      href={`/messages/${c.id}`}
                      className={`text-base hover:underline ${c.isUnread ? "font-semibold" : "font-medium"} ${staffNameColorClass(c.otherUserIsAdmin, c.otherUserIsModerator)}`}
                    >
                      {c.otherUserName}
                    </Link>
                    <div className="mt-0.5 truncate text-sm text-stone-500">
                      {c.lastMessageIsMine ? "You: " : ""}
                      {c.last_message_body ?? "No messages yet."}
                    </div>
                  </td>
                  <td className="w-32 px-4 py-4 text-right text-xs text-stone-500">
                    {formatShortDate(c.last_message_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </ForumPanel>
        </div>
      </div>
    </main>
  );
}
