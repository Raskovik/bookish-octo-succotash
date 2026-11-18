import Link from "next/link";
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
      <div className="cc">
        <div>
          <b>{row.label}</b>
          <small>{row.description}</small>
        </div>
        <form action={updateGameConfig} className="ctl">
          <input type="hidden" name="key" value={row.key} />
          <input name="value" type="number" step="any" defaultValue={row.value} className="in sm" style={{ textAlign: "right" }} />
          <button type="submit" className="btn sm">
            Save
          </button>
        </form>
      </div>
    );
  }

  return (
    <>
      <div className="crumbs">
        <Link href="/admin">Admin</Link>
        <i>/</i>
        <span>Adventuring odds</span>
      </div>
      <div className="ph">
        <h1>Adventuring odds</h1>
      </div>
      <p className="desc" style={{ marginBottom: 14 }}>
        Every number that drives trip duration, loot, double hauls, and coin/XP rewards — changes take effect
        immediately, no deploy needed. A friend pet is now always offered on a completed trip (no longer a chance),
        so there&apos;s no knob for that here.
      </p>

      {SECTIONS.map((section) => (
        <section key={section.title}>
          <h3 className="fh">{section.title}</h3>
          <div className="cfg">
            {section.keys.map((key) => {
              const row = byKey.get(key);
              return row ? <ConfigRow key={key} row={row} /> : null;
            })}
          </div>
        </section>
      ))}

      {otherRows.length > 0 ? (
        <section>
          <h3 className="fh">Other</h3>
          <div className="cfg">
            {otherRows.map((row) => (
              <ConfigRow key={row.key} row={row} />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
