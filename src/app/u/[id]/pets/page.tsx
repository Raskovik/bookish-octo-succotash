import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PetGrid } from "@/components/pet-grid";
import type { PetWithSpecies } from "@/lib/supabase/types";

// Read-only view of another player's den (0048_public_pet_and_item_
// viewing.sql made this visible at all) — no folders, no pagination,
// no for-trade toggles, just the same PetGrid cards the owner's own
// /pets page uses, each one linking to /pets/[petId], which decides
// for itself what a non-owner viewer there can do.
export default async function PlayerPetsPage(props: PageProps<"/u/[id]/pets">) {
  const { id } = await props.params;
  const supabase = await createClient();

  // The URL segment is the public display_id, not the real uuid — see
  // 0065_user_display_id.sql / src/app/u/[id]/page.tsx.
  const displayId = Number(id);
  const { data: profile } =
    Number.isInteger(displayId) && displayId >= 1
      ? await supabase.from("user_profiles").select("id, display_name").eq("display_id", displayId).maybeSingle()
      : { data: null };

  const { data: petsData } = profile
    ? await supabase
        .from("pets")
        .select("id, rarity, color_variant, custom_name, is_for_trade, created_at, species(name, image_url)")
        .eq("owner_id", profile.id)
        .order("created_at", { ascending: true })
    : { data: null };

  const pets = (petsData ?? []) as unknown as PetWithSpecies[];

  return (
    <main id="main">
      <div className="sheet">
        <div className="panel flex flex-col gap-6">
          <div>
            <Link href={`/u/${id}`} className="flex w-fit items-center gap-1.5 text-sm text-stone-500 hover:underline">
              <ArrowLeft size={14} />
              Back to profile
            </Link>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">
              {profile?.display_name ?? "Player"}&apos;s pets ({pets.length})
            </h1>
          </div>

          {pets.length === 0 ? (
            <p className="text-sm text-stone-500 italic">No pets yet.</p>
          ) : (
            <PetGrid list={pets} />
          )}
        </div>
      </div>
    </main>
  );
}
