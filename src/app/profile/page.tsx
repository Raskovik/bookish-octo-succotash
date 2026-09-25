import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PawPrint, Package } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { compositeMissingPetImages } from "@/lib/pet-compositor";
import { bbcodeToHtml } from "@/lib/bbcode";
import { ExpeditionCountdown } from "@/components/expedition-countdown";
import { PlayerLink } from "@/components/player-link";
import type { ExpeditionWithZone } from "@/lib/supabase/types";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    throw new Error("Failed to load profile for the signed-in user.");
  }

  // First-ever visit: grants the free starter pet + starts its one-time,
  // fixed-length tutorial expedition. A no-op on every later visit
  // (guarded server-side by users.starter_granted).
  await supabase.rpc("grant_starter_pet_and_tutorial", { p_user_id: user.id });
  // Lazily resolves any expedition whose timer has already elapsed —
  // there's no background job in this phase, so this runs on every load.
  await supabase.rpc("resolve_due_expeditions", { p_user_id: user.id });
  // Either RPC above can create a trait-based pet with no composited
  // image yet (Postgres can't run the sharp-based compositor itself) —
  // this fills it in, a no-op once every owned pet already has one.
  await compositeMissingPetImages(supabase, user.id);

  const [{ count: petCount }, { data: expeditionsData }] = await Promise.all([
    supabase
      .from("pets")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", user.id),
    supabase
      .from("expeditions")
      .select("id, status, is_tutorial, resolves_at, zones(name, description, image_url)")
      .eq("user_id", user.id)
      .eq("status", "in_progress"),
  ]);

  // Hand-cast: see the comment on ExpeditionWithZone in
  // lib/supabase/types.ts for why this joined select isn't inferred.
  const activeExpeditions = (expeditionsData ?? []) as unknown as ExpeditionWithZone[];

  const joined = new Date(profile.created_at).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-12">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Left column — narrower than the right, since the bio/BBCode
            side benefits from the extra room much more than a picture
            and a handful of stats do. */}
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
              <Link href="/settings" className="text-xs underline">
                Edit profile
              </Link>
            </div>
          </div>

          <div className="flex flex-col gap-2 rounded-lg border border-green-200 p-3 dark:border-stone-800">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              Player stats
            </h2>
            <dl className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
              <div className="flex items-center gap-1">
                <dt className="text-stone-500">🪙</dt>
                <dd className="font-medium">{profile.coin_balance}</dd>
              </div>
              <div className="flex items-center gap-1">
                <dt className="text-stone-500">💎</dt>
                <dd className="font-medium">{profile.gem_balance}</dd>
              </div>
              <div className="flex items-center gap-1">
                <dt className="text-stone-500">Pets</dt>
                <dd className="font-medium">
                  {petCount ?? 0} / {profile.den_size}
                </dd>
              </div>
            </dl>
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-green-200 p-4 dark:border-stone-800">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
              Active expedition
            </h2>
            {activeExpeditions.length > 0 ? (
              activeExpeditions.map((expedition) => (
                <div key={expedition.id} className="flex items-center gap-4">
                  {expedition.zones?.image_url ? (
                    <Image
                      src={expedition.zones.image_url}
                      alt=""
                      width={64}
                      height={48}
                      className="h-12 w-16 rounded"
                    />
                  ) : null}
                  <div>
                    <p className="font-medium">
                      {expedition.is_tutorial ? "Tutorial expedition" : expedition.zones?.name}
                    </p>
                    <p className="text-xs text-stone-500">
                      {expedition.zones?.description ??
                        "This box is meant to hold this zone's flavor description."}
                    </p>
                    <ExpeditionCountdown resolvesAt={expedition.resolves_at} />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-stone-500">
                No expedition in progress.{" "}
                <Link href="/expeditions" className="underline">
                  Send a pet out
                </Link>
                .
              </p>
            )}
          </div>
        </div>

        {/* Right column — wider; this is where the bio/BBCode content
            actually needs the room. */}
        <div className="flex flex-col gap-4 lg:col-span-3">
          <div className="flex flex-col gap-3 rounded-lg border border-green-200 p-4 dark:border-stone-800">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
              My stuff
            </h2>
            <div className="flex gap-3">
              <Link
                href="/pets"
                className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-green-300 px-3 py-2 text-sm hover:bg-green-100 dark:border-stone-700 dark:hover:bg-stone-900"
              >
                <PawPrint size={16} />
                Pets
              </Link>
              <Link
                href="/items"
                className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-green-300 px-3 py-2 text-sm hover:bg-green-100 dark:border-stone-700 dark:hover:bg-stone-900"
              >
                <Package size={16} />
                Items
              </Link>
            </div>
          </div>

          <div className="flex min-h-40 flex-1 flex-col gap-2 rounded-lg border border-green-200 p-4 dark:border-stone-800">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Bio</h2>
            {profile.bio ? (
              // bbcodeToHtml() is the only thing ever allowed to turn user
              // text into HTML — see src/lib/bbcode.ts. Runs fresh on every
              // render; profile.bio is raw BBCode source, never rendered
              // directly.
              <div
                className="forum-content text-stone-700 dark:text-stone-300"
                dangerouslySetInnerHTML={{ __html: bbcodeToHtml(profile.bio) }}
              />
            ) : (
              <p className="text-stone-500 italic">
                No bio yet.{" "}
                <Link href="/settings" className="underline">
                  Add one
                </Link>
                .
              </p>
            )}
          </div>
        </div>
      </div>

      <Link
        href={`/u/${profile.id}`}
        className="self-start rounded-md border border-green-300 px-4 py-2 text-sm hover:bg-green-100 dark:border-stone-700 dark:hover:bg-stone-900"
      >
        View public profile
      </Link>
    </main>
  );
}
