"use client";

import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { ItemType } from "@/lib/supabase/types";

export type UIItem = {
  id: string;
  name: string;
  type: ItemType;
  description: string | null;
  imageUrl: string | null;
  quantity: number;
  foodValue: number | null;
};

const TYPE_LABELS: Record<ItemType, string> = {
  ingredient: "Ingredients",
  potion: "Potions",
  cosmetic: "Cosmetics",
  seed: "Seeds",
  fertilizer: "Fertilizer",
};

// Tinted mask-icon fallback for an item with no art uploaded — same
// idea as /shop's per-section fallback tile. No per-item "sellable"
// flag exists in this app's schema (the handoff's data-sell="0" sample
// rows for cosmetics were invented for the mockup), so every item can
// be listed on the Marketplace, which — unlike the separate /trades
// feature — isn't behind TRADING_ENABLED.
const TYPE_PLACEHOLDER: Record<ItemType, { icon: "bag" | "star" | "diamond" | "paw"; tint: "blue" | "gold" | "pink" | "leaf" }> = {
  ingredient: { icon: "bag", tint: "leaf" },
  seed: { icon: "bag", tint: "blue" },
  fertilizer: { icon: "bag", tint: "gold" },
  potion: { icon: "star", tint: "gold" },
  cosmetic: { icon: "diamond", tint: "pink" },
};

type SortKey = "name" | "qty" | "food";

function ItemPicture({ item }: { item: UIItem }) {
  if (item.imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- unsized, object-fit: contain, same as the design's own <img>
    return <img src={item.imageUrl} alt="" />;
  }
  const ph = TYPE_PLACEHOLDER[item.type];
  return <span className={`iv-ph ${ph.icon} ${ph.tint}`} aria-hidden="true" />;
}

