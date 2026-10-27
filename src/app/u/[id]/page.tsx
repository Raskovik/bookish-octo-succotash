import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UserPlus, MessageCircle, Flag, PawPrint, Package } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { TRADING_ENABLED } from "@/lib/feature-flags";
import { bbcodeToHtml } from "@/lib/bbcode";
import { DisabledActionButton } from "@/components/disabled-action-button";
import { ReportButton } from "@/components/report-button";
import { PlayerLink } from "@/components/player-link";
import { startConversationWithUserId } from "@/app/messages/actions";

export default async function PublicProfilePage(
  props: PageProps<"/u/[id]">,
) {
  const { id } = await props.params;
  const supabase = await createClient();
  const {
    data: { user: viewer },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!profile) {
    notFound();
  }

  const isOwnProfile = viewer?.id === profile.id;

  // Staff-only affordance (see /mod/players/[userId]) — not gated behind
  // anything special here beyond checking the viewer's own role, since
  // the destination page independently enforces requireModerator() too.
  const { data: viewerProfile } = viewer
    ? await supabase.from("users").select("is_admin, is_moderator").eq("id", viewer.id).single()
    : { data: null };
  const viewerCanModerate = (viewerProfile?.is_admin || viewerProfile?.is_moderator) ?? false;

  const joined = new Date(profile.created_at).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <main id="main">
      <div className="sheet">
        <div className="panel flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Left column — narrower than the right, since the bio/BBCode
            side benefits from the extra room much more than a picture
            and a couple of buttons do. */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          <div className="flex items-center gap-3 rounded-lg border border-green-200 p-4 dark:border-stone-800">
            {profile.avatar_url ? (
              <Image
                src={profile.avatar_url}
                alt=""
                width={64}
                height={64}
                className="h-16 w-16 rounded-md object-cover"
              />
            ) : (
              <div className="h-16 w-16 shrink-0 rounded-md bg-green-200 dark:bg-stone-800" />
            )}
            <div>
              <h1 className="text-xl font-semibold tracking-tight">
                <PlayerLink
                  userId={profile.id}
                  name={profile.display_name}
                  isAdmin={profile.is_admin}
                  isModerator={profile.is_moderator}
                />
              </h1>
              <p className="text-xs text-stone-500">Joined {joined}</p>
              {viewerCanModerate ? (
                <Link href={`/mod/players/${profile.id}`} className="text-xs text-stone-400 underline">
                  Report history (staff only)
                </Link>
              ) : null}
            </div>
          </div>

          {!isOwnProfile ? (
            <div className="flex flex-col gap-3 rounded-lg border border-green-200 p-4 dark:border-stone-800">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
                Interact
              </h2>
              <div className="flex flex-wrap gap-2">
                <DisabledActionButton icon={UserPlus} label="Add friend" title="Friending isn't available yet" />
                {viewer ? (
                  <form action={startConversationWithUserId}>
                    <input type="hidden" name="user_id" value={profile.id} />
                    <button
                      type="submit"
                      className="flex items-center gap-1.5 rounded-md border border-green-300 px-3 py-2 text-sm hover:bg-green-100 dark:border-stone-700 dark:hover:bg-stone-900"
                    >
                      <MessageCircle size={16} />
                      Send DM
                    </button>
                  </form>
                ) : (
                  <DisabledActionButton icon={MessageCircle} label="Send DM" title="Sign in to send a message" />
                )}
                {TRADING_ENABLED && viewer ? (
                  <Link
                    href={`/trades/new?to=${encodeURIComponent(profile.display_name)}`}
                    className="rounded-md bg-green-800 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 dark:bg-green-200 dark:text-green-950 dark:hover:bg-green-300"
                  >
                    Propose a trade
                  </Link>
                ) : null}
                {viewer ? (
                  <ReportButton targetType="user" targetId={profile.id} label="Report player" />
                ) : (
                  <DisabledActionButton icon={Flag} label="Report player" title="Sign in to report a player" />
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* Right column — wider; this is where the bio/BBCode content
            actually needs the room. */}
        <div className="flex flex-col gap-4 lg:col-span-3">
          <div className="flex flex-col gap-3 rounded-lg border border-green-200 p-4 dark:border-stone-800">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
              {profile.display_name}&apos;s stuff
            </h2>
            <div className="flex gap-3">
              <DisabledActionButton
                icon={PawPrint}
                label="Pets"
                title="Browsing another player's pets isn't available yet"
              />
              <DisabledActionButton
                icon={Package}
                label="Items"
                title="Browsing another player's items isn't available yet"
              />
            </div>
          </div>

          <div className="flex min-h-40 flex-1 flex-col gap-2 rounded-lg border border-green-200 p-4 dark:border-stone-800">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Bio</h2>
            {profile.bio ? (
              // bbcodeToHtml() is the only thing ever allowed to turn user text
              // into HTML — see src/lib/bbcode.ts. Runs fresh on every render;
              // profile.bio is raw BBCode source, never rendered directly.
              <div
                className="forum-content text-stone-700 dark:text-stone-300"
                dangerouslySetInnerHTML={{ __html: bbcodeToHtml(profile.bio) }}
              />
            ) : (
              <p className="text-stone-500 italic">This player hasn&apos;t written a bio yet.</p>
            )}
          </div>
        </div>
      </div>
        </div>
      </div>
    </main>
  );
}
