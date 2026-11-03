// Pet Stats and 1v1 Combat Spec (chale, 2026-10-22). Only the
// data-independent pieces are wired up so far — calcPetStats() and the
// config object. Combat itself (baseDamage, speedShares, resolveAttack,
// runFight) is a later module; every constant that work will need is
// already reserved here per the spec's "keep every tunable value in one
// config object" guidance, so nothing about this file's shape should
// need to change once that's built, only new functions added to it.

export const PET_COMBAT_CONFIG = {
  strengthRate: 2,
  speedRate: 2,
  defenceRate: 2,
  startingHp: 100,
  maxRounds: 30,
  maxCritChance: 0.3,
  maxDodgeChance: 0.4,
  critMultiplier: 1.5,
  speedEffectsEnabled: true,
};

export type PetStats = {
  strength: number;
  speed: number;
  defence: number;
};

// Stat = Level x Rate x (Roll / 10). Full precision — never round here,
// only when formatting for display (see formatStat below).
function calcStat(level: number, roll: number, rate: number): number {
  return level * rate * (roll / 10);
}

export function calcPetStats(pet: {
  level: number;
  roll_strength: number;
  roll_speed: number;
  roll_defence: number;
}): PetStats {
  return {
    strength: calcStat(pet.level, pet.roll_strength, PET_COMBAT_CONFIG.strengthRate),
    speed: calcStat(pet.level, pet.roll_speed, PET_COMBAT_CONFIG.speedRate),
    defence: calcStat(pet.level, pet.roll_defence, PET_COMBAT_CONFIG.defenceRate),
  };
}

// Display only, 1 decimal place, per spec.
export function formatStat(value: number): string {
  return value.toFixed(1);
}

// Stat-plaque tier (wood/silver/gold/diamond, furgarden.css's .pt-tier)
// — the player's own rule (asked when /pets/[petId] was ported), keyed
// off the birth ROLL (1-10), not the computed stat value: <=5 wood, 6-9
// silver, 10 gold, diamond when all three rolls are 10. Shared by the
// pet detail page and the expedition planner's pet-picker, which both
// show these same plaques.
export function statTier(roll: number, allTen: boolean): "" | "pt-silver" | "pt-gold" | "pt-diamond" {
  if (allTen) return "pt-diamond";
  if (roll >= 10) return "pt-gold";
  if (roll >= 6) return "pt-silver";
  return "";
}
