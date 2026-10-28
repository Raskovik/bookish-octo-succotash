import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { nextDenExpansionCost } from "@/lib/den-expansion";
import { petImageUrl, petTypeName } from "@/lib/pet-display";
import { PetsApp, type UIGroup, type UIPet } from "./pets-app";
import type { PetFolderRow, PetWithSpecies } from "@/lib/supabase/types";

// All of this player's pets and groups load in one go rather than
// paginated server-side — the new design (ported from
// furgarden-design's pages/pets.html + js/pets.js) does its own
// tab/search/sort/paging entirely client-side, same as the reference
// implementation.
export default async function PetsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const userId = user.id;

  const [{ data: userRow }, { data: foldersData }, { data: petsData }] = await Promise.all([
    supabase.from("users").select("display_name, coin_balance, den_size").eq("id", userId).single(),
    supabase
      .from("pet_folders")
      .select("id, owner_id, name, color, bio, sort_order, created_at")
      .eq("owner_id", userId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("pets")
      .select("id, rarity, color_variant, folder_id, custom_name, is_for_trade, level, created_at, species(name, image_url)")
      .eq("owner_id", userId)
      .order("created_at", { ascending: true }),
  ]);

  const denSize = userRow?.den_size ?? 0;
  const denExpansionCost = nextDenExpansionCost(denSize);

  const groups: UIGroup[] = ((foldersData ?? []) as PetFolderRow[]).map((f) => ({
    id: f.id,
    name: f.name,
    color: f.color,
    bio: f.bio,
    sortOrder: f.sort_order,
  }));

  const pets: UIPet[] = ((petsData ?? []) as unknown as PetWithSpecies[]).map((p) => ({
    id: p.id,
    name: p.custom_name ?? "Unnamed",
    level: p.level,
    img: petImageUrl(p),
    typeName: petTypeName(p),
    groupId: p.folder_id,
  }));

  return (
    <main id="main">
      <div className="sheet">
        <PetsApp
          userId={userId}
          userName={userRow?.display_name ?? "Your"}
          capacity={denSize}
          coinBalance={userRow?.coin_balance ?? 0}
          denExpansionCost={denExpansionCost}
          initialGroups={groups}
          initialPets={pets}
        />
      </div>
    </main>
  );
}
