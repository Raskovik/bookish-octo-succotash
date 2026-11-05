import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail } from "lucide-react";
import { requireModerator } from "@/lib/moderation";
import { resolveReportDetails } from "../../resolve-reports";
import { ReportCard } from "../../report-card";
import { WarningDmForm } from "./warning-dm-form";
import { BanForm } from "./ban-form";
import { BansList } from "./bans-list";
import { formatShortDate } from "@/lib/format-forum-date";
import type { BanWithIssuer, ReportRow } from "@/lib/supabase/types";

// Staff-only (requireModerator()) — a player's full moderation history:
// every report where they're the target (directly, or as the author of a
// reported post/message — see target_post_author_id/
// target_message_sender_id, 0028_moderation_round_two.sql), plus every
// DM conversation they're part of, each linking to the read-only staff
// log viewer at /mod/conversations/[conversationId]. Never linked from
// anywhere a regular player can reach — /u/[id] only shows a link here
// to a viewer whose own role check already passed.
export default async function ModPlayerPage(props: PageProps<"/mod/players/[userId]">) {
  const { userId } = await props.params;
  const { supabase, user } = await requireModerator();

  const { data: profile } = await supabase.from("user_profiles").select("*").eq("id", userId).maybeSingle();

  if (!profile) {
    notFound();
  }

  const [{ data: viewerProfile }, { data: reportsData }, { data: conversationsData }, { data: cannedData }, { data: bansData }] =
    await Promise.all([
      supabase.from("users").select("is_admin").eq("id", user.id).single(),
      supabase
        .from("reports")
        .select("*")
        .or(
          `target_user_id.eq.${userId},target_post_author_id.eq.${userId},target_message_sender_id.eq.${userId}`,
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("dm_conversations")
        .select("*")
        .or(`user_one_id.eq.${userId},user_two_id.eq.${userId}`)
        .order("last_message_at", { ascending: false }),
      supabase.from("canned_staff_messages").select("label, body").eq("is_active", true).order("sort_order"),
      supabase.from("bans").select("*").eq("user_id", userId).order("issued_at", { ascending: false }),
    ]);

  const reports = await resolveReportDetails(supabase, (reportsData ?? []) as ReportRow[]);

  const issuerIds = [...new Set((bansData ?? []).map((b) => b.issued_by))];
  const { data: issuerProfiles } =
    issuerIds.length > 0
      ? await supabase.from("user_profiles").select("id, display_name").in("id", issuerIds)
      : { data: [] };
  const issuerNameById = new Map((issuerProfiles ?? []).map((p) => [p.id, p.display_name]));
  const bans: BanWithIssuer[] = (bansData ?? []).map((b) => ({
    id: b.id,
    ban_type: b.ban_type,
    reason: b.reason,
    issued_at: b.issued_at,
    expires_at: b.expires_at,
    lifted_at: b.lifted_at,
    issuedByName: issuerNameById.get(b.issued_by) ?? "Unknown",
  }));

  const conversations = conversationsData ?? [];
  const otherUserIds = [
    ...new Set(conversations.map((c) => (c.user_one_id === userId ? c.user_two_id : c.user_one_id))),
  ];
  const { data: otherProfilesData } =
    otherUserIds.length > 0
      ? await supabase.from("user_profiles").select("id, display_name").in("id", otherUserIds)
      : { data: [] };
  const otherNameById = new Map((otherProfilesData ?? []).map((p) => [p.id, p.display_name]));

  const joined = new Date(profile.created_at).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4 rounded-lg border border-green-200 p-4 dark:border-stone-800">
        {profile.avatar_url ? (
          <Image src={profile.avatar_url} alt="" width={64} height={64} className="h-16 w-16 rounded-md object-cover" />
        ) : (
          <div className="h-16 w-16 rounded-md bg-green-200 dark:bg-stone-800" />
        )}
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{profile.display_name}</h1>
          <p className="text-xs text-stone-500">Joined {joined}</p>
          <Link href={`/u/${profile.display_id}`} className="text-xs underline">
            View public profile
          </Link>
        </div>
      </div>

      <WarningDmForm
        targetUserId={profile.id}
        targetName={profile.display_name}
        cannedMessages={cannedData ?? []}
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Bans</h2>
        <BanForm targetUserId={profile.id} isAdmin={viewerProfile?.is_admin ?? false} />
        <BansList bans={bans} targetUserId={profile.id} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Conversations</h2>
        {conversations.length === 0 ? (
          <p className="text-sm italic text-stone-500">No conversations.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {conversations.map((c) => {
              const otherId = c.user_one_id === userId ? c.user_two_id : c.user_one_id;
              return (
                <li key={c.id}>
                  <Link
                    href={`/mod/conversations/${c.id}`}
                    className="flex items-center justify-between gap-3 rounded-md border border-green-200 px-4 py-2.5 text-sm hover:bg-green-50 dark:border-stone-800 dark:hover:bg-stone-900"
                  >
                    <span className="flex items-center gap-2">
                      <Mail size={14} className="text-stone-400" />
                      With <span className="font-medium">{otherNameById.get(otherId) ?? "Unknown"}</span>
                    </span>
                    <span className="text-xs text-stone-500">{formatShortDate(c.last_message_at)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Report history ({reports.length})</h2>
        {reports.length === 0 ? (
          <p className="text-sm italic text-stone-500">No reports about this player.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {reports.map((report) => (
              <ReportCard key={report.id} report={report} currentUserId={user.id} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
