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

// Pets have no separate "birth date" — created_at doubles as both adopted
// date and age basis, since this is when the pet first came into being.
export function petAgeLabel(createdAt: string): string {
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000);

  if (days < 1) return "Born today";
  if (days === 1) return "1 day old";
  if (days < 30) return `${days} days old`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} old`;

  const years = Math.floor(months / 12);
  const remainderMonths = months % 12;
  return `${years} year${years === 1 ? "" : "s"}${remainderMonths ? `, ${remainderMonths} mo` : ""} old`;
}
