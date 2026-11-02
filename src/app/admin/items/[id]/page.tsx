import Image from "next/image";
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

  const { data: item } = await supabase
    .from("items")
    .select("id, name, type, rarity, image_url, description, sell_value, shop_price, food_value, is_active, created_at")
    .eq("id", id)
    .maybeSingle();

  if (!item) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold tracking-tight">Edit item</h2>
        <ItemForm action={updateItem} item={item} submitLabel="Save changes" />
      </div>

      {item.type === "seed" ? <SeedPoolEditor seedItemId={item.id} /> : null}
      {item.type === "fertilizer" ? <FertilizerEffectsEditor itemId={item.id} /> : null}
    </div>
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
    <section className="flex flex-col gap-3">
      <h3 className="text-base font-semibold tracking-tight">Plant pool</h3>
      <p className="text-sm text-stone-500">
        What this seed can grow into. One entry means it always grows that plant; several entries means it rolls
        weighted at random between them.
      </p>
      <div className="overflow-hidden rounded-lg border border-green-200 dark:border-stone-800">
        <table className="w-full text-sm">
          <thead className="bg-green-100 text-left text-xs uppercase tracking-wide text-stone-500 dark:bg-stone-900">
            <tr>
              <th className="px-4 py-2">Plant</th>
              <th className="px-4 py-2">Drop weight</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {pool.map((entry) => (
              <tr key={entry.plant_id} className="border-t border-green-200 dark:border-stone-800">
                <td className="px-4 py-2">
                  <span className="flex items-center gap-2">
                    {entry.garden_plants?.image_stage1_url ? (
                      <Image
                        src={entry.garden_plants.image_stage1_url}
                        alt=""
                        width={24}
                        height={24}
                        className="h-6 w-6 rounded"
                      />
                    ) : null}
                    {entry.garden_plants?.name ?? "(deleted plant)"}
                  </span>
                </td>
                <td className="px-4 py-2">{entry.drop_weight}</td>
                <td className="px-4 py-2 text-right">
                  <form action={removeSeedPoolEntry}>
                    <input type="hidden" name="seed_item_id" value={seedItemId} />
                    <input type="hidden" name="plant_id" value={entry.plant_id} />
                    <button type="submit" className="text-xs text-red-600 hover:underline dark:text-red-400">
                      Remove
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {pool.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-4 text-center text-stone-500">
                  This seed&apos;s pool is empty — it can&apos;t be planted yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {availablePlants.length > 0 ? (
        <form action={addSeedPoolEntry} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="seed_item_id" value={seedItemId} />
          <SearchablePicker
            name="plant_id"
            placeholder="Search plants…"
            options={availablePlants.map((p) => ({ id: p.id, label: p.name, imageUrl: p.image_stage1_url }))}
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="drop_weight" className="text-xs text-stone-500">
              Drop weight
            </label>
            <input
              id="drop_weight"
              name="drop_weight"
              type="number"
              min={1}
              step={1}
              defaultValue={1}
              className="w-24 rounded-md border border-green-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
            />
          </div>
          <button
            type="submit"
            className="rounded-md bg-green-800 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 dark:bg-green-200 dark:text-green-950 dark:hover:bg-green-300"
          >
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
    <section className="flex flex-col gap-3">
      <h3 className="text-base font-semibold tracking-tight">Effects</h3>
      <p className="text-sm text-stone-500">
        Applied by plant_seed()/harvest_plot() when a player uses this fertilizer — a fertilizer can carry more than
        one effect.
      </p>
      <div className="overflow-hidden rounded-lg border border-green-200 dark:border-stone-800">
        <table className="w-full text-sm">
          <thead className="bg-green-100 text-left text-xs uppercase tracking-wide text-stone-500 dark:bg-stone-900">
            <tr>
              <th className="px-4 py-2">Effect</th>
              <th className="px-4 py-2">Magnitude</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {effects.map((effect) => (
              <tr key={effect.effect_type} className="border-t border-green-200 dark:border-stone-800">
                <td className="px-4 py-2">{EFFECT_LABELS[effect.effect_type]}</td>
                <td className="px-4 py-2">{effect.effect_magnitude}</td>
                <td className="px-4 py-2 text-right">
                  <form action={removeFertilizerEffect}>
                    <input type="hidden" name="item_id" value={itemId} />
                    <input type="hidden" name="effect_type" value={effect.effect_type} />
                    <button type="submit" className="text-xs text-red-600 hover:underline dark:text-red-400">
                      Remove
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {effects.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-4 text-center text-stone-500">
                  No effects yet — this fertilizer currently does nothing.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {availableTypes.length > 0 ? (
        <form action={addFertilizerEffect} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="item_id" value={itemId} />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="effect_type" className="text-xs text-stone-500">
              Effect
            </label>
            <select
              id="effect_type"
              name="effect_type"
              className="w-72 rounded-md border border-green-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
            >
              {availableTypes.map((t) => (
                <option key={t} value={t}>
                  {EFFECT_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="effect_magnitude" className="text-xs text-stone-500">
              Magnitude
            </label>
            <input
              id="effect_magnitude"
              name="effect_magnitude"
              type="number"
              min={0.01}
              step={0.01}
              defaultValue={0.25}
              className="w-28 rounded-md border border-green-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
            />
          </div>
          <button
            type="submit"
            className="rounded-md bg-green-800 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 dark:bg-green-200 dark:text-green-950 dark:hover:bg-green-300"
          >
            Add effect
          </button>
        </form>
      ) : null}
    </section>
  );
}
