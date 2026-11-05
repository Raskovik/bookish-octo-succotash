import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, ShieldAlert } from "lucide-react";
import { requireModerator } from "@/lib/moderation";
import { formatForumDate } from "@/lib/format-forum-date";
import { ForumPanel } from "@/components/forums/forum-panel";
import { STAFF_USER_ID } from "@/lib/staff-account";
import type { DmConversationRow, DmMessageRow } from "@/lib/supabase/types";

// Staff-only, read-only DM log viewer — "staff can see DM logs between
// players." No reply box: staff reviewing a conversation aren't a
// participant in it, and the dm_messages insert policy (still
// participants-only, 0026_direct_messages.sql) would reject a send from
// here anyway. Only ever linked from staff-only pages
// (/mod/players/[userId], a report's "View conversation" link).
export default async function ModConversationPage(
  props: PageProps<"/mod/conversations/[conversationId]">,
) {
  const { conversationId } = await props.params;
  const { supabase } = await requireModerator();

  const { data: conversationData } = await supabase
    .from("dm_conversations")
    .select("*")
    .eq("id", conversationId)
    .maybeSingle();

  const conversation = conversationData as DmConversationRow | null;

  if (!conversation) {
    notFound();
  }

  const [{ data: userOneProfile }, { data: userTwoProfile }, { data: messagesData }] = await Promise.all([
    supabase.from("user_profiles").select("id, display_id, display_name, avatar_url").eq("id", conversation.user_one_id).single(),
    supabase.from("user_profiles").select("id, display_id, display_name, avatar_url").eq("id", conversation.user_two_id).single(),
    supabase
      .from("dm_messages")
      .select("id, conversation_id, sender_id, body, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true }),
  ]);

  const profileById = new Map(
    [userOneProfile, userTwoProfile].filter((p): p is NonNullable<typeof p> => p !== null).map((p) => [p.id, p]),
  );
  const messages = (messagesData ?? []) as DmMessageRow[];

  return (
    <div className="flex flex-col gap-5">
      <Link href="/mod/reports" className="flex w-fit items-center gap-1.5 text-sm text-stone-500 hover:underline">
        <ArrowLeft size={14} />
        Back to reports
      </Link>

      <ForumPanel
        icon={<Mail size={18} />}
        title={`Conversation: ${userOneProfile?.display_name ?? "Unknown"} & ${userTwoProfile?.display_name ?? "Unknown"}`}
      >
        <div>
          {messages.length === 0 ? (
            <p className="px-6 py-6 text-sm italic text-stone-500">No messages in this conversation.</p>
          ) : (
            messages.map((message) => {
              const author = profileById.get(message.sender_id);
              const isFromStaffAccount = message.sender_id === STAFF_USER_ID;
              return (
                <article
                  key={message.id}
                  className="flex flex-col gap-4 border-t border-green-100 p-6 first:border-t-0 sm:flex-row"
                >
                  <div className="flex shrink-0 flex-row items-center gap-3 sm:w-32 sm:flex-col sm:text-center">
                    {author?.avatar_url ? (
                      <Image
                        src={author.avatar_url}
                        alt=""
                        width={56}
                        height={56}
                        className="h-14 w-14 rounded-md border-2 border-green-400 object-cover"
                      />
                    ) : (
                      <div className="h-14 w-14 rounded-md border-2 border-dashed border-green-300" />
                    )}
                    <Link href={`/u/${author?.display_id ?? ""}`} className="text-sm font-semibold hover:underline">
                      {author?.display_name ?? "Unknown"}
                    </Link>
                    {isFromStaffAccount ? (
                      <span className="flex items-center gap-1 text-xs font-semibold text-green-700 dark:text-green-400">
                        <ShieldAlert size={12} />
                        Official
                      </span>
                    ) : null}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <div className="text-sm text-stone-500">Sent {formatForumDate(message.created_at)}</div>
                    <p className="whitespace-pre-wrap break-words text-base leading-relaxed">{message.body}</p>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </ForumPanel>
    </div>
  );
}
