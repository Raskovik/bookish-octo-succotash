import Image from "next/image";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { TRADING_ENABLED } from "@/lib/feature-flags";
import { petImageUrl, petTypeName, petAgeLabel } from "@/lib/pet-display";
import { PetNameEditor } from "../pet-name-editor";
import { MoveToFolderSelect } from "../move-to-folder-select";
import { ForTradeToggle } from "../for-trade-toggle";
import { PetBioEditor } from "../pet-bio-editor";
import type { PetDetail, PetFolderRow } from "@/lib/supabase/types";

// Buttons for systems that don't exist yet (stats/leveling, feeding, a
// quick-sell path). Shown so the layout reads complete rather than
// missing pieces, but disabled rather than silently doing nothing.
function ComingSoonButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      disabled
      title="Coming soon"
      className="rounded-md border border-green-200 px-4 py-2 text-sm font-medium text-stone-400 disabled:cursor-not-allowed dark:border-stone-800 dark:text-stone-600"
    >
      {label}
    </button>
  );
}

// Owner-only, same as the /pets grid itself — pets has no public-viewing
// story yet (see /u/[id]'s "Browsing another player's pets isn't
// available yet"), so a pet that exists but belongs to someone else 404s
// exactly like one that doesn't exist at all, rather than leaking which
// case it is.
export default async function PetDetailPage(props: PageProps<"/pets/[petId]">) {
  const { petId } = await props.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: petData }, { data: foldersData }, { count: adventureCount }] = await Promise.all([
    supabase
      .from("pets")
      .select(
        "id, rarity, color_variant, folder_id, custom_name, is_for_trade, bio, created_at, species(name, image_url)",
      )
      .eq("id", petId)
      .eq("owner_id", user.id)
      .maybeSingle(),
    supabase
      .from("pet_folders")
      .select("id, owner_id, name, created_at")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("expeditions")
      .select("*", { count: "exact", head: true })
      .eq("pet_id", petId)
      .eq("user_id", user.id),
  ]);

  if (!petData) {
    notFound();
  }

  const pet = petData as unknown as PetDetail;
  const folders = (foldersData ?? []) as PetFolderRow[];
  const folderOptions = folders.map((f) => ({ id: f.id, name: f.name }));

  const adopted = new Date(pet.created_at).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-12">
      <Link href="/pets" className="flex w-fit items-center gap-1.5 text-sm text-stone-500 hover:underline">
        <ArrowLeft size={14} />
        Back to pets
      </Link>

      <div className="overflow-hidden rounded-2xl border border-green-200 bg-white/60 dark:border-stone-800 dark:bg-stone-950/40">
        {/* ── Level + name ─────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-green-100 p-5 dark:border-stone-900">
          <span
            title="Leveling isn't built yet"
            className="rounded-full border border-green-200 px-3 py-1 text-xs font-semibold text-stone-400 dark:border-stone-800 dark:text-stone-600"
          >
            Lv. —
          </span>
          <PetNameEditor userId={user.id} petId={pet.id} customName={pet.custom_name} />
        </div>

        {/* ── Portrait ─────────────────────────────────────────────────── */}
        <div className="flex justify-center p-6">
          {petImageUrl(pet) ? (
            <Image
              src={petImageUrl(pet)!}
              alt={petTypeName(pet)}
              width={240}
              height={240}
              className="h-56 w-56 rounded-lg border-2 border-blue-600 object-cover sm:h-64 sm:w-64"
            />
          ) : (
            <div className="h-56 w-56 rounded-lg bg-green-200 dark:bg-stone-800 sm:h-64 sm:w-64" />
          )}
        </div>

        {/* ── Facts / stats / actions ──────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-6 border-t border-green-100 p-5 dark:border-stone-900 sm:grid-cols-[1fr_1.3fr_auto]">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
            <dt className="text-stone-500">Name</dt>
            <dd className={pet.custom_name ? "" : "italic text-stone-500"}>{pet.custom_name ?? "Unnamed"}</dd>
            <dt className="text-stone-500">Species</dt>
            <dd className="capitalize">{petTypeName(pet)}</dd>
            <dt className="text-stone-500">Age</dt>
            <dd>{petAgeLabel(pet.created_at)}</dd>
            <dt className="text-stone-500">Adventures</dt>
            <dd>{adventureCount ?? 0}</dd>
          </dl>

          <div className="flex flex-col gap-3">
            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-stone-500">
                <span>Energy</span>
                <span className="italic text-stone-400 dark:text-stone-600">Coming soon</span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-green-100 dark:bg-stone-800">
                <div className="h-full w-full bg-green-300 dark:bg-stone-700" />
              </div>
            </div>

            <div className="rounded-lg border border-dashed border-green-200 p-3 dark:border-stone-800">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Stats</p>
                <p className="text-[11px] italic text-stone-400 dark:text-stone-600">Coming soon</p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                <div>
                  <p className="text-xs text-stone-500">ATK</p>
                  <p className="font-semibold text-stone-400 dark:text-stone-600">—</p>
                </div>
                <div>
                  <p className="text-xs text-stone-500">DEF</p>
                  <p className="font-semibold text-stone-400 dark:text-stone-600">—</p>
                </div>
                <div>
                  <p className="text-xs text-stone-500">STR</p>
                  <p className="font-semibold text-stone-400 dark:text-stone-600">—</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-row gap-2 sm:flex-col">
            <ComingSoonButton label="Feed" />
            <ComingSoonButton label="Sell" />
            <ComingSoonButton label="Release" />
          </div>
        </div>

        {/* ── Bio ──────────────────────────────────────────────────────── */}
        <div className="border-t border-green-100 p-5 dark:border-stone-900">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Bio</h2>
          <PetBioEditor userId={user.id} petId={pet.id} bio={pet.bio} />
        </div>
      </div>

      {/* ── Organize + details ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <section className="flex flex-col gap-2 rounded-xl border border-green-200 p-4 dark:border-stone-800">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-500">Organize</h2>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              Folder
              <MoveToFolderSelect
                userId={user.id}
                petId={pet.id}
                currentFolderId={pet.folder_id}
                folders={folderOptions}
              />
            </label>
            {TRADING_ENABLED ? (
              <ForTradeToggle userId={user.id} petId={pet.id} isForTrade={pet.is_for_trade} />
            ) : null}
          </div>
        </section>

        <section className="flex flex-col gap-1.5 rounded-xl border border-green-200 p-4 dark:border-stone-800">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-500">Details</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-stone-500">Rarity</dt>
            <dd className="capitalize">{pet.rarity}</dd>
            {pet.color_variant ? (
              <>
                <dt className="text-stone-500">Color</dt>
                <dd className="capitalize">{pet.color_variant}</dd>
              </>
            ) : null}
            <dt className="text-stone-500">Adopted</dt>
            <dd>{adopted}</dd>
            <dt className="text-stone-500">ID</dt>
            <dd className="font-mono text-xs text-stone-500">{pet.id}</dd>
          </dl>
        </section>
      </div>
    </main>
  );
}
