import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// /profile has no page of its own anymore — profiles are unified (see
// ProfilePanel), so "my profile" is just /u/[my own id] viewed with
// view="owner". This route still exists only to run the two one-time/
// lazy side effects that used to live in this page's render (granting
// the starter pet, resolving any expedition whose timer already
// elapsed) before sending the player on to the real page.
export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // First-ever visit: grants the free starter pet + starts its one-time,
  // fixed-length tutorial expedition. A no-op on every later visit
  // (guarded server-side by users.starter_granted).
  await supabase.rpc("grant_starter_pet_and_tutorial", { p_user_id: user.id });
  // Lazily resolves any expedition whose timer has already elapsed —
  // there's no background job in this phase, so this runs on every load.
  await supabase.rpc("resolve_due_expeditions", { p_user_id: user.id });

  redirect(`/u/${user.id}`);
}
