import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { compositeMissingPetImages } from "@/lib/pet-compositor";
import { BreedingNest } from "@/components/breeding-nest";
import type { ActiveBreedingAttempt, BreedablePet, EggReveal } from "@/lib/supabase/types";

export default async function BreedingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Same lazy-resolution pattern as expeditions/brewing.
  await supabase.rpc("resolve_due_breeding", { p_user_id: user.id });
  // claim_egg (triggered from this page) can create a trait-based pet
  // with no composited image yet.
  await compositeMissingPetImages(supabase, user.id);

  const [{ data: userRow }, { data: petsData }, { data: attemptData }] = await Promise.all([
    supabase.from("users").select("coin_balance, den_size").eq("id", user.id).single(),
    supabase
      .from("pets")
      .select("id, custom_name, gender, composited_image_url, breed:breeds(id, name)")
      .eq("owner_id", user.id)
      .not("breed_id", "is", null)
      .order("created_at", { ascending: true }),
    supabase
      .from("breeding_attempts")
      .select("id, status, resolves_at, pet_a_id, pet_b_id")
      .eq("user_id", user.id)
      .in("status", ["in_progress", "awaiting_claim"])
      .maybeSingle(),
  ]);

  const pets = (petsData ?? []) as unknown as BreedablePet[];
  const activeAttempt = attemptData as ActiveBreedingAttempt | null;

  let eggReveal: EggReveal | null = null;
  let parentNames: { a: string; b: string } | null = null;

  if (activeAttempt) {
    const [{ data: parentA }, { data: parentB }] = await Promise.all([
      supabase.from("pets").select("custom_name").eq("id", activeAttempt.pet_a_id).single(),
      supabase.from("pets").select("custom_name").eq("id", activeAttempt.pet_b_id).single(),
    ]);
    parentNames = {
      a: parentA?.custom_name ?? "Unnamed",
      b: parentB?.custom_name ?? "Unnamed",
    };

    if (activeAttempt.status === "awaiting_claim") {
      const { data: attemptDetail } = await supabase
        .from("breeding_attempts")
        .select(
          "pending_gender, breed:breeds!breeding_attempts_pending_breed_id_fkey(name), " +
            "primaryColor:colors!breeding_attempts_pending_primary_color_id_fkey(name, hex_swatch, rarity_tier), " +
            "secondaryColor:colors!breeding_attempts_pending_secondary_color_id_fkey(name, hex_swatch, rarity_tier), " +
            "tertiaryColor:colors!breeding_attempts_pending_tertiary_color_id_fkey(name, hex_swatch, rarity_tier), " +
            "pattern:patterns(name, rarity_tier), eyeType:eye_types(name, rarity_tier)",
        )
        .eq("id", activeAttempt.id)
        .single();
      eggReveal = attemptDetail as unknown as EggReveal | null;
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Breeding</h1>
        <p className="text-sm text-stone-500">
          Pair two pets of the same breed and opposite gender to nest an egg. Each trait rolls independently — 45%
          from one parent, 45% from the other, 10% a fresh mutation.
        </p>
      </div>
      <BreedingNest
        userId={user.id}
        pets={pets}
        coinBalance={userRow?.coin_balance ?? 0}
        denSize={userRow?.den_size ?? 0}
        activeAttempt={activeAttempt}
        parentNames={parentNames}
        eggReveal={eggReveal}
      />
    </main>
  );
}
