// Shared "how do we show this pet" helpers — every pet has exactly one
// fixed species image (species_id, not null — see
// 0042_remove_traits_and_breeding.sql). Call sites should go through
// these two helpers rather than re-deriving the species fallback
// themselves.

export function petImageUrl(pet: { species?: { image_url: string | null } | null }): string | null {
  return pet.species?.image_url ?? null;
}

export function petTypeName(pet: { species?: { name: string } | null }): string {
  return pet.species?.name ?? "Unknown";
}
