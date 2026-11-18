import { requireAdmin } from "@/lib/admin";
import { updateGameConfig } from "./actions";
import type { GameConfigRow } from "@/lib/supabase/types";

// Grouped for readability — game_config itself has no section column,
// this is purely a display grouping. Any key not listed here (e.g. a
// future addition) still shows up, just under "Other".
const SECTIONS: { title: string; keys: string[] }[] = [
  {
    title: "Trip duration",
    keys: [
      "trip_duration_min_minutes",
      "trip_duration_max_minutes",
      "trip_duration_speed_skew",
      "first_trip_duration_minutes",
      "stat_saturation_k",
    ],
  },
  {
    title: "Loot",
    keys: ["loot_common_base", "loot_common_scale", "loot_uncommon_scale", "loot_rare_scale"],
  },
  {
    title: "Double haul",
    keys: ["double_haul_base_chance", "double_haul_strength_weight"],
  },
  {
    title: "Coins & XP",
    keys: ["coin_base_per_tier", "coin_random_range_per_tier", "xp_base", "xp_tier_scale"],
  },
];

export default async function AdminGameConfigPage() {
  const { supabase } = await requireAdmin();

  const { data: config } = await supabase.from("game_config").select("key, value, label, description, updated_at");
  const byKey = new Map((config ?? []).map((c) => [c.key, c] as [string, GameConfigRow]));
  const listedKeys = new Set(SECTIONS.flatMap((s) => s.keys));
  const otherRows = (config ?? []).filter((c) => !listedKeys.has(c.key));

  function ConfigRow({ row }: { row: GameConfigRow }) {
    return (
      <div className="flex flex-col gap-1 rounded-lg border border-green-200 p-3 dark:border-stone-800">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium">{row.label}</p>
            <p className="text-xs text-stone-500">{row.description}</p>
          </div>
          <form action={updateGameConfig} className="flex shrink-0 items-center gap-2">
            <input type="hidden" name="key" value={row.key} />
            <input
              name="value"
              type="number"
              step="any"
              defaultValue={row.value}
              className="w-28 rounded-md border border-green-300 px-2 py-1 text-right text-sm dark:border-stone-700 dark:bg-stone-900"
            />
            <button
              type="submit"
              className="rounded-md bg-green-800 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-700 dark:bg-green-200 dark:text-green-950 dark:hover:bg-green-300"
            >
              Save
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Adventuring odds</h2>
        <p className="text-sm text-stone-500">
          Every number that drives trip duration, loot, double hauls, and coin/XP rewards — changes take effect
          immediately, no deploy needed. A friend pet is now always offered on a completed trip (no longer a
          chance), so there&apos;s no knob for that here.
        </p>
      </div>

      {SECTIONS.map((section) => (
        <section key={section.title} className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-500">{section.title}</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {section.keys.map((key) => {
              const row = byKey.get(key);
              return row ? <ConfigRow key={key} row={row} /> : null;
            })}
          </div>
        </section>
      ))}

      {otherRows.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Other</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {otherRows.map((row) => (
              <ConfigRow key={row.key} row={row} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
