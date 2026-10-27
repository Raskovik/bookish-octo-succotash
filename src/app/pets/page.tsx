import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NewFolderForm } from "./new-folder-form";
import { FolderHeader } from "./folder-header";
import { BulkForTradeButton } from "./bulk-for-trade-button";
import { TRADING_ENABLED } from "@/lib/feature-flags";
import { ExpandDenButton } from "@/components/expand-den-button";
import { PetGrid } from "@/components/pet-grid";
import { nextDenExpansionCost } from "@/lib/den-expansion";
import type { PetFolderRow, PetWithSpecies } from "@/lib/supabase/types";

const PAGE_SIZE = 25;
const ALL_TAB = "all";
const UNSORTED_TAB = "unsorted";

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
      "id, rarity, color_variant, folder_id, custom_name, is_for_trade, created_at, species(name, image_url)",
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
    <main id="main">
      <div className="sheet">
        <div className="panel flex flex-col gap-6">
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
        </div>
      </div>
    </main>
  );
}
