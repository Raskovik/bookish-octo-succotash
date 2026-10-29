"use client";

import { useActionState, useState } from "react";
import { Flag } from "lucide-react";
import { submitReport, blockPlayer, type ReportFormState, type BlockPlayerState } from "@/lib/report-actions";
import type { ReportTargetType } from "@/lib/supabase/types";

const initialReportState: ReportFormState = null;
const initialBlockState: BlockPlayerState = null;

const CATEGORY_LABELS: Record<string, string> = {
  spam: "Spam",
  harassment: "Harassment",
  inappropriate_content: "Inappropriate content",
  scam: "Scamming",
  other: "Other",
};

/**
 * Shared by /u/[id] ("user"), the forums' PostCard ("forum_post"), and
 * DM messages ("dm_message") — now a modal popup rather than an inline
 * toggle, since submitting a report is a short, focused task that
 * shouldn't shift the surrounding layout around. `offendingUserId` is
 * who the post-submit "block this player?" prompt would block — for a
 * "user" report that's just `targetId`; for a forum post or DM message,
 * the caller passes the author/sender id explicitly, since the button
 * itself only knows the content's id.
 */
export function ReportButton({
  targetType,
  targetId,
  offendingUserId,
  label = "Report",
  triggerClassName,
}: {
  targetType: ReportTargetType;
  targetId: string;
  offendingUserId?: string;
  label?: string;
  triggerClassName?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [reportState, reportAction, isReportPending] = useActionState(submitReport, initialReportState);
  const [blockState, blockAction, isBlockPending] = useActionState(blockPlayer, initialBlockState);

  const blockTargetId = offendingUserId ?? (targetType === "user" ? targetId : undefined);
  const isSubmitted = reportState !== null && "success" in reportState;
  const isBlocked = blockState !== null && "success" in blockState;

  function close() {
    setIsOpen(false);
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={
          triggerClassName ??
          "flex items-center gap-1.5 rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
        }
      >
        {triggerClassName ? null : <Flag size={14} />}
        {label}
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={close}
    >
      <div
        className="w-full max-w-sm rounded-lg border border-green-300 bg-white p-5 shadow-lg dark:border-stone-700 dark:bg-stone-900"
        onClick={(event) => event.stopPropagation()}
      >
        {isSubmitted ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium">Report submitted. Thanks for flagging this.</p>
            {isBlocked ? (
              <p className="text-sm text-stone-500">Player blocked.</p>
            ) : blockTargetId ? (
              <>
                <p className="text-sm text-stone-600 dark:text-stone-400">Would you like to block this player?</p>
                {blockState && "error" in blockState ? (
                  <p className="text-xs text-red-600 dark:text-red-400">{blockState.error}</p>
                ) : null}
                <form action={blockAction} className="flex gap-2">
                  <input type="hidden" name="blocked_id" value={blockTargetId} />
                  <button
                    type="submit"
                    disabled={isBlockPending}
                    className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    {isBlockPending ? "Blocking…" : "Block player"}
                  </button>
                  <button
                    type="button"
                    onClick={close}
                    className="rounded-md border border-green-300 px-3 py-1.5 text-xs hover:bg-green-100 dark:border-stone-700 dark:hover:bg-stone-900"
                  >
                    No thanks
                  </button>
                </form>
              </>
            ) : (
              <button
                type="button"
                onClick={close}
                className="self-start rounded-md border border-green-300 px-3 py-1.5 text-xs hover:bg-green-100 dark:border-stone-700 dark:hover:bg-stone-900"
              >
                Close
              </button>
            )}
            {isBlocked ? (
              <button
                type="button"
                onClick={close}
                className="self-start rounded-md border border-green-300 px-3 py-1.5 text-xs hover:bg-green-100 dark:border-stone-700 dark:hover:bg-stone-900"
              >
                Close
              </button>
            ) : null}
          </div>
        ) : (
          <form action={reportAction} className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold">Report</h2>
            <input type="hidden" name="target_type" value={targetType} />
            <input type="hidden" name="target_id" value={targetId} />
            <label className="text-xs font-medium">Reason</label>
            <select
              name="category"
              required
              defaultValue=""
              className="rounded-md border border-green-300 px-2 py-1.5 text-sm dark:border-stone-700 dark:bg-stone-950"
            >
              <option value="" disabled>
                Select a reason…
              </option>
              {Object.entries(CATEGORY_LABELS).map(([value, categoryLabel]) => (
                <option key={value} value={value}>
                  {categoryLabel}
                </option>
              ))}
            </select>
            <textarea
              name="details"
              rows={3}
              maxLength={1000}
              placeholder="Any extra details (optional)"
              className="resize-y rounded-md border border-green-300 px-2 py-1.5 text-sm dark:border-stone-700 dark:bg-stone-950"
            />
            {reportState && "error" in reportState ? (
              <p className="text-xs text-red-600 dark:text-red-400">{reportState.error}</p>
            ) : null}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isReportPending}
                className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                {isReportPending ? "Submitting…" : "Submit report"}
              </button>
              <button
                type="button"
                onClick={close}
                className="rounded-md border border-green-300 px-3 py-1.5 text-xs hover:bg-green-100 dark:border-stone-700 dark:hover:bg-stone-900"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
