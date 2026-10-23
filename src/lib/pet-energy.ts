// Pet energy — decays naturally over time, restored by feeding
// (0046_pet_energy.sql). Mirrors public.calc_pet_energy_percent(), the
// SQL version of this same formula that start_expedition() actually
// enforces server-side — keep the two in sync by hand if either
// changes, same convention src/config.ts documents for its own
// RPC-mirroring display constants.
export const ENERGY_DECAY_HOURS = 48;
export const MIN_ENERGY_TO_ADVENTURE = 75;

export function calcPetEnergy(lastFedAt: string): number {
  const hoursSinceFed = (Date.now() - new Date(lastFedAt).getTime()) / 3_600_000;
  const percent = 100 - (hoursSinceFed / ENERGY_DECAY_HOURS) * 100;
  return Math.max(0, Math.min(100, percent));
}
