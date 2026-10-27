import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UsernameCard } from "./username-card";
import { EditProfileForm } from "./edit-profile-form";

const NAME_CHANGE_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;

// Matches furgarden-design (fg-edit)'s pages/edit-profile.html — the
// account-settings page everyone reaches via the profile's "Edit
// profile" button. Same .panel.edit/.pf-grid shell as the profile
// itself, so the Bio card lines up at the same width.
export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from("users")
    .select("display_name, display_name_changed_at, bio, gem_balance, avatar_url, who_can_message")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    throw new Error("Failed to load account settings.");
  }

  const nextChangeAvailableAt = new Date(
    new Date(profile.display_name_changed_at).getTime() + NAME_CHANGE_COOLDOWN_MS,
  ).toISOString();

  return (
    <main id="main">
      <div className="sheet">
        <div className="panel edit">
          <EditProfileForm
            usernameCard={
              <UsernameCard
                userId={user.id}
                displayName={profile.display_name}
                gemBalance={profile.gem_balance}
                nextChangeAvailableAt={nextChangeAvailableAt}
              />
            }
            profileUrl={`/u/${user.id}`}
            avatarUrl={profile.avatar_url}
            bio={profile.bio ?? ""}
            whoCanMessage={profile.who_can_message}
          />
        </div>
      </div>
    </main>
  );
}
