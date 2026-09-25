import { Fragment } from "react";
import Image from "next/image";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { TRADING_ENABLED } from "@/lib/feature-flags";
import { petImageUrl, petTypeName } from "@/lib/pet-display";
import { PetNameEditor } from "../pet-name-editor";
import { MoveToFolderSelect } from "../move-to-folder-select";
import { ForTradeToggle } from "../for-trade-toggle";
import { PetBioEditor } from "../pet-bio-editor";
import type { PetDetailWithTraits, PetFolderRow } from "@/lib/supabase/types";

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
        "id, rarity, color_variant, folder_id, custom_name, is_for_trade, bio, created_at, composited_image_url, gender, " +
          "species(name, image_url), breed:breeds(name), " +
          "primaryColor:colors!pets_primary_color_id_fkey(name, hex_swatch, rarity_tier), " +
          "secondaryColor:colors!pets_secondary_color_id_fkey(name, hex_swatch, rarity_tier), " +
          "tertiaryColor:colors!pets_tertiary_color_id_fkey(name, hex_swatch, rarity_tier), " +
          "pattern:patterns(name, rarity_tier), eyeType:eye_types(name, rarity_tier), " +
          "parentA:pets!pets_parent_a_id_fkey(id, custom_name), parentB:pets!pets_parent_b_id_fkey(id, custom_name)",
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

  const pet = petData as unknown as PetDetailWithTraits;
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
          {petImageUrl(pet) ? (
            <Image
              src={petImageUrl(pet)!}
              alt={petTypeName(pet)}
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
              <dt className="text-stone-500">{pet.breed ? "Breed" : "Species"}</dt>
              <dd className="capitalize">{petTypeName(pet)}</dd>
              <dt className="text-stone-500">Rarity</dt>
              <dd className="capitalize">{pet.rarity}</dd>
              {pet.gender ? (
                <>
                  <dt className="text-stone-500">Gender</dt>
                  <dd className="capitalize">{pet.gender}</dd>
                </>
              ) : null}
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

          {pet.breed ? (
            <section className="flex flex-col gap-2 rounded-xl border border-green-200 p-4 dark:border-stone-800">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-500">Traits</h2>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
                {(
                  [
                    ["Primary color", pet.primaryColor],
                    ["Secondary color", pet.secondaryColor],
                    ["Tertiary color", pet.tertiaryColor],
                  ] as const
                ).map(([label, color]) =>
                  color ? (
                    <Fragment key={label}>
                      <dt className="text-stone-500">{label}</dt>
                      <dd className="flex items-center gap-2">
                        <span
                          className="h-4 w-4 rounded-full border border-black/10"
                          style={{ backgroundColor: color.hex_swatch }}
                        />
                        {color.name}
                        <span className="text-xs capitalize text-stone-500">({color.rarity_tier})</span>
                      </dd>
                    </Fragment>
                  ) : null,
                )}
                {pet.pattern ? (
                  <>
                    <dt className="text-stone-500">Pattern</dt>
                    <dd>
                      {pet.pattern.name}{" "}
                      <span className="text-xs capitalize text-stone-500">({pet.pattern.rarity_tier})</span>
                    </dd>
                  </>
                ) : null}
                {pet.eyeType ? (
                  <>
                    <dt className="text-stone-500">Eyes</dt>
                    <dd>
                      {pet.eyeType.name}{" "}
                      <span className="text-xs capitalize text-stone-500">({pet.eyeType.rarity_tier})</span>
                    </dd>
                  </>
                ) : null}
              </dl>
              {pet.parentA || pet.parentB ? (
                <p className="text-xs text-stone-500">
                  Parents:{" "}
                  {[pet.parentA, pet.parentB]
                    .filter((p): p is NonNullable<typeof p> => !!p)
                    .map((p, i) => (
                      <span key={p.id}>
                        {i > 0 ? ", " : ""}
                        <Link href={`/pets/${p.id}`} className="underline">
                          {p.custom_name ?? "Unnamed"}
                        </Link>
                      </span>
                    ))}
                </p>
              ) : null}
            </section>
          ) : null}

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
