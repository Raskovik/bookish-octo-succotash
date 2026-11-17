"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireModerator } from "@/lib/moderation";
import { requireAdmin } from "@/lib/admin";
import type { BanType, ReportStatus } from "@/lib/supabase/types";

const BAN_TYPES: BanType[] = ["dm", "sales", "forums", "account"];

// Plain form actions (no useActionState, no redirect) — same "just does
// the thing, no confirmation step" convention as other staff-only writes
// in this app (deleteFolder, updateThreadFlags). requireModerator() here
// is defense in depth: the button is only rendered inside /mod (already
// gated by its own layout), and reports' staff-only UPDATE RLS policy
// (0027_moderation.sql) is the real backstop either way.

export async function resolveReport(formData: FormData): Promise<void> {
  const { supabase, user } = await requireModerator();

  const reportId = String(formData.get("report_id") ?? "");
  const status = String(formData.get("status") ?? "") as ReportStatus;
  if (reportId.length === 0 || (status !== "resolved" && status !== "dismissed")) return;

  const noteRaw = formData.get("resolution_note");
  const note = typeof noteRaw === "string" ? noteRaw.trim() : "";

  await supabase
    .from("reports")
    .update({
      status,
      resolved_by: user.id,
      resolved_at: new Date().toISOString(),
      resolution_note: note.length > 0 ? note : null,
    })
    .eq("id", reportId);

  revalidatePath("/mod/reports");
  revalidatePath("/mod");
}

export type SendWarningState = { error: string } | null;

// Always sent from the Staff pseudo-account (send_staff_message RPC,
// 0029_bans_and_staff_fixes.sql) — NEVER the acting moderator's own
// account. Deliberate mod anonymity: a player who gets warned should
// never be able to tell which specific moderator handled their case, only
// that staff did, so they can't target that mod over a decision the team
// made collectively. A canned message or a custom one both go through
// here identically.
export async function sendStaffWarning(
  _prevState: SendWarningState,
  formData: FormData,
): Promise<SendWarningState> {
  const { supabase } = await requireModerator();

  const targetUserId = String(formData.get("target_user_id") ?? "");
  const message = String(formData.get("message") ?? "").trim();

  if (targetUserId.length === 0) {
    return { error: "Missing target player." };
  }
  if (message.length === 0) {
    return { error: "Pick a canned message or write your own first." };
  }
  if (message.length > 4000) {
    return { error: "Message must be 4000 characters or fewer." };
  }

  const { data: conversationId, error } = await supabase.rpc("send_staff_message", {
    p_target_user_id: targetUserId,
    p_body: message,
  });

  if (error || !conversationId) {
    return { error: error?.message ?? "Could not send that message. Please try again." };
  }

  redirect(`/messages/${conversationId}`);
}

export type QuickQuoteState = { error: string } | null;

