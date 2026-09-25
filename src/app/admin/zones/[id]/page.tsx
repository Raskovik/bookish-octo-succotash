import Image from "next/image";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { ZoneForm } from "../zone-form";
import { SearchablePicker } from "@/components/admin/searchable-picker";
import { addLootEntry, removeLootEntry, updateZone } from "../actions";

type LootRow = { item_id: string; drop_weight: number; items: { name: string; image_url: string | null } | null };

export default async function EditZonePage(props: PageProps<"/admin/zones/[id]">) {
  const { id } = await props.params;
  const { supabase } = await requireAdmin();

  const [{ data: zone }, { data: lootData }, { data: allItems }] = await Promise.all([
    supabase
      .from("zones")
      .select(
        "id, name, tier, description, image_url, unlock_requirement, is_tutorial, is_active, map_x, map_y, map_width, map_height, created_at",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("zone_loot_table")
      .select("item_id, drop_weight, items(name, image_url)")
      .eq("zone_id", id),
    supabase.from("items").select("id, name, image_url").eq("is_active", true).order("name"),
  ]);

  if (!zone) {
    notFound();
  }

  const loot = (lootData ?? []) as unknown as LootRow[];
  const lootItemIds = new Set(loot.map((l) => l.item_id));
  const availableItems = (allItems ?? []).filter((i) => !lootItemIds.has(i.id));

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold tracking-tight">Edit zone</h2>
        {zone.is_tutorial ? (
          <p className="text-sm text-green-600 dark:text-green-400">
            This is the tutorial zone — its starter pets are fixed in code and aren&apos;t managed here.
          </p>
        ) : null}
        <ZoneForm action={updateZone} zone={zone} submitLabel="Save changes" />
      </div>

      {!zone.is_tutorial ? (
        <>
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
