import Image from "next/image";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { ZoneForm } from "../zone-form";
import { SearchablePicker } from "@/components/admin/searchable-picker";
import {
  addLootEntry,
  addPoolEntry,
  removeLootEntry,
  removePoolEntry,
  updateZone,
} from "../actions";

type PoolRow = { species_id: string; drop_weight: number; species: { name: string; image_url: string | null } | null };
type LootRow = { item_id: string; drop_weight: number; items: { name: string; image_url: string | null } | null };

export default async function EditZonePage(props: PageProps<"/admin/zones/[id]">) {
  const { id } = await props.params;
  const { supabase } = await requireAdmin();

  const [
    { data: zone },
    { data: poolData },
    { data: lootData },
    { data: allSpecies },
    { data: allItems },
  ] = await Promise.all([
    supabase
      .from("zones")
      .select(
        "id, name, tier, description, image_url, unlock_requirement, is_tutorial, is_active, map_x, map_y, map_width, map_height, created_at",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("zone_pet_pool")
      .select("species_id, drop_weight, species(name, image_url)")
      .eq("zone_id", id),
    supabase
      .from("zone_loot_table")
      .select("item_id, drop_weight, items(name, image_url)")
      .eq("zone_id", id),
    supabase.from("species").select("id, name, image_url").eq("is_active", true).order("name"),
    supabase.from("items").select("id, name, image_url").eq("is_active", true).order("name"),
  ]);

  if (!zone) {
    notFound();
  }

  const pool = (poolData ?? []) as unknown as PoolRow[];
  const loot = (lootData ?? []) as unknown as LootRow[];
  const poolSpeciesIds = new Set(pool.map((p) => p.species_id));
  const lootItemIds = new Set(loot.map((l) => l.item_id));
  const availableSpecies = (allSpecies ?? []).filter((s) => !poolSpeciesIds.has(s.id));
  const availableItems = (allItems ?? []).filter((i) => !lootItemIds.has(i.id));

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold tracking-tight">Edit zone</h2>
        {zone.is_tutorial ? (
          <p className="text-sm text-green-600 dark:text-green-400">
            This is the tutorial zone — its pool is fixed in code and isn&apos;t managed here.
          </p>
        ) : null}
        <ZoneForm action={updateZone} zone={zone} submitLabel="Save changes" />
      </div>

      {!zone.is_tutorial ? (
        <>
          <section className="flex flex-col gap-3">
            <h3 className="text-base font-semibold tracking-tight">Pet pool</h3>
            <div className="overflow-hidden rounded-lg border border-green-200 dark:border-stone-800">
              <table className="w-full text-sm">
                <thead className="bg-green-100 text-left text-xs uppercase tracking-wide text-stone-500 dark:bg-stone-900">
                  <tr>
                    <th className="px-4 py-2">Species</th>
                    <th className="px-4 py-2">Drop weight</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {pool.map((entry) => (
                    <tr
                      key={entry.species_id}
                      className="border-t border-green-200 dark:border-stone-800"
                    >
                      <td className="px-4 py-2">
                        <span className="flex items-center gap-2">
                          {entry.species?.image_url ? (
                            <Image
                              src={entry.species.image_url}
                              alt=""
                              width={24}
                              height={24}
                              className="h-6 w-6 rounded"
                            />
                          ) : null}
                          {entry.species?.name ?? "(deleted species)"}
                        </span>
                      </td>
                      <td className="px-4 py-2">{entry.drop_weight}</td>
                      <td className="px-4 py-2 text-right">
                        <form action={removePoolEntry}>
                          <input type="hidden" name="zone_id" value={zone.id} />
                          <input type="hidden" name="species_id" value={entry.species_id} />
                          <button
                            type="submit"
                            className="text-xs text-red-600 hover:underline dark:text-red-400"
                          >
                            Remove
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                  {pool.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-4 text-center text-stone-500">
                        No pets in this zone&apos;s pool yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            {availableSpecies.length > 0 ? (
              <form action={addPoolEntry} className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="zone_id" value={zone.id} />
                <SearchablePicker
                  name="species_id"
                  placeholder="Search species…"
                  options={availableSpecies.map((s) => ({
                    id: s.id,
                    label: s.name,
                    imageUrl: s.image_url,
                  }))}
                />
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="pool_drop_weight" className="text-xs text-stone-500">
                    Drop weight
                  </label>
                  <input
                    id="pool_drop_weight"
                    name="drop_weight"
                    type="number"
                    min={1}
                    step={1}
                    defaultValue={1}
                    required
                    className="w-24 rounded-md border border-green-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
                  />
                </div>
                <button
                  type="submit"
                  className="rounded-md border border-green-300 px-3 py-2 text-sm hover:bg-green-100 dark:border-stone-700 dark:hover:bg-stone-800"
                >
                  Add to pool
                </button>
              </form>
            ) : null}
          </section>

          <section className="flex flex-col gap-3">
            <h3 className="text-base font-semibold tracking-tight">Loot table</h3>
            <div className="overflow-hidden rounded-lg border border-green-200 dark:border-stone-800">
              <table className="w-full text-sm">
                <thead className="bg-green-100 text-left text-xs uppercase tracking-wide text-stone-500 dark:bg-stone-900">
                  <tr>
                    <th className="px-4 py-2">Item</th>
                    <th className="px-4 py-2">Drop weight</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {loot.map((entry) => (
                    <tr
                      key={entry.item_id}
                      className="border-t border-green-200 dark:border-stone-800"
                    >
                      <td className="px-4 py-2">
                        <span className="flex items-center gap-2">
                          {entry.items?.image_url ? (
                            <Image
                              src={entry.items.image_url}
                              alt=""
                              width={24}
                              height={24}
                              className="h-6 w-6 rounded"
                            />
                          ) : null}
                          {entry.items?.name ?? "(deleted item)"}
                        </span>
                      </td>
                      <td className="px-4 py-2">{entry.drop_weight}</td>
                      <td className="px-4 py-2 text-right">
                        <form action={removeLootEntry}>
                          <input type="hidden" name="zone_id" value={zone.id} />
                          <input type="hidden" name="item_id" value={entry.item_id} />
                          <button
                            type="submit"
                            className="text-xs text-red-600 hover:underline dark:text-red-400"
                          >
                            Remove
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                  {loot.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-4 text-center text-stone-500">
                        No items in this zone&apos;s loot table yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            {availableItems.length > 0 ? (
              <form action={addLootEntry} className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="zone_id" value={zone.id} />
                <SearchablePicker
                  name="item_id"
                  placeholder="Search items…"
                  options={availableItems.map((i) => ({
                    id: i.id,
                    label: i.name,
                    imageUrl: i.image_url,
                  }))}
                />
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="loot_drop_weight" className="text-xs text-stone-500">
                    Drop weight
                  </label>
                  <input
                    id="loot_drop_weight"
                    name="drop_weight"
                    type="number"
                    min={1}
                    step={1}
                    defaultValue={1}
                    required
                    className="w-24 rounded-md border border-green-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
                  />
                </div>
                <button
                  type="submit"
                  className="rounded-md border border-green-300 px-3 py-2 text-sm hover:bg-green-100 dark:border-stone-700 dark:hover:bg-stone-800"
                >
                  Add to loot table
                </button>
              </form>
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  );
}
