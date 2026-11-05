import Link from "next/link";
import { ResolveReportForm } from "./reports/resolve-report-form";
import { DeleteReportedPostButton } from "./reports/delete-reported-post-button";
import { ClaimButton } from "./reports/claim-button";
import { QuickQuoteButton } from "./quick-quote-button";
import type { ReportWithDetails } from "@/lib/supabase/types";

// Shared by /mod/reports (the queue) and /mod/players/[userId] (one
// player's report history) — same card, same resolve/dismiss/delete-post
// actions available from either place, since which page rendered it
// doesn't change what a moderator should be able to do with it.

export const CATEGORY_LABELS: Record<string, string> = {
  spam: "Spam",
  harassment: "Harassment",
  inappropriate_content: "Inappropriate content",
  scam: "Scamming",
  other: "Other",
};

const TARGET_TYPE_LABELS: Record<string, string> = {
  user: "a player",
  forum_post: "a forum post",
  dm_message: "a direct message",
};

export function ReportCard({
  report,
  currentUserId,
}: {
  report: ReportWithDetails;
  currentUserId?: string;
}) {
  const createdAt = new Date(report.created_at).toLocaleString();
  const offendingUserId =
    report.target_type === "user"
      ? report.targetUserId
      : report.target_type === "forum_post"
        ? report.targetPostAuthorId
        : report.targetMessageSenderId;

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-green-200 p-4 dark:border-stone-800">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm">
            <Link href={`/u/${report.reporterDisplayId}`} className="font-medium hover:underline">
              {report.reporterName}
            </Link>{" "}
            reported {TARGET_TYPE_LABELS[report.target_type] ?? report.target_type} —{" "}
            <span className="font-medium">{CATEGORY_LABELS[report.category] ?? report.category}</span>
          </p>
          <p className="text-xs text-stone-500">{createdAt}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Link href={`/mod/reports/${report.id}`} className="whitespace-nowrap text-xs text-stone-500 underline">
            Open report
          </Link>
          {offendingUserId ? (
            <Link href={`/mod/players/${offendingUserId}`} className="whitespace-nowrap text-xs text-stone-500 underline">
              View full history
            </Link>
          ) : null}
        </div>
      </div>

      {report.target_type === "user" ? (
        <p className="text-sm">
          Target:{" "}
          {report.targetUserId ? (
            <Link href={`/u/${report.targetUserDisplayId}`} className="font-medium hover:underline">
              {report.targetUserName}
            </Link>
          ) : (
            <span className="italic text-stone-500">deleted account</span>
          )}
        </p>
      ) : report.target_type === "forum_post" ? (
        <div className="rounded-md border border-green-100 bg-green-50/50 p-3 text-sm dark:border-stone-800 dark:bg-stone-950">
          <p className="text-xs text-stone-500">
            Post by{" "}
            {report.targetPostAuthorId ? (
              <Link href={`/u/${report.targetPostAuthorDisplayId}`} className="font-medium hover:underline">
                {report.targetPostAuthorName}
              </Link>
            ) : (
              <span className="font-medium">{report.targetPostAuthorName ?? "Unknown"}</span>
            )}
            {report.targetCategoryId && report.targetThreadId ? (
              <>
                {" "}
                —{" "}
                <Link href={`/forums/${report.targetCategoryId}/${report.targetThreadId}`} className="underline">
                  View thread
                </Link>
              </>
            ) : (
              " (post deleted)"
            )}
          </p>
          {report.targetPostBody ? (
            <p className="mt-1 line-clamp-3 whitespace-pre-wrap">{report.targetPostBody}</p>
          ) : null}
        </div>
      ) : (
        <div className="rounded-md border border-green-100 bg-green-50/50 p-3 text-sm dark:border-stone-800 dark:bg-stone-950">
          <p className="text-xs text-stone-500">
            Message from{" "}
            {report.targetMessageSenderId ? (
              <Link href={`/u/${report.targetMessageSenderDisplayId}`} className="font-medium hover:underline">
                {report.targetMessageSenderName}
              </Link>
            ) : (
              <span className="font-medium">{report.targetMessageSenderName ?? "Unknown"}</span>
            )}
            {report.targetMessageConversationId ? (
              <>
                {" "}
                —{" "}
                <Link href={`/mod/conversations/${report.targetMessageConversationId}`} className="underline">
                  View conversation
                </Link>
              </>
            ) : null}
          </p>
          {report.targetMessageBody ? (
            <p className="mt-1 line-clamp-3 whitespace-pre-wrap">{report.targetMessageBody}</p>
          ) : (
            <p className="mt-1 italic text-stone-500">Message no longer available.</p>
          )}
        </div>
      )}

      {report.details ? <p className="text-sm text-stone-600 dark:text-stone-400">&ldquo;{report.details}&rdquo;</p> : null}

      {report.status === "open" || report.status === "escalated" ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-green-100 pt-3 dark:border-stone-800">
          {currentUserId ? (
            <ClaimButton
              reportId={report.id}
              claimedByName={report.claimedByName}
              isMine={report.claimedById === currentUserId}
            />
          ) : null}
          <ResolveReportForm reportId={report.id} status="resolved" label="Mark resolved" />
          <ResolveReportForm reportId={report.id} status="dismissed" label="Dismiss" />
          {report.target_type === "forum_post" && report.targetPostId ? (
            <DeleteReportedPostButton reportId={report.id} postId={report.targetPostId} />
          ) : null}
          {offendingUserId && report.target_type === "forum_post" && report.targetPostBody ? (
            <QuickQuoteButton targetUserId={offendingUserId} quotedContent={report.targetPostBody} />
          ) : null}
          {offendingUserId && report.target_type === "dm_message" && report.targetMessageBody ? (
            <QuickQuoteButton targetUserId={offendingUserId} quotedContent={report.targetMessageBody} />
          ) : null}
        </div>
      ) : (
        <p className="border-t border-green-100 pt-3 text-xs text-stone-500 dark:border-stone-800">
          {report.status === "resolved" ? "Resolved" : "Dismissed"} by{" "}
          <span className="font-medium">{report.resolvedByName}</span>
          {report.resolved_at ? ` at ${new Date(report.resolved_at).toLocaleString()}` : ""}
          {report.resolution_note ? ` — ${report.resolution_note}` : ""}
        </p>
      )}
    </li>
  );
}