export function ItemsApp({
  userId,
  initialItems,
  initialFoodPoints,
}: {
  userId: string;
  initialItems: UIItem[];
  initialFoodPoints: number;
}) {
  const supabase = useMemo(() => createClient(), []);

  const [items, setItems] = useState<UIItem[]>(initialItems);
  const [foodPoints, setFoodPoints] = useState(initialFoodPoints);
  const [category, setCategory] = useState<ItemType | "All">("All");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("name");
  const [selectedId, setSelectedId] = useState<string | null>(initialItems[0]?.id ?? null);

  const [convertAmount, setConvertAmount] = useState(1);
  const [isConverting, setIsConverting] = useState(false);
  const convertDialogRef = useRef<HTMLDialogElement>(null);

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function toast(msg: string) {
    setToastMsg(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMsg(null), 3200);
  }

  const typesPresent = useMemo(() => {
    const seen = new Set<ItemType>();
    for (const item of items) seen.add(item.type);
    return Array.from(seen);
  }, [items]);

  const tabs: { value: ItemType | "All"; label: string; count: number }[] = [
    { value: "All", label: "All", count: items.length },
    ...typesPresent.map((t) => ({ value: t, label: TYPE_LABELS[t], count: items.filter((i) => i.type === t).length })),
  ];

  const filteredSorted = useMemo(() => {
    const term = query.trim().toLowerCase();
    const list = items.filter(
      (item) => (category === "All" || item.type === category) && item.name.toLowerCase().includes(term),
    );
    list.sort((a, b) => {
      if (sort === "qty") return b.quantity - a.quantity;
      if (sort === "food") return (b.foodValue ?? 0) - (a.foodValue ?? 0) || a.name.localeCompare(b.name);
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [items, category, query, sort]);

  // Falls back to the first visible item once the selected one stops
  // matching the current filter/search, or disappears (used up) —
  // computed during render, same "self-correct without an extra effect
  // cycle" reasoning as pets-app.tsx's effectiveTab.
  const selected = useMemo(() => {
    const stillVisible = filteredSorted.find((i) => i.id === selectedId);
    return stillVisible ?? filteredSorted[0] ?? null;
  }, [filteredSorted, selectedId]);

  function openConvertDialog() {
    if (!selected || !selected.foodValue) return;
    setConvertAmount(1);
    convertDialogRef.current?.showModal();
  }

  async function applyConvert() {
    if (!selected || !selected.foodValue) return;
    const amount = Math.max(1, Math.min(selected.quantity, Math.floor(convertAmount) || 1));
    setIsConverting(true);

    const { data, error } = await supabase.rpc("convert_items_to_food", {
      p_user_id: userId,
      p_item_id: selected.id,
      p_amount: amount,
    });

    setIsConverting(false);

    if (error) {
      toast(error.message);
      return;
    }

    convertDialogRef.current?.close();
    setFoodPoints(data.new_food_points);
    setItems((curr) =>
      curr
        .map((i) => (i.id === selected.id ? { ...i, quantity: data.new_quantity } : i))
        .filter((i) => i.quantity > 0),
    );
    if (data.new_quantity <= 0) {
      setSelectedId(null);
    }
    toast(`Made ${data.gained} food points from ${amount} ${selected.name}${amount === 1 ? "" : "s"}.`);
  }

  const gained = selected ? (selected.foodValue ?? 0) * Math.max(1, Math.min(selected.quantity, convertAmount)) : 0;

  return (
    <div className="panel iv">
      <h1 className="iv-h1">
        Items (<span>{items.length}</span>)
      </h1>
      <p className="iv-sub">
        Crafting ingredients and cosmetics — not for decorating pets. <Link href="/pets">Looking for pets?</Link>
      </p>

      <div className="iv-tabs" role="tablist" aria-label="Item categories">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            className="iv-tab"
            role="tab"
            aria-selected={category === tab.value}
            onClick={() => setCategory(tab.value)}
          >
            {tab.label}
            <em>{tab.count}</em>
          </button>
        ))}
      </div>

      <div className="iv-bag">
        <div className="iv-main">
          <div className="iv-tools">
            <input
              type="search"
              placeholder="Search items"
              aria-label="Search items"
              autoComplete="off"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select aria-label="Sort items" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
              <option value="name">Name</option>
              <option value="qty">Most owned</option>
              <option value="food">Most food points</option>
            </select>
          </div>

          {filteredSorted.length === 0 ? (
            <p className="iv-empty">{items.length === 0 ? "No items yet — expeditions sometimes return one instead of a pet." : "No items match."}</p>
          ) : (
            <ul className="iv-slots">
              {filteredSorted.map((item) => (
                <li className={`iv-it${selected?.id === item.id ? " on" : ""}`} key={item.id}>
                  <button
                    type="button"
                    className="iv-slot"
                    aria-pressed={selected?.id === item.id}
                    aria-label={`${item.name}, owned ${item.quantity}`}
                    onClick={() => setSelectedId(item.id)}
                  >
                    <ItemPicture item={item} />
                    {item.quantity > 1 ? (
                      <span className="iv-qty" aria-hidden="true">
                        &times;{item.quantity}
                      </span>
                    ) : null}
                  </button>
                  <span className="iv-nm">{item.name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="iv-side" aria-live="polite">
          {selected ? (
            <>
              <h2 className="iv-sp-name">{selected.name}</h2>
              <div className="iv-sp-pic">
                <ItemPicture item={selected} />
              </div>
              <p className="iv-sp-meta">{TYPE_LABELS[selected.type]}</p>
              {selected.description ? <p className="iv-sp-desc">{selected.description}</p> : null}
              <ul className="iv-facts">
                <li>
                  <small>Owned</small>
                  <span>{selected.quantity}</span>
                </li>
                <li>
                  <small>Food points</small>
                  <span>{selected.foodValue ? `${selected.foodValue} each` : "—"}</span>
                </li>
              </ul>
              <div className="iv-sp-foot">
                <button type="button" className="btn btn-sm btn-leaf" disabled={!selected.foodValue} onClick={openConvertDialog}>
                  Food points
                </button>
                <Link className="btn btn-sm btn-orange" href={`/marketplace/sell?item=${selected.id}`}>
                  Sell
                </Link>
                {!selected.foodValue ? (
                  <p className="iv-sp-note">This item can&apos;t be turned into food points.</p>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <h2 className="iv-sp-name">Pick an item</h2>
              <p className="iv-sp-desc">Choose something from your collection to see its details.</p>
            </>
          )}
        </div>
      </div>

      <dialog className="fg iv-dlg" ref={convertDialogRef} aria-labelledby="iv-dlg-food-t">
        <form method="dialog">
          <h2 className="frame-title">
            <span id="iv-dlg-food-t">Make food points</span>
          </h2>
          {selected ? (
            <div className="fg-body iv-db">
              <div className="iv-dhead">
                <div className="iv-dpic">
                  <ItemPicture item={selected} />
                </div>
                <div>
                  <b className="iv-dname">{selected.name}</b>
                  <span className="iv-dmeta">You own {selected.quantity}</span>
                </div>
              </div>
              <div className="iv-step">
                <span className="iv-sl">How many?</span>
                <div className="iv-sc">
                  <button
                    type="button"
                    className="btn btn-sm btn-cream btn-round"
                    aria-label="One fewer"
                    onClick={() => setConvertAmount((n) => Math.max(1, n - 1))}
                  >
                    &minus;
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={convertAmount}
                    aria-label="How many"
                    onChange={(e) => setConvertAmount(Math.max(1, Math.min(selected.quantity, Number(e.target.value) || 1)))}
                  />
                  <button
                    type="button"
                    className="btn btn-sm btn-cream btn-round"
                    aria-label="One more"
                    onClick={() => setConvertAmount((n) => Math.min(selected.quantity, n + 1))}
                  >
                    +
                  </button>
                  <button type="button" className="btn btn-sm btn-cream" onClick={() => setConvertAmount(selected.quantity)}>
                    All ({selected.quantity})
                  </button>
                </div>
              </div>
              <dl className="iv-sum">
                <div>
                  <dt>Each is worth</dt>
                  <dd>
                    <span>{selected.foodValue ?? 0}</span> food points
                  </dd>
                </div>
                <div className="iv-big">
                  <dt>You get</dt>
                  <dd>
                    <span>{gained}</span> food points
                  </dd>
                </div>
                <div>
                  <dt>You will have</dt>
                  <dd>
                    <span>{foodPoints + gained}</span> food points
                  </dd>
                </div>
              </dl>
              <p className="iv-warn">The items are used up and can&rsquo;t be taken back.</p>
            </div>
          ) : null}
          <div className="fg-foot">
            <button type="button" className="btn btn-cream" onClick={() => convertDialogRef.current?.close()}>
              Cancel
            </button>
            <button type="button" className="btn btn-leaf" disabled={isConverting} onClick={applyConvert}>
              {isConverting ? "Making…" : "Make food points"}
            </button>
          </div>
        </form>
      </dialog>

      {typeof document !== "undefined"
        ? createPortal(
            <div className="pets-toast" role="status" aria-live="polite" hidden={!toastMsg}>
              <span>{toastMsg}</span>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
