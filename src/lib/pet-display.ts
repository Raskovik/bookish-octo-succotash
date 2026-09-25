// Shared "how do we show this pet" fallback logic — a pet is either
// legacy (species_id set, breed_id null) or trait-based (breed_id set,
// species_id null; see pets_legacy_xor_trait, 0038_trait_breeding_schema.sql).
// Every call site that renders a pet should go through these two helpers
// rather than re-deriving the species-vs-breed fallback itself.

export function petImageUrl(pet: {
  composited_image_url?: string | null;
  species?: { image_url: string | null } | null;
}): string | null {
  return pet.composited_image_url ?? pet.species?.image_url ?? null;
}

export function petTypeName(pet: {
  species?: { name: string } | null;
  breed?: { name: string } | null;
}): string {
  return pet.breed?.name ?? pet.species?.name ?? "Unknown";
}
