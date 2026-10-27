"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return { supabase, user };
}

// Shared by both entry points below: resolve (or create) the conversation
// with the other player, then send the browser straight to it — there's
// no separate "compose" step, the thread page's own reply box is where
// the first message actually gets typed.
async function startConversationAndRedirect(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  otherUserId: string,
): Promise<{ error: string }> {
  const { data: conversationId, error } = await supabase.rpc("get_or_create_dm_conversation", {
    p_user_id: userId,
    p_other_user_id: otherUserId,
  });

  if (error || !conversationId) {
    return { error: error?.message ?? "Could not start that conversation." };
  }

  redirect(`/messages/${conversationId}`);
}

// Used by the "Send DM" button on /u/[id], which already knows the other
// player's id.
export async function startConversationWithUserId(formData: FormData) {
  const { supabase, user } = await requireUser();

  const otherUserId = String(formData.get("user_id") ?? "");
  if (otherUserId.length === 0) return;

  await startConversationAndRedirect(supabase, user.id, otherUserId);
}

export type SendMessageToUserState = { error: string } | { success: true } | null;

// Used by the profile page's Message dialog, which composes the text
// right there rather than redirecting to the conversation thread first
// (unlike startConversationWithUserId above) — same bans/validation
// checks as the thread page's own sendMessage (actions.ts under
// messages/[conversationId]/), just without the redirect at the end.
export async function sendMessageToUser(
  _prevState: SendMessageToUserState,
  formData: FormData,
): Promise<SendMessageToUserState> {
  const { supabase, user } = await requireUser();

  const otherUserId = String(formData.get("user_id") ?? "");
  const body = String(formData.get("text") ?? "").trim();

  if (otherUserId.length === 0) {
    return { error: "Could not send that message." };
  }
  if (body.length === 0) {
    return { error: "Type a message first." };
  }
  if (body.length > 500) {
    return { error: "Messages must be 500 characters or fewer." };
  }

  const { data: isDmBanned } = await supabase.rpc("user_has_active_ban", {
    p_user_id: user.id,
    p_ban_type: "dm",
  });
  if (isDmBanned) {
    return { error: "You're currently banned from sending direct messages." };
  }

  const { data: conversationId, error: conversationError } = await supabase.rpc(
    "get_or_create_dm_conversation",
    { p_user_id: user.id, p_other_user_id: otherUserId },
  );

  if (conversationError || !conversationId) {
    return { error: conversationError?.message ?? "Could not start that conversation." };
  }

  const { error } = await supabase
    .from("dm_messages")
    .insert({ conversation_id: conversationId, sender_id: user.id, body });

  if (error) {
    return { error: "Could not send that message — the other player may be unable to receive DMs right now." };
  }

  revalidatePath("/messages");
  return { success: true };
}

export type StartConversationState = { error: string } | null;

// Used by the "New message" box on /messages, which only has a typed
// display name to go on.
export async function startConversationWithName(
  _prevState: StartConversationState,
  formData: FormData,
): Promise<StartConversationState> {
  const { supabase, user } = await requireUser();

  const name = String(formData.get("display_name") ?? "").trim();
  if (name.length === 0) {
    return { error: "Type a player's name first." };
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("id")
    .ilike("display_name", name)
    .maybeSingle();

  if (!profile) {
    return { error: `No player found named "${name}".` };
  }
  if (profile.id === user.id) {
    return { error: "You can't message yourself." };
  }

  return await startConversationAndRedirect(supabase, user.id, profile.id);
}
