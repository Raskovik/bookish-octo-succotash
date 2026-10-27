import Image from "next/image";
import Link from "next/link";
import { Tag } from "lucide-react";
import { petImageUrl, petTypeName } from "@/lib/pet-display";
import { TRADING_ENABLED } from "@/lib/feature-flags";
import type { PetWithSpecies } from "@/lib/supabase/types";

// Image-forward and click-through to /pets/[petId] for everything else
// (renaming, folder, for-trade, bio) — modernized from the old card,
// which packed a name editor, a folder select, and a for-trade toggle
// into every tile. Leaves the card itself purely about showing the pet
// off, with room for real art (layered rendering/accessories are still
// unbuilt — see the README roadmap) once that lands.
//
// Shared by the owner's own /pets grid and /u/[id]/pets' read-only
// view of someone else's den — same card, same click-through to
// /pets/[petId] (which itself decides what a visitor there can do).
export function PetGrid({ list }: { list: PetWithSpecies[] }) {
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {list.map((pet) => (
        <li key={pet.id}>
          <Link
            href={`/pets/${pet.id}`}
            className="flex flex-col items-center gap-2 text-center transition hover:-translate-y-0.5"
          >
            <div className="relative">
              {petImageUrl(pet) ? (
                <Image
                  src={petImageUrl(pet)!}
                  alt={petTypeName(pet)}
                  width={176}
                  height={176}
                  className="h-44 w-44 rounded-lg object-cover"
                />
              ) : (
                <div className="h-44 w-44 rounded-lg bg-green-200 dark:bg-stone-800" />
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
          </Link>
        </li>
      ))}
    </ul>
  );
}
