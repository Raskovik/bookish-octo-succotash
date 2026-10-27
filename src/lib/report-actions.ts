"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ReportCategory, ReportTargetType } from "@/lib/supabase/types";

const CATEGORIES: ReportCategory[] = ["spam", "harassment", "inappropriate_content", "scam", "other"];

export type ReportFormState = { error: string } | { success: true } | null;

/**
 * Files a report — a player action, not a moderator one, so this
 * deliberately lives outside src/app/mod/ (which is entirely gated by
 * requireModerator()). Used by the shared ReportButton component from
 * /u/[id] ("user"), forum posts ("forum_post"), and DM messages
 * ("dm_message"). RLS (reports' insert policy, 0027_moderation.sql) is
 * the real backstop — it independently enforces reporter_id = auth.uid().
 * Filing a report also triggers an automatic acknowledgment DM from the
 * Staff account, and — for a forum_post report specifically — may
 * auto-hide the post if 5 distinct players have now reported it; both
 * are handled entirely in the database (handle_new_report(),
 * 0028_moderation_round_two.sql), not here.
 */
export async function submitReport(
  _prevState: ReportFormState,
  formData: FormData,
): Promise<ReportFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const targetType = String(formData.get("target_type") ?? "") as ReportTargetType;
  const targetId = String(formData.get("target_id") ?? "");
  const category = String(formData.get("category") ?? "") as ReportCategory;
  const detailsRaw = formData.get("details");
  const details = typeof detailsRaw === "string" ? detailsRaw.trim() : "";

  if (targetType !== "user" && targetType !== "forum_post" && targetType !== "dm_message") {
    return { error: "Invalid report target." };
  }
  if (targetId.length === 0) {
    return { error: "Invalid report target." };
  }
  if (!CATEGORIES.includes(category)) {
    return { error: "Pick a reason." };
  }
  if (targetType === "user" && targetId === user.id) {
    return { error: "You can't report yourself." };
  }
  if (details.length > 1000) {
    return { error: "Details must be 1000 characters or fewer." };
  }

  const { error } = await supabase.from("reports").insert({
    reporter_id: user.id,
    target_type: targetType,
    target_user_id: targetType === "user" ? targetId : null,
    target_post_id: targetType === "forum_post" ? targetId : null,
    target_message_id: targetType === "dm_message" ? targetId : null,
    category,
    details: details.length > 0 ? details : null,
  });

  if (error) {
    return { error: "Could not submit that report. Please try again." };
  }

  return { success: true };
}

export type BlockPlayerState = { error: string } | { success: true } | null;

// Self-service and one-directional (blocks.ts, 0030_simple_report_
// handling.sql) — offered right after filing a report, since "I just
// reported this person" is exactly the moment a player is most likely to
// also want to stop hearing from them. Not a staff/moderation action;
// deliberately lives next to submitReport rather than in src/app/mod/.
export async function blockPlayer(
  _prevState: BlockPlayerState,
  formData: FormData,
): Promise<BlockPlayerState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const blockedId = String(formData.get("blocked_id") ?? "");
  if (blockedId.length === 0 || blockedId === user.id) {
    return { error: "Could not block that player." };
  }

  const { error } = await supabase
    .from("blocks")
    .upsert({ blocker_id: user.id, blocked_id: blockedId }, { onConflict: "blocker_id,blocked_id" });

  if (error) {
    return { error: "Could not block that player. Please try again." };
  }

  return { success: true };
}

export type UnblockPlayerState = { error: string } | { success: true } | null;

export async function unblockPlayer(
  _prevState: UnblockPlayerState,
  formData: FormData,
): Promise<UnblockPlayerState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const blockedId = String(formData.get("blocked_id") ?? "");
  if (blockedId.length === 0) {
    return { error: "Could not unblock that player." };
  }

  const { error } = await supabase
    .from("blocks")
    .delete()
    .eq("blocker_id", user.id)
    .eq("blocked_id", blockedId);

  if (error) {
    return { error: "Could not unblock that player. Please try again." };
  }

  return { success: true };
}
