import Image from "next/image";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { TRADING_ENABLED } from "@/lib/feature-flags";
import { PetNameEditor } from "../pet-name-editor";
import { MoveToFolderSelect } from "../move-to-folder-select";
import { ForTradeToggle } from "../for-trade-toggle";
import { PetBioEditor } from "../pet-bio-editor";
import type { PetDetail, PetFolderRow } from "@/lib/supabase/types";

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

  const [{ data: petData }, { data: foldersData }] = await Promise.all([
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
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-12">
      <Link href="/pets" className="flex w-fit items-center gap-1.5 text-sm text-stone-500 hover:underline">
        <ArrowLeft size={14} />
        Back to pets
      </Link>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-[220px_1fr]">
        {/* ── Left column: portrait + identity ────────────────────────── */}
        <div className="flex flex-col items-center gap-3 rounded-xl border border-green-200 p-5 text-center dark:border-stone-800">
          {pet.species?.image_url ? (
            <Image
              src={pet.species.image_url}
              alt={pet.species?.name ?? ""}
              width={160}
              height={160}
              className="h-40 w-40 rounded-lg border-2 border-blue-600 object-cover"
            />
          ) : (
            <div className="h-40 w-40 rounded-lg bg-green-200 dark:bg-stone-800" />
          )}
          <PetNameEditor userId={user.id} petId={pet.id} customName={pet.custom_name} />
        </div>

        {/* ── Right column: info + bio ─────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          <section className="flex flex-col gap-1.5 rounded-xl border border-green-200 p-4 dark:border-stone-800">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-500">Details</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-stone-500">Species</dt>
              <dd className="capitalize">{pet.species?.name ?? "Unknown"}</dd>
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

          <section className="flex flex-col gap-2 rounded-xl border border-green-200 p-4 dark:border-stone-800">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-500">Bio</h2>
            <PetBioEditor userId={user.id} petId={pet.id} bio={pet.bio} />
          </section>
        </div>
      </div>
    </main>
  );
}
