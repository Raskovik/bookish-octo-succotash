import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { ItemForm } from "../item-form";
import { SearchablePicker } from "@/components/admin/searchable-picker";
import {
  updateItem,
  addSeedPoolEntry,
  removeSeedPoolEntry,
  addFertilizerEffect,
  removeFertilizerEffect,
} from "../actions";
import type { FertilizerEffectType } from "@/lib/supabase/types";
import { getObtainableSources } from "@/lib/admin-obtainable";

type PoolRow = { plant_id: string; drop_weight: number; garden_plants: { name: string; image_stage1_url: string | null } | null };
type EffectRow = { effect_type: FertilizerEffectType; effect_magnitude: number };

const EFFECT_LABELS: Record<FertilizerEffectType, string> = {
  grow_speed_boost: "Grow speed boost (fraction off total time, e.g. 0.25 = 25% faster)",
  pest_deterrence: "Pest deterrence (fraction reduction of the base pest chance)",
  double_coin_chance: "Double coin chance (probability harvest coins are doubled)",
};

export default async function EditItemPage(props: PageProps<"/admin/items/[id]">) {
  const { id } = await props.params;
  const { supabase } = await requireAdmin();

  const [{ data: item }, sources] = await Promise.all([
    supabase
      .from("items")
      .select("id, name, type, image_url, description, sell_value, food_value, created_at")
      .eq("id", id)
      .maybeSingle(),
    getObtainableSources(supabase, "item", id),
  ]);

  if (!item) {
    notFound();
  }

  const obtainable = sources.some((s) => s.live);

  return (
    <>
      <div className="crumbs">
        <Link href="/admin">Dashboard</Link>
        <i>/</i>
        <Link href="/admin/items">Items</Link>
        <i>/</i>
        <span>{item.name}</span>
      </div>
      <div className="ph">
        <h1>Edit item</h1>
      </div>
      <ItemForm action={updateItem} item={item} isNew={false} cancelHref="/admin/items" />

      <section className="sub card pad">
        <h2>Where it can be obtained — {obtainable ? "Obtainable" : "Not obtainable"}</h2>
        {sources.length === 0 ? (
          <p className="muted">Not in any zone&apos;s pool or shop listing.</p>
        ) : (
          <ul className="act-list">
            {sources.map((s, i) => (
              <li key={i}>
                <span className={s.live ? "" : "muted"} style={s.live ? { color: "var(--greend)" } : undefined}>
                  {s.live ? "●" : "○"}
                </span>{" "}
                <span>{s.label}</span>
                {s.reason ? <small>({s.reason})</small> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {item.type === "seed" ? <SeedPoolEditor seedItemId={item.id} /> : null}
      {item.type === "fertilizer" ? <FertilizerEffectsEditor itemId={item.id} /> : null}
    </>
  );
}

// A seed's pool of possible plants — a "specific" seed is just a pool of
// one (see 0035_gardening.sql's comment on seed_plants).
async function SeedPoolEditor({ seedItemId }: { seedItemId: string }) {
  const { supabase } = await requireAdmin();

  const [{ data: poolData }, { data: allPlants }] = await Promise.all([
    supabase.from("seed_plants").select("plant_id, drop_weight, garden_plants(name, image_stage1_url)").eq("seed_item_id", seedItemId),
    supabase.from("garden_plants").select("id, name, image_stage1_url").eq("is_active", true).order("name"),
  ]);

  const pool = (poolData ?? []) as unknown as PoolRow[];
  const poolPlantIds = new Set(pool.map((p) => p.plant_id));
  const availablePlants = (allPlants ?? []).filter((p) => !poolPlantIds.has(p.id));

  return (
    <section className="sub card">
      <div className="sh">
        <h2>
          Plant pool
          <span className="cnt">{pool.length}</span>
        </h2>
        <p className="hint">
          What this seed can grow into. One entry means it always grows that plant; several entries means it rolls
          weighted at random between them.
        </p>
      </div>
      <div className="tw">
        <table className="tbl">
          <thead>
            <tr>
              <th>Plant</th>
              <th>Drop weight</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {pool.map((entry) => (
              <tr key={entry.plant_id}>
                <td>
                  <span className="rl">
                    {entry.garden_plants?.image_stage1_url ? (
                      <Image src={entry.garden_plants.image_stage1_url} alt="" width={24} height={24} className="th xs" />
                    ) : null}
                    {entry.garden_plants?.name ?? "(deleted plant)"}
                  </span>
                </td>
                <td>{entry.drop_weight}</td>
                <td className="act">
                  <form action={removeSeedPoolEntry}>
                    <input type="hidden" name="seed_item_id" value={seedItemId} />
                    <input type="hidden" name="plant_id" value={entry.plant_id} />
                    <button type="submit" className="lnk red">
                      Remove
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {pool.length === 0 ? (
              <tr className="empty">
                <td colSpan={3}>This seed&apos;s pool is empty — it can&apos;t be planted yet.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {availablePlants.length > 0 ? (
        <form action={addSeedPoolEntry} className="addrow">
          <input type="hidden" name="seed_item_id" value={seedItemId} />
          <SearchablePicker
            name="plant_id"
            placeholder="Search plants…"
            options={availablePlants.map((p) => ({ id: p.id, label: p.name, imageUrl: p.image_stage1_url }))}
          />
          <div>
            <label htmlFor="drop_weight" className="lbl">
              Drop weight
            </label>
            <input id="drop_weight" name="drop_weight" type="number" min={1} step={1} defaultValue={1} className="in num nm" />
          </div>
          <button type="submit" className="btn sm">
            Add to pool
          </button>
        </form>
      ) : null}
    </section>
  );
}

async function FertilizerEffectsEditor({ itemId }: { itemId: string }) {
  const { supabase } = await requireAdmin();

  const { data: effectsData } = await supabase
    .from("fertilizer_effects")
    .select("effect_type, effect_magnitude")
    .eq("item_id", itemId);

  const effects = (effectsData ?? []) as EffectRow[];
  const usedTypes = new Set(effects.map((e) => e.effect_type));
  const availableTypes = (Object.keys(EFFECT_LABELS) as FertilizerEffectType[]).filter((t) => !usedTypes.has(t));

  return (
    <section className="sub card">
      <div className="sh">
        <h2>Effects</h2>
        <p className="hint">
          Applied by plant_seed()/harvest_plot() when a player uses this fertilizer — a fertilizer can carry more than
          one effect.
        </p>
      </div>
      <div className="tw">
        <table className="tbl">
          <thead>
            <tr>
              <th>Effect</th>
              <th>Magnitude</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {effects.map((effect) => (
              <tr key={effect.effect_type}>
                <td>{EFFECT_LABELS[effect.effect_type]}</td>
                <td>{effect.effect_magnitude}</td>
                <td className="act">
                  <form action={removeFertilizerEffect}>
                    <input type="hidden" name="item_id" value={itemId} />
                    <input type="hidden" name="effect_type" value={effect.effect_type} />
                    <button type="submit" className="lnk red">
                      Remove
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {effects.length === 0 ? (
              <tr className="empty">
                <td colSpan={3}>No effects yet — this fertilizer currently does nothing.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {availableTypes.length > 0 ? (
        <form action={addFertilizerEffect} className="addrow">
          <input type="hidden" name="item_id" value={itemId} />
          <div>
            <label htmlFor="effect_type" className="lbl">
              Effect
            </label>
            <select id="effect_type" name="effect_type" className="in" style={{ width: 280 }}>
              {availableTypes.map((t) => (
                <option key={t} value={t}>
                  {EFFECT_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="effect_magnitude" className="lbl">
              Magnitude
            </label>
            <input id="effect_magnitude" name="effect_magnitude" type="number" min={0.01} step={0.01} defaultValue={0.25} className="in num nm" />
          </div>
          <button type="submit" className="btn sm">
            Add effect
          </button>
        </form>
      ) : null}
    </section>
  );
}
