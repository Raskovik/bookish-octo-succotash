"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { friendlyWriteError } from "@/lib/content-filter-error";

export type SendMessageState = { error: string } | null;

export async function sendMessage(
  _prevState: SendMessageState,
  formData: FormData,
): Promise<SendMessageState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const conversationId = String(formData.get("conversation_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();

  if (body.length === 0) {
    return { error: "Type a message first." };
  }
  if (body.length > 4000) {
    return { error: "Messages must be 4000 characters or fewer." };
  }

  // Friendly pre-check — dm_messages' INSERT policy (0029_bans_and_
  // staff_fixes.sql) is the real backstop either way, this just turns a
  // rejected insert into a readable message instead of a generic one.
  const { data: isDmBanned } = await supabase.rpc("user_has_active_ban", {
    p_user_id: user.id,
    p_ban_type: "dm",
  });
  if (isDmBanned) {
    return { error: "You're currently banned from sending direct messages." };
  }

  const { error } = await supabase
    .from("dm_messages")
    .insert({ conversation_id: conversationId, sender_id: user.id, body });

  if (error) {
    return {
      error: friendlyWriteError(
        error.message,
        "Could not send that message — the other player may be unable to receive DMs right now.",
      ),
    };
  }

  revalidatePath("/messages");
  // No ?page= here on purpose: sending a message bumps the SENDER's own
  // read marker to right now (sync_dm_conversation_on_message, 0026),
  // so the conversation page's "no page given -> jump to first unread"
  // logic resolves this to the last page — showing the message just
  // sent — without this action needing to compute a page number itself.
  redirect(`/messages/${conversationId}`);
}
