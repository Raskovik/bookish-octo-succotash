import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfilePanel } from "@/components/profile-panel";

export default async function PublicProfilePage(props: PageProps<"/u/[id]">) {
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

  const [{ count: petCount }, { data: viewerProfile }, { data: viewerBlock }, { data: friendship }] = await Promise.all([
    supabase.from("pets").select("id", { count: "exact", head: true }).eq("owner_id", profile.id),
    // Staff-only affordance (see /mod/players/[userId]) — not gated behind
    // anything special here beyond checking the viewer's own role, since
    // the destination page independently enforces requireModerator() too.
    viewer
      ? supabase.from("users").select("is_admin, is_moderator").eq("id", viewer.id).single()
      : Promise.resolve({ data: null }),
    viewer && !isOwnProfile
      ? supabase.from("blocks").select("blocked_id").eq("blocker_id", viewer.id).eq("blocked_id", profile.id).maybeSingle()
      : Promise.resolve({ data: null }),
    // Either direction of an accepted friendship counts as "friend";
    // only the viewer-as-requester direction of a pending row shows
    // "pending" here — a request where the VIEWER is the addressee is
    // only ever acted on from the notifications tray, not this page.
    viewer && !isOwnProfile
      ? supabase
          .from("friendships")
          .select("requester_id, addressee_id, status")
          .or(
            `and(requester_id.eq.${viewer.id},addressee_id.eq.${profile.id}),and(requester_id.eq.${profile.id},addressee_id.eq.${viewer.id})`,
          )
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const viewerCanModerate = (viewerProfile?.is_admin || viewerProfile?.is_moderator) ?? false;

  const isFriend = friendship?.status === "accepted";
  const isPendingFromViewer = friendship?.status === "pending" && friendship.requester_id === viewer?.id;

  const view = isOwnProfile
    ? "owner"
    : viewerBlock
      ? "blocked"
      : isFriend
        ? "friend"
        : isPendingFromViewer
          ? "pending"
          : "visitor";

  return (
    <main id="main">
      <div className="sheet">
        <ProfilePanel
          profile={profile}
          petCount={petCount ?? 0}
          view={view}
          viewerSignedIn={viewer !== null}
          viewerId={viewer?.id ?? null}
          viewerCanModerate={viewerCanModerate}
        />
      </div>
    </main>
  );
}
