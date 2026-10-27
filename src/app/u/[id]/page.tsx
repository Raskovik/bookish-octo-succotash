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

  const [{ count: petCount }, { data: viewerProfile }, { data: viewerBlock }] = await Promise.all([
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
  ]);

  const viewerCanModerate = (viewerProfile?.is_admin || viewerProfile?.is_moderator) ?? false;

  const view = isOwnProfile ? "owner" : viewerBlock ? "blocked" : "visitor";

  return (
    <main id="main">
      <div className="sheet">
        <ProfilePanel
          profile={profile}
          petCount={petCount ?? 0}
          view={view}
          viewerSignedIn={viewer !== null}
          viewerCanModerate={viewerCanModerate}
        />
      </div>
    </main>
  );
}
