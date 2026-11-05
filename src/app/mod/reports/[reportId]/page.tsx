import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireModerator } from "@/lib/moderation";
import { resolveReportDetails, resolvePlayerNotes } from "../../resolve-reports";
import { CATEGORY_LABELS } from "../../report-card";
import { PlayerNotes } from "../player-notes";
import { ReportHandlingForm } from "../report-handling-form";
import { ClaimButton } from "../claim-button";
import type { ReportRow } from "@/lib/supabase/types";

// The report-handling page — one report, one page, laid out to match the
// requested wireframe: the offending player's identity/notes/history on
// the left, the report itself plus the response tools on the right. No
// dedup/claiming/priority — reports are handled one at a time, and if
// several people reported the same thing, each shows up as its own
// report here (the "Links to past reports" list on the left is how a mod
// notices that pattern, not automatic grouping).
export default async function ReportHandlingPage(props: PageProps<"/mod/reports/[reportId]">) {
  const { reportId } = await props.params;
  const { supabase, user } = await requireModerator();

  const { data: reportRow, error: reportError } = await supabase.from("reports").select("*").eq("id", reportId).maybeSingle();
  if (reportError) {
    console.error("Failed to load report", reportId, reportError);
  }
  if (!reportRow) {
    notFound();
  }

  const [report] = await resolveReportDetails(supabase, [reportRow as ReportRow]);

  const offendingUserId =
    report.target_type === "user"
      ? report.targetUserId
      : report.target_type === "forum_post"
        ? report.targetPostAuthorId
        : report.targetMessageSenderId;

  const [{ data: offendingProfile }, { data: noteRows }, { data: pastReportsData }] = await Promise.all([
    offendingUserId
      ? supabase.from("user_profiles").select("id, display_id, display_name, avatar_url, created_at").eq("id", offendingUserId).maybeSingle()
      : Promise.resolve({ data: null }),
    offendingUserId
      ? supabase.from("player_notes").select("*").eq("user_id", offendingUserId).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    offendingUserId
      ? supabase
          .from("reports")
          .select("id, category, status, created_at")
          .or(
            `target_user_id.eq.${offendingUserId},target_post_author_id.eq.${offendingUserId},target_message_sender_id.eq.${offendingUserId}`,
          )
          .neq("id", reportId)
          .order("created_at", { ascending: false })
          .limit(10)
      : Promise.resolve({ data: [] }),
  ]);

  const playerNotes = await resolvePlayerNotes(supabase, noteRows ?? []);
  const pastReports = pastReportsData ?? [];

  const joined = offendingProfile
    ? new Date(offendingProfile.created_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/mod/reports" className="text-sm text-stone-500 hover:underline">
          ← Back to queue
        </Link>
        {report.status === "open" || report.status === "escalated" ? (
          <ClaimButton reportId={reportId} claimedByName={report.claimedByName} isMine={report.claimedById === user.id} />
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        {/* ── Left column: the offending player ─────────────────────── */}
        <div className="flex flex-col gap-4">
          {offendingProfile ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-green-200 p-4 text-center dark:border-stone-800">
              {offendingProfile.avatar_url ? (
                <Image
                  src={offendingProfile.avatar_url}
                  alt=""
                  width={80}
                  height={80}
                  className="h-20 w-20 rounded-md object-cover"
                />
              ) : (
                <div className="h-20 w-20 rounded-md bg-green-200 dark:bg-stone-800" />
              )}
              <Link href={`/mod/players/${offendingProfile.id}`} className="font-semibold hover:underline">
                {offendingProfile.display_name}
              </Link>
              <p className="text-xs text-stone-500">Joined {joined}</p>
              <Link href={`/u/${offendingProfile.display_id}`} className="text-xs underline">
                View public profile
              </Link>
            </div>
          ) : (
            <div className="rounded-lg border border-green-200 p-4 text-center text-sm italic text-stone-500 dark:border-stone-800">
              This account or content no longer exists.
            </div>
          )}

          <section className="flex flex-col gap-2 rounded-lg border border-green-200 p-4 dark:border-stone-800">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-500">Player notes</h2>
            {offendingUserId ? (
              <PlayerNotes userId={offendingUserId} reportId={reportId} notes={playerNotes} currentUserId={user.id} />
            ) : (
              <p className="text-sm italic text-stone-500">No player to attach notes to.</p>
            )}
          </section>

          <section className="flex flex-col gap-2 rounded-lg border border-green-200 p-4 dark:border-stone-800">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-500">Past reports</h2>
            {pastReports.length === 0 ? (
              <p className="text-sm italic text-stone-500">No other reports about this player.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {pastReports.map((r) => (
                  <li key={r.id}>
                    <Link href={`/mod/reports/${r.id}`} className="text-sm hover:underline">
                      {CATEGORY_LABELS[r.category] ?? r.category}
                    </Link>{" "}
                    <span className="text-xs text-stone-500">
                      — {new Date(r.created_at).toLocaleDateString()} ({r.status})
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {offendingUserId ? (
              <Link href={`/mod/players/${offendingUserId}`} className="text-xs text-stone-500 underline">
                Full moderation history
              </Link>
            ) : null}
          </section>
        </div>

        {/* ── Right column: the report + response tools ─────────────── */}
        <div className="flex flex-col gap-4">
          <section className="flex flex-col gap-2 rounded-lg border border-green-200 p-4 dark:border-stone-800">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-500">Report</h2>
            <p className="text-sm">
              <Link href={`/u/${report.reporterDisplayId}`} className="font-medium hover:underline">
                {report.reporterName}
              </Link>{" "}
              reported <span className="font-medium">{CATEGORY_LABELS[report.category] ?? report.category}</span> on{" "}
              {new Date(report.created_at).toLocaleString()}
            </p>

            {report.target_type === "forum_post" ? (
              <div className="rounded-md border border-green-100 bg-green-50/50 p-3 text-sm dark:border-stone-800 dark:bg-stone-950">
                {report.targetCategoryId && report.targetThreadId ? (
                  <Link href={`/forums/${report.targetCategoryId}/${report.targetThreadId}`} className="text-xs underline">
                    View thread
                  </Link>
                ) : (
                  <p className="text-xs text-stone-500">(post deleted)</p>
                )}
                {report.targetPostBody ? <p className="mt-1 whitespace-pre-wrap">{report.targetPostBody}</p> : null}
              </div>
            ) : report.target_type === "dm_message" ? (
              <div className="rounded-md border border-green-100 bg-green-50/50 p-3 text-sm dark:border-stone-800 dark:bg-stone-950">
                {report.targetMessageConversationId ? (
                  <Link href={`/mod/conversations/${report.targetMessageConversationId}`} className="text-xs underline">
                    View conversation
                  </Link>
                ) : null}
                {report.targetMessageBody ? (
                  <p className="mt-1 whitespace-pre-wrap">{report.targetMessageBody}</p>
                ) : (
                  <p className="mt-1 italic text-stone-500">Message no longer available.</p>
                )}
              </div>
            ) : null}

            {report.details ? (
              <p className="text-sm text-stone-600 dark:text-stone-400">&ldquo;{report.details}&rdquo;</p>
            ) : null}
          </section>

          {report.status === "open" ? (
            <section className="rounded-lg border border-green-200 p-4 dark:border-stone-800">
              <ReportHandlingForm reportId={reportId} />
            </section>
          ) : (
            <p className="rounded-lg border border-green-200 p-4 text-sm text-stone-500 dark:border-stone-800">
              {report.status === "escalated"
                ? "This report has been escalated to admins."
                : `${report.status === "resolved" ? "Resolved" : "Dismissed"}${
                    report.resolvedByName ? ` by ${report.resolvedByName}` : ""
                  }${report.resolution_note ? ` — ${report.resolution_note}` : ""}`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
