import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Tag } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { petImageUrl, petTypeName } from "@/lib/pet-display";
import { NewFolderForm } from "./new-folder-form";
import { FolderHeader } from "./folder-header";
import { BulkForTradeButton } from "./bulk-for-trade-button";
import { TRADING_ENABLED } from "@/lib/feature-flags";
import { ExpandDenButton } from "@/components/expand-den-button";
import { nextDenExpansionCost } from "@/lib/den-expansion";
import type { PetFolderRow, PetWithSpecies } from "@/lib/supabase/types";

const PAGE_SIZE = 25;
const ALL_TAB = "all";
const UNSORTED_TAB = "unsorted";

// Image-forward and click-through to /pets/[petId] for everything else
// (renaming, folder, for-trade, bio) — modernized from the old card,
// which packed a name editor, a folder select, and a for-trade toggle
// into every tile. Leaves the card itself purely about showing the pet
// off, with room for real art (layered rendering/accessories are still
// unbuilt — see the README roadmap) once that lands.
function PetGrid({ list }: { list: PetWithSpecies[] }) {
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {list.map((pet) => (
        <li key={pet.id}>
          <Link
            href={`/pets/${pet.id}`}
            className="flex flex-col items-center gap-2 rounded-xl border border-green-200 bg-white/60 p-4 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-stone-800 dark:bg-stone-950/40"
          >
            <div className="relative">
              {petImageUrl(pet) ? (
                <Image
                  src={petImageUrl(pet)!}
                  alt={petTypeName(pet)}
                  width={112}
                  height={112}
                  className="h-28 w-28 rounded-lg border-2 border-blue-600 object-cover"
                />
              ) : (
                <div className="h-28 w-28 rounded-lg bg-green-200 dark:bg-stone-800" />
              )}
              {TRADING_ENABLED && pet.is_for_trade ? (
                <span className="absolute -right-2 -top-2 flex items-center gap-1 rounded-full bg-green-800 px-2 py-0.5 text-[10px] font-semibold text-white shadow dark:bg-green-200 dark:text-green-950">
                  <Tag size={10} />
                  For trade
                </span>
              ) : null}
            </div>
            <p className={`text-sm font-semibold ${pet.custom_name ? "" : "italic text-stone-500"}`}>
              {pet.custom_name ?? "Unnamed"}
            </p>
            <p className="text-xs capitalize text-stone-500">
              {petTypeName(pet)} · {pet.rarity}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function PetsPage(props: PageProps<"/pets">) {
  const searchParams = await props.searchParams;
  const folderParam = Array.isArray(searchParams.folder) ? searchParams.folder[0] : searchParams.folder;
  const pageParam = Array.isArray(searchParams.page) ? searchParams.page[0] : searchParams.page;
  const activeTab = folderParam ?? ALL_TAB;
  const requestedPage = Number(pageParam ?? "1");
  const currentPage = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const userId = user.id;

  const { data: userRow } = await supabase
    .from("users")
    .select("coin_balance, den_size")
    .eq("id", userId)
    .single();
  const denSize = userRow?.den_size ?? 0;
  const denExpansionCost = nextDenExpansionCost(denSize);

  const { data: foldersData } = await supabase
    .from("pet_folders")
    .select("id, owner_id, name, created_at")
    .eq("owner_id", userId)
    .order("created_at", { ascending: true });

  const folders = (foldersData ?? []) as PetFolderRow[];
  const activeFolder = folders.find((f) => f.id === activeTab) ?? null;

  const [{ count: totalCount }, { count: unsortedCount }, folderCounts] = await Promise.all([
    supabase.from("pets").select("*", { count: "exact", head: true }).eq("owner_id", userId),
    supabase
      .from("pets")
      .select("*", { count: "exact", head: true })
      .eq("owner_id", userId)
      .is("folder_id", null),
    Promise.all(
      folders.map((folder) =>
        supabase
          .from("pets")
          .select("*", { count: "exact", head: true })
          .eq("owner_id", userId)
          .eq("folder_id", folder.id)
          .then((res) => ({ id: folder.id, count: res.count ?? 0 })),
      ),
    ),
  ]);

  const countsByFolderId = new Map(folderCounts.map((f) => [f.id, f.count]));

  const activeCount =
    activeTab === ALL_TAB
      ? (totalCount ?? 0)
      : activeTab === UNSORTED_TAB
        ? (unsortedCount ?? 0)
        : (countsByFolderId.get(activeTab) ?? 0);

  const totalPages = Math.max(1, Math.ceil(activeCount / PAGE_SIZE));
  const page = Math.min(currentPage, totalPages);
  const offset = (page - 1) * PAGE_SIZE;

  let petsQuery = supabase
    .from("pets")
    .select(
      "id, rarity, color_variant, folder_id, custom_name, is_for_trade, created_at, composited_image_url, gender, species(name, image_url), breed:breeds(name)",
    )
    .eq("owner_id", userId);

  if (activeTab === UNSORTED_TAB) {
    petsQuery = petsQuery.is("folder_id", null);
  } else if (activeTab !== ALL_TAB) {
    petsQuery = petsQuery.eq("folder_id", activeTab);
  }

  const { data: petsData } = await petsQuery
    .order("created_at", { ascending: true })
    .range(offset, offset + PAGE_SIZE - 1);

  const pets = (petsData ?? []) as unknown as PetWithSpecies[];

  const tabs = [
    { value: ALL_TAB, label: "All", count: totalCount ?? 0 },
    ...folders.map((f) => ({ value: f.id, label: f.name, count: countsByFolderId.get(f.id) ?? 0 })),
    { value: UNSORTED_TAB, label: "Unsorted", count: unsortedCount ?? 0 },
  ];

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Pets ({totalCount ?? 0} / {denSize})
          </h1>
          <p className="text-sm text-stone-500">
            Group your pets into folders, like a lair.{" "}
            <Link href="/items" className="underline">
              Looking for items?
            </Link>
          </p>
        </div>
        <ExpandDenButton
          userId={userId}
          cost={denExpansionCost}
          canAfford={(userRow?.coin_balance ?? 0) >= denExpansionCost}
        />
      </div>

      <NewFolderForm />

      <nav className="flex flex-wrap gap-2 border-b border-green-200 dark:border-stone-800">
        {tabs.map((tab) => (
          <Link
            key={tab.value}
            href={tab.value === ALL_TAB ? "/pets" : `/pets?folder=${tab.value}`}
            className={`border-b-2 px-3 py-2 text-sm ${
              activeTab === tab.value
                ? "border-green-800 font-medium dark:border-green-200"
                : "border-transparent text-stone-500 hover:text-stone-900 dark:hover:text-white"
            }`}
          >
            {tab.label} ({tab.count})
          </Link>
        ))}
      </nav>

      {activeFolder ? (
        <FolderHeader folderId={activeFolder.id} name={activeFolder.name} petCount={activeCount} />
      ) : null}

      {TRADING_ENABLED && activeTab !== ALL_TAB ? (
        <div className="flex gap-2">
          <BulkForTradeButton
            userId={userId}
            folderId={activeTab === UNSORTED_TAB ? null : activeTab}
            isForTrade={true}
          />
          <BulkForTradeButton
            userId={userId}
            folderId={activeTab === UNSORTED_TAB ? null : activeTab}
            isForTrade={false}
          />
        </div>
      ) : null}

      {pets.length === 0 ? (
        <p className="text-sm text-stone-500 italic">
          {activeTab === ALL_TAB
            ? "You don't have any pets yet."
            : activeTab === UNSORTED_TAB
              ? "Everything's sorted into a folder."
              : "No pets in this folder yet."}
        </p>
      ) : (
        <PetGrid list={pets} />
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-center gap-4 text-sm">
          <Link
            href={`/pets?folder=${activeTab}&page=${page - 1}`}
            aria-disabled={page <= 1}
            className={`rounded-md border border-green-300 px-3 py-1.5 dark:border-stone-700 ${
              page <= 1
                ? "pointer-events-none opacity-40"
                : "hover:bg-green-100 dark:hover:bg-stone-800"
            }`}
          >
            Previous
          </Link>
          <span className="text-stone-500">
            Page {page} of {totalPages}
          </span>
          <Link
            href={`/pets?folder=${activeTab}&page=${page + 1}`}
            aria-disabled={page >= totalPages}
            className={`rounded-md border border-green-300 px-3 py-1.5 dark:border-stone-700 ${
              page >= totalPages
                ? "pointer-events-none opacity-40"
                : "hover:bg-green-100 dark:hover:bg-stone-800"
            }`}
          >
            Next
          </Link>
        </div>
      ) : null}
    </main>
  );
}
