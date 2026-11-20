import Image from "next/image";
import Link from "next/link";
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
type LootRow = {
  item_id: string;
  amount: number;
  drop_weight: number;
  items: { name: string; image_url: string | null } | null;
};

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
        "id, name, description, image_url, is_active, reward_coins_base, reward_coins_variance, reward_xp, created_at",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("zone_pet_pool")
      .select("species_id, drop_weight, species(name, image_url)")
      .eq("zone_id", id),
    supabase
      .from("zone_loot_table")
      .select("item_id, amount, drop_weight, items(name, image_url)")
      .eq("zone_id", id),
    supabase.from("species").select("id, name, image_url").order("name"),
    supabase.from("items").select("id, name, image_url").order("name"),
  ]);

  if (!zone) {
    notFound();
  }

  const pool = (poolData ?? []) as unknown as PoolRow[];
  const loot = (lootData ?? []) as unknown as LootRow[];
  const poolSpeciesIds = new Set(pool.map((p) => p.species_id));
  const availableSpecies = (allSpecies ?? []).filter((s) => !poolSpeciesIds.has(s.id));
  const availableItems = allItems ?? [];

  const poolTotalWeight = pool.reduce((sum, p) => sum + p.drop_weight, 0);
  const lootTotalWeight = loot.reduce((sum, l) => sum + l.drop_weight, 0);

  return (
    <>
      <div className="crumbs">
        <Link href="/admin">Dashboard</Link>
        <i>/</i>
        <Link href="/admin/zones">Zones</Link>
        <i>/</i>
        <span>{zone.name}</span>
      </div>
      <div className="ph">
        <h1>{zone.name}</h1>
      </div>
      <p className="chips">
        <span>On this page:</span>
        <a href="#details">Details</a>
        <a href="#pet-pool">Pet pool</a>
        <a href="#item-pool">Item pool</a>
      </p>
      <div id="details">
        <ZoneForm action={updateZone} zone={zone} isNew={false} cancelHref="/admin/zones" />
      </div>

      <section className="sub card" id="pet-pool">
            <div className="sh">
              <h2>
                Pet pool
                <span className="cnt">{pool.length}</span>
              </h2>
              <p className="hint">
                Pet models a trip here can meet. <b>Changes in this section save right away.</b>
              </p>
            </div>
            <div className="tw">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Species</th>
                    <th>Drop weight</th>
                    <th>Chance</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {pool.map((entry) => (
                    <tr key={entry.species_id}>
                      <td>
                        <span className="rl">
                          {entry.species?.image_url ? (
                            <Image src={entry.species.image_url} alt="" width={24} height={24} className="th xs" />
                          ) : null}
                          {entry.species?.name ?? "(deleted species)"}
                        </span>
                      </td>
                      <td>{entry.drop_weight}</td>
                      <td className="muted">
                        {poolTotalWeight > 0 ? `${((entry.drop_weight / poolTotalWeight) * 100).toFixed(1)}%` : "—"}
                      </td>
                      <td className="act">
                        <form action={removePoolEntry}>
                          <input type="hidden" name="zone_id" value={zone.id} />
                          <input type="hidden" name="species_id" value={entry.species_id} />
                          <button type="submit" className="lnk red">
                            Remove
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                  {pool.length === 0 ? (
                    <tr className="empty">
                      <td colSpan={4}>No pets in this zone&apos;s pool yet.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            {availableSpecies.length > 0 ? (
              <form action={addPoolEntry} className="addrow">
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
                <div>
                  <label htmlFor="pool_drop_weight" className="lbl">
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
                    className="in num nm"
                  />
                </div>
                <button type="submit" className="btn sm">
                  Add to pool
                </button>
              </form>
            ) : null}
          </section>

          <section className="sub card" id="item-pool">
            <div className="sh">
              <h2>
                Item pool
                <span className="cnt">{loot.length}</span>
              </h2>
              <p className="hint">
                Items (and how many of them) a trip here can bring back. The same item can appear more than once at a
                different amount — e.g. &quot;10 Blueberries&quot; and &quot;5 Blueberries&quot; as two
                separately-weighted rows. Adding an item at an amount that&apos;s already in the pool updates that
                row&apos;s weight instead of adding a duplicate. <b>Changes in this section save right away.</b>
              </p>
            </div>
            <div className="tw">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Amount</th>
                    <th>Drop weight</th>
                    <th>Chance</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {loot.map((entry) => (
                    <tr key={`${entry.item_id}:${entry.amount}`}>
                      <td>
                        <span className="rl">
                          {entry.items?.image_url ? (
                            <Image src={entry.items.image_url} alt="" width={24} height={24} className="th xs" />
                          ) : null}
                          {entry.items?.name ?? "(deleted item)"}
                        </span>
                      </td>
                      <td>{entry.amount}</td>
                      <td>{entry.drop_weight}</td>
                      <td className="muted">
                        {lootTotalWeight > 0 ? `${((entry.drop_weight / lootTotalWeight) * 100).toFixed(1)}%` : "—"}
                      </td>
                      <td className="act">
                        <form action={removeLootEntry}>
                          <input type="hidden" name="zone_id" value={zone.id} />
                          <input type="hidden" name="item_id" value={entry.item_id} />
                          <input type="hidden" name="amount" value={entry.amount} />
                          <button type="submit" className="lnk red">
                            Remove
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                  {loot.length === 0 ? (
                    <tr className="empty">
                      <td colSpan={5}>No items in this zone&apos;s pool yet.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            {availableItems.length > 0 ? (
              <form action={addLootEntry} className="addrow">
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
                <div>
                  <label htmlFor="loot_amount" className="lbl">
                    Amount
                  </label>
                  <input id="loot_amount" name="amount" type="number" min={1} step={1} defaultValue={1} required className="in num nm" />
                </div>
                <div>
                  <label htmlFor="loot_drop_weight" className="lbl">
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
                    className="in num nm"
                  />
                </div>
                <button type="submit" className="btn sm">
                  Add to pool
                </button>
              </form>
            ) : null}
          </section>
    </>
  );
}
