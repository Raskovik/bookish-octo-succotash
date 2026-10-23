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