// The "quick quote" tool from a report card — for a board/DM content
// violation specifically, quotes the offending text back to the player
// alongside a rule-violation notice, in one step instead of a moderator
// copy-pasting the quote into the warning-DM form by hand. Same anonymous
// Staff-account delivery as sendStaffWarning above — quoting content back
// at someone is exactly the kind of message where a targeted player would
// most want to know who sent it, so this can't be an exception to mod
// anonymity.
export async function sendQuickQuote(
  _prevState: QuickQuoteState,
  formData: FormData,
): Promise<QuickQuoteState> {
  const { supabase } = await requireModerator();

  const targetUserId = String(formData.get("target_user_id") ?? "");
  const quotedContent = String(formData.get("quoted_content") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();

  if (targetUserId.length === 0) {
    return { error: "Missing target player." };
  }
  if (quotedContent.length === 0) {
    return { error: "Nothing to quote." };
  }
  if (note.length === 0) {
    return { error: "Add a short note about which rule this violated." };
  }

  const body = `The following content you posted violates our community guidelines:\n\n"${quotedContent}"\n\n${note}`;
  if (body.length > 4000) {
    return { error: "That quote plus your note is too long (4000 character limit)." };
  }

  const { data: conversationId, error } = await supabase.rpc("send_staff_message", {
    p_target_user_id: targetUserId,
    p_body: body,
  });

  if (error || !conversationId) {
    return { error: error?.message ?? "Could not send that message. Please try again." };
  }

  redirect(`/messages/${conversationId}`);
}

// Deletes the reported post AND resolves the report in one step — the
// same underlying delete as forums/actions.ts's deletePost, just entered
// from the queue's workflow instead of the thread view, so it also closes
// out the report rather than leaving it pointing at a post that no longer
// exists.
export async function deleteReportedPost(formData: FormData): Promise<void> {
  const { supabase, user } = await requireModerator();

  const reportId = String(formData.get("report_id") ?? "");
  const postId = String(formData.get("post_id") ?? "");
  if (reportId.length === 0 || postId.length === 0) return;

  await supabase.from("forum_posts").delete().eq("id", postId);
  await supabase
    .from("reports")
    .update({
      status: "resolved",
      resolved_by: user.id,
      resolved_at: new Date().toISOString(),
      resolution_note: "Post deleted.",
    })
    .eq("id", reportId);

  revalidatePath("/mod/reports");
  revalidatePath("/mod");
}

export type IssueBanState = { error: string } | null;

// Time-based (staff always choose a duration, no permanent-ban option —
// see 0029_bans_and_staff_fixes.sql's `expires_at not null` and the "check
// (expires_at > issued_at)" constraint). Account bans are admin-only to
// issue; a moderator picking "account" here still gets a friendly message
// instead of a raw RLS error, since bans' INSERT policy is the real gate.
export async function issueBan(
  _prevState: IssueBanState,
  formData: FormData,
): Promise<IssueBanState> {
  const { supabase, user } = await requireModerator();

  const targetUserId = String(formData.get("target_user_id") ?? "");
  const banType = String(formData.get("ban_type") ?? "") as BanType;
  const durationHours = Number(formData.get("duration_hours") ?? "");
  const reasonRaw = formData.get("reason");
  const reason = typeof reasonRaw === "string" ? reasonRaw.trim() : "";

  if (targetUserId.length === 0) {
    return { error: "Missing target player." };
  }
  if (!BAN_TYPES.includes(banType)) {
    return { error: "Invalid ban type." };
  }
  if (!Number.isFinite(durationHours) || durationHours <= 0) {
    return { error: "Pick a duration." };
  }
  if (reason.length > 500) {
    return { error: "Reason must be 500 characters or fewer." };
  }

  const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();

  const { error } = await supabase.from("bans").insert({
    user_id: targetUserId,
    ban_type: banType,
    reason: reason.length > 0 ? reason : null,
    issued_by: user.id,
    expires_at: expiresAt,
  });

  if (error) {
    return {
      error:
        banType === "account"
          ? "Only admins can issue account bans."
          : `Could not issue ban: ${error.message}`,
    };
  }

  revalidatePath(`/mod/players/${targetUserId}`);
  return null;
}

// Ends a ban early. Plain form action (same "just does the thing"
// convention as resolveReport/deleteReportedPost above) — the update
// policy's own ban-type/role check is the real gate on WHO can lift
// WHICH ban, so an unauthorized attempt just quietly updates 0 rows.
export async function liftBan(formData: FormData): Promise<void> {
  const { supabase, user } = await requireModerator();

  const banId = String(formData.get("ban_id") ?? "");
  const targetUserId = String(formData.get("target_user_id") ?? "");
  if (banId.length === 0) return;

  await supabase
    .from("bans")
    .update({ lifted_at: new Date().toISOString(), lifted_by: user.id })
    .eq("id", banId);

  if (targetUserId.length > 0) {
    revalidatePath(`/mod/players/${targetUserId}`);
  }
}

export type ReportHandling = "dismiss" | "warn" | "forums_ban" | "dm_ban" | "sales_ban";

const HANDLING_BAN_TYPE: Partial<Record<ReportHandling, BanType>> = {
  forums_ban: "forums",
  dm_ban: "dm",
  sales_ban: "sales",
};

const HANDLING_LABEL: Record<ReportHandling, string> = {
  dismiss: "Dismissed — no action taken.",
  warn: "Verbal warning sent.",
  forums_ban: "Forums ban issued.",
  dm_ban: "DM ban issued.",
  sales_ban: "Sales ban issued.",
};

export type HandleReportState = { error: string } | null;

// The single "handle this report" action behind the report page's
// bottom action bar. `handling` decides everything: dismiss sends
// nothing and just closes the report; every other option sends the
// composed message (via send_staff_message, so it's always the
// anonymous Staff account, never the acting moderator's own — see
// 0029_bans_and_staff_fixes.sql) and, for a ban option, also issues that
// ban with the chosen duration. Always closes the report (status =
// resolved) — this is the "confirm and send" path, as opposed to
// escalateReport below, which never sends a message and never closes.
export async function handleReport(
  _prevState: HandleReportState,
  formData: FormData,
): Promise<HandleReportState> {
  const { supabase, user } = await requireModerator();

  const reportId = String(formData.get("report_id") ?? "");
  const handling = String(formData.get("handling") ?? "") as ReportHandling;
  const message = String(formData.get("message") ?? "").trim();
  const durationHours = Number(formData.get("duration_hours") ?? "72");

  if (reportId.length === 0) return { error: "Missing report." };
  if (!Object.keys(HANDLING_LABEL).includes(handling)) return { error: "Pick how to handle this." };

  const { data: report } = await supabase
    .from("reports")
    .select("target_type, target_user_id, target_post_author_id, target_message_sender_id")
    .eq("id", reportId)
    .maybeSingle();
  if (!report) return { error: "Report not found." };

  const offendingUserId =
    report.target_type === "user"
      ? report.target_user_id
      : report.target_type === "forum_post"
        ? report.target_post_author_id
        : report.target_message_sender_id;

  if (handling !== "dismiss") {
    if (message.length === 0) return { error: "Write a message to the player first." };
    if (message.length > 4000) return { error: "Message must be 4000 characters or fewer." };
    if (!offendingUserId) return { error: "Can't message this player — their account or content is gone." };

    const { error: messageError } = await supabase.rpc("send_staff_message", {
      p_target_user_id: offendingUserId,
      p_body: message,
    });
    if (messageError) {
      return { error: `Could not send that message: ${messageError.message}` };
    }
  }

  const banType = HANDLING_BAN_TYPE[handling];
  if (banType && offendingUserId) {
    const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();
    const { error: banError } = await supabase.from("bans").insert({
      user_id: offendingUserId,
      ban_type: banType,
      issued_by: user.id,
      expires_at: expiresAt,
      reason: `From report handling (${reportId}).`,
    });
    if (banError) {
      return { error: `Message sent, but the ban failed: ${banError.message}` };
    }
  }

  await supabase
    .from("reports")
    .update({
      status: "resolved",
      resolved_by: user.id,
      resolved_at: new Date().toISOString(),
      resolution_note: HANDLING_LABEL[handling],
    })
    .eq("id", reportId);

  revalidatePath("/mod/reports");
  revalidatePath("/mod");
  if (offendingUserId) revalidatePath(`/mod/players/${offendingUserId}`);
  redirect("/mod/reports");
}

// "Send this to an admin instead" — no message sent, report doesn't
// close, just moves to the 'escalated' status (0030_simple_report_
// handling.sql). Plain form action, same "just does the thing"
// convention as resolveReport/deleteReportedPost.
export async function escalateReportSimple(formData: FormData): Promise<void> {
  const { supabase } = await requireModerator();

  const reportId = String(formData.get("report_id") ?? "");
  if (reportId.length === 0) return;

  await supabase.from("reports").update({ status: "escalated" }).eq("id", reportId);

  revalidatePath("/mod/reports");
  revalidatePath("/mod");
  redirect("/mod/reports");
}

// Claiming, restored from the reverted ticket round (0033_claiming_and_
// note_edits.sql) — plain form actions, same "just does the thing"
// convention as resolveReport/deleteReportedPost. No ownership check on
// unclaim: any staff member can claim or unclaim any report, so a claim
// never gets permanently stuck if that mod goes AFK.
export async function claimReport(formData: FormData): Promise<void> {
  const { supabase, user } = await requireModerator();

  const reportId = String(formData.get("report_id") ?? "");
  if (reportId.length === 0) return;

  await supabase
    .from("reports")
    .update({ claimed_by: user.id, claimed_at: new Date().toISOString() })
    .eq("id", reportId);

  revalidatePath("/mod/reports");
  revalidatePath(`/mod/reports/${reportId}`);
}

export async function unclaimReport(formData: FormData): Promise<void> {
  const { supabase } = await requireModerator();

  const reportId = String(formData.get("report_id") ?? "");
  if (reportId.length === 0) return;

  await supabase.from("reports").update({ claimed_by: null, claimed_at: null }).eq("id", reportId);

  revalidatePath("/mod/reports");
  revalidatePath(`/mod/reports/${reportId}`);
}

export type AddPlayerNoteState = { error: string } | null;

// Private, staff-only, dated and attributed (player_notes,
// 0032_simple_report_handling.sql) — shown on the report-handling page
// for context on a player's history. Separate from resolution_note.
export async function addPlayerNote(
  _prevState: AddPlayerNoteState,
  formData: FormData,
): Promise<AddPlayerNoteState> {
  const { supabase, user } = await requireModerator();

  const targetUserId = String(formData.get("user_id") ?? "");
  const reportId = formData.get("report_id");
  const body = String(formData.get("body") ?? "").trim();

  if (targetUserId.length === 0) return { error: "Missing player." };
  if (body.length === 0) return { error: "Write a note first." };
  if (body.length > 2000) return { error: "Note must be 2000 characters or fewer." };

  const { error } = await supabase.from("player_notes").insert({
    user_id: targetUserId,
    author_id: user.id,
    body,
  });

  if (error) {
    return { error: `Could not save note: ${error.message}` };
  }

  if (typeof reportId === "string" && reportId.length > 0) {
    revalidatePath(`/mod/reports/${reportId}`);
  }
  revalidatePath(`/mod/players/${targetUserId}`);
  return null;
}

export type UpdatePlayerNoteState = { error: string } | { success: true } | null;

// Lets the author (only) fix a note they already wrote — RLS ("Authors
// can edit their own player notes", 0033_claiming_and_note_edits.sql) is
// the real backstop; a non-author's update matches 0 rows rather than
// erroring, so `.select().maybeSingle()` is how this tells "edited" from
// "silently blocked" apart to give a friendly message instead of a quiet
// no-op.
export async function updatePlayerNote(
  _prevState: UpdatePlayerNoteState,
  formData: FormData,
): Promise<UpdatePlayerNoteState> {
  const { supabase } = await requireModerator();

  const noteId = String(formData.get("note_id") ?? "");
  const targetUserId = String(formData.get("user_id") ?? "");
  const reportId = formData.get("report_id");
  const body = String(formData.get("body") ?? "").trim();

  if (noteId.length === 0) return { error: "Missing note." };
  if (body.length === 0) return { error: "Write a note first." };
  if (body.length > 2000) return { error: "Note must be 2000 characters or fewer." };

  const { data: updated, error } = await supabase
    .from("player_notes")
    .update({ body, edited_at: new Date().toISOString() })
    .eq("id", noteId)
    .select("id")
    .maybeSingle();

  if (error) {
    return { error: `Could not save note: ${error.message}` };
  }
  if (!updated) {
    return { error: "You can only edit your own notes." };
  }

  if (typeof reportId === "string" && reportId.length > 0) {
    revalidatePath(`/mod/reports/${reportId}`);
  }
  if (targetUserId.length > 0) {
    revalidatePath(`/mod/players/${targetUserId}`);
  }
  return { success: true };
}

export type DeleteAccountState = { error: string } | null;

// Admin-only (requireAdmin(), not requireModerator() — this is the one
// truly irreversible action anywhere in /mod) — deletes a player's
// account and everything that cascades from it. See
// admin_delete_account's own comment in 0072: mainly here so the
// onboarding flow (0070) can be tested repeatedly by clearing out a
// test account and reusing the same Google sign-in. Redirects to /mod
// on success since the page this was submitted from (the now-deleted
// player's own) no longer exists.
export async function deleteAccount(
  _prevState: DeleteAccountState,
  formData: FormData,
): Promise<DeleteAccountState> {
  const { supabase, user } = await requireAdmin();

  const targetUserId = String(formData.get("target_user_id") ?? "");
  if (targetUserId.length === 0) {
    return { error: "Missing target player." };
  }

  const { error } = await supabase.rpc("admin_delete_account", {
    p_admin_user_id: user.id,
    p_target_user_id: targetUserId,
  });

  if (error) {
    return { error: error.message };
  }

  redirect("/mod");
}
