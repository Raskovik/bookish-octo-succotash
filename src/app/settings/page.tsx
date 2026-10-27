import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "./settings-form";
import { DisplayNameEditor } from "./display-name-editor";

const NAME_CHANGE_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;

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
    .select("display_name, display_name_changed_at, bio, gem_balance, avatar_url")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    throw new Error("Failed to load account settings.");
  }

  const nextChangeAvailableAt = new Date(
    new Date(profile.display_name_changed_at).getTime() +
      NAME_CHANGE_COOLDOWN_MS,
  ).toISOString();

  return (
    <main id="main">
      <div className="sheet">
        <div className="panel flex flex-col gap-8">
      <h1 className="text-2xl font-semibold tracking-tight">Account settings</h1>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Display name</span>
        <DisplayNameEditor
          userId={user.id}
          displayName={profile.display_name}
          gemBalance={profile.gem_balance}
          nextChangeAvailableAt={nextChangeAvailableAt}
        />
      </div>

      <SettingsForm bio={profile.bio ?? ""} avatarUrl={profile.avatar_url} />
        </div>
      </div>
    </main>
  );
}
