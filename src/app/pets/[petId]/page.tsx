import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { petImageUrl, petTypeName, petAgeLabel } from "@/lib/pet-display";
import { calcPetEnergy } from "@/lib/pet-energy";
import { PetPanel } from "./pet-panel";
import type { PetDetail } from "@/lib/supabase/types";

// 0048_public_pet_and_item_viewing.sql opened pets up to read-only
// viewing by anyone signed in — this page serves both the owner (full
// controls, via PetPanel's isOwner prop) and any other viewer
// (everything stays read-only: no rename/feed/sell/release/bio-edit,
// same as a stranger's /u/[id] profile). Still requires sign-in to
// view at all, same as before.
export default async function PetDetailPage(props: PageProps<"/pets/[petId]">) {
  const { petId } = await props.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: petData } = await supabase
    .from("pets")
    .select(
      "id, owner_id, custom_name, bio, level, roll_strength, roll_speed, roll_defence, last_fed_at, created_at, species(name, image_url)",
    )
    .eq("id", petId)
    .maybeSingle();

  if (!petData) {
    notFound();
  }

  const pet = petData as unknown as PetDetail;
  const isOwner = pet.owner_id === user.id;

  const { count: adventureCount } = await supabase
    .from("expeditions")
    .select("*", { count: "exact", head: true })
    .eq("pet_id", petId)
    .eq("user_id", pet.owner_id);

  const energyPct = calcPetEnergy(pet.last_fed_at);

  return (
    <main id="main">
      <div className="sheet">
        <div className="panel pet">
          <Link
            href={isOwner ? "/pets" : `/u/${pet.owner_id}/pets`}
            className="lnk"
            style={{ display: "inline-block", marginBottom: 12 }}
          >
            &larr; Back to pets
          </Link>
          <PetPanel
            userId={user.id}
            petId={pet.id}
            isOwner={isOwner}
            initialCustomName={pet.custom_name}
            speciesName={petTypeName(pet)}
            imageUrl={petImageUrl(pet)}
            level={pet.level}
            ageLabel={petAgeLabel(pet.created_at)}
            adventureCount={adventureCount ?? 0}
            energyPct={energyPct}
            rollStrength={pet.roll_strength}
            rollSpeed={pet.roll_speed}
            rollDefence={pet.roll_defence}
            initialBio={pet.bio}
          />
        </div>
      </div>
    </main>
  );
}
