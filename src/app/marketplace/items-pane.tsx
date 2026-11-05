"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { ListingCurrency } from "@/lib/supabase/types";

export type ItemListingRow = {
  id: string;
  name: string;
  imageUrl: string | null;
  category: string;
  quantity: number;
  priceCoins: number | null;
  priceGems: number | null;
  expiresAt: string;
  sellerId: string;
  sellerDisplayId: number;
  sellerName: string;
  isMine: boolean;
};

type Filters = { q: string; cat: string; cur: string; min: number | ""; max: number | ""; sort: string };

export function MarketplaceItemsPane({
  rows,
  userId,
  coinBalance,
  gemBalance,
  categories,
  filters,
  page,
  totalPages,
  pageHref,
  timeLeftLabel,
}: {
  rows: ItemListingRow[];
  userId: string;
  coinBalance: number;
  gemBalance: number;
  categories: { value: string; label: string }[];
  filters: Filters;
  page: number;
  totalPages: number;
  pageHref: (page: number) => string;
  timeLeftLabel: (expiresAt: string) => { label: string; soon: boolean };
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [view, setView] = useState<"mk-lines" | "mk-tiles">("mk-lines");

  useEffect(() => {
    // Deferred a tick so the effect body itself never synchronously
    // calls setState — react-hooks/set-state-in-effect flags that.
    const timer = setTimeout(() => {
      try {
        const saved = localStorage.getItem("mk-view-mk-items");
        if (saved === "mk-lines" || saved === "mk-tiles") setView(saved);
      } catch {
        /* default layout */
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  function chooseView(v: "mk-lines" | "mk-tiles") {
    setView(v);
    try {
      localStorage.setItem("mk-view-mk-items", v);
    } catch {
      /* the choice just isn't remembered */
    }
  }

  const dialogRef = useRef<HTMLDialogElement>(null);
  const [active, setActive] = useState<ItemListingRow | null>(null);
  const [payWith, setPayWith] = useState<ListingCurrency>("coins");
  const [isBuying, setIsBuying] = useState(false);

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function toast(msg: string) {
    setToastMsg(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMsg(null), 2800);
  }

  function openBuy(row: ItemListingRow) {
    setActive(row);
    const canAffordGems = row.priceGems !== null && gemBalance >= row.priceGems;
    const canAffordCoins = row.priceCoins !== null && coinBalance >= row.priceCoins;
    setPayWith(row.priceCoins !== null && (canAffordCoins || !canAffordGems) ? "coins" : "gems");
    dialogRef.current?.showModal();
  }

  async function handleBuy() {
    if (!active) return;
    setIsBuying(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("buy_listing", {
      p_buyer_id: userId,
      p_listing_id: active.id,
      p_currency: payWith,
    });
    setIsBuying(false);

    if (error) {
      toast(error.message);
      return;
    }
    if (data?.status === "unavailable") {
      toast(data.reason);
      dialogRef.current?.close();
      router.refresh();
      return;
    }

    dialogRef.current?.close();
    toast(active.quantity > 1 ? `You bought ${active.quantity} ${active.name}.` : `You bought a ${active.name}.`);
    router.refresh();
  }

  const both = active ? active.priceCoins !== null && active.priceGems !== null : false;
  const price = active ? (payWith === "coins" ? active.priceCoins : active.priceGems) : null;
  const balance = payWith === "coins" ? coinBalance : gemBalance;
  const after = price !== null ? balance - price : balance;

  return (
    <div className="mk-pane" id="mk-items">
      <form
        ref={formRef}
        className="mk-tools"
        method="get"
        onChange={() => formRef.current?.requestSubmit()}
      >
        <input type="hidden" name="tab" value="items" />
        <input
          className="mk-q"
          type="search"
          name="q"
          defaultValue={filters.q}
          placeholder="Search items"
          aria-label="Search items"
          autoComplete="off"
        />
        <select name="cat" defaultValue={filters.cat} aria-label="Category">
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <select name="cur" defaultValue={filters.cur} aria-label="Paid in">
          <option value="">Coins or gems</option>
          <option value="coin">Takes coins</option>
          <option value="gem">Takes gems</option>
        </select>
        <label className="mk-num">
          <input
            type="number"
            name="min"
            min={0}
            defaultValue={filters.min}
            placeholder="Min price"
            aria-label="Lowest price"
            disabled={!filters.cur}
          />
        </label>
        <label className="mk-num">
          <input
            type="number"
            name="max"
            min={0}
            defaultValue={filters.max}
            placeholder="Max price"
            aria-label="Highest price"
            disabled={!filters.cur}
          />
        </label>
        <select name="sort" defaultValue={filters.sort} aria-label="Sort by">
          <option value="new">Newest</option>
          <option value="low">Price: low to high</option>
          <option value="high">Price: high to low</option>
          <option value="each">Cheapest per item</option>
          <option value="left">Ending soon</option>
          <option value="name">Name</option>
        </select>
        <button type="submit" className="btn btn-sm btn-cream">
          Filter
        </button>
        <div className="mk-view" role="group" aria-label="Layout">
          <button type="button" aria-pressed={view === "mk-lines"} onClick={() => chooseView("mk-lines")}>
            Rows
          </button>
          <button type="button" aria-pressed={view === "mk-tiles"} onClick={() => chooseView("mk-tiles")}>
            Tiles
          </button>
        </div>
      </form>

      {rows.length === 0 ? (
        <p className="mk-empty">No items for sale. Try different filters.</p>
      ) : (
        <ul className={`mk-lot-list ${view}`}>
          {rows.map((row) => {
            const exp = timeLeftLabel(row.expiresAt);
            const each = row.quantity > 1 ? (row.priceCoins ?? row.priceGems ?? 0) / row.quantity : null;
            return (
              <li key={row.id} className="mk-lot mk-line">
                <span className="mk-ic">
                  {row.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- unsized catalog art, object-fit: contain per .mk-ic img
                    <img src={row.imageUrl} alt="" />
                  ) : (
                    <span className="iv-ph bag blue" />
                  )}
                  {row.quantity > 1 ? (
                    <span className="mk-qty" aria-hidden="true">
                      &times;{row.quantity}
                    </span>
                  ) : null}
                </span>
                <span className="mk-nm">
                  {row.name}
                  <small>{row.category}</small>
                </span>
                <p className="mk-by">
                  Listed by{" "}
                  <Link className="lnk" href={`/u/${row.sellerDisplayId}`}>
                    {row.sellerName}
                  </Link>
                  <span className={`mk-exp${exp.soon ? " soon" : ""}`}>{exp.label}</span>
                </p>
                <span className="mk-pp">
                  <PriceTag coins={row.priceCoins} gems={row.priceGems} />
                  <small className="mk-each">{each !== null ? `${round2(each)} each` : ""}</small>
                </span>
                {row.isMine ? (
                  <Link className="btn btn-sm btn-cream" href="/marketplace/listings">
                    Yours
                  </Link>
                ) : (
                  <button type="button" className="btn btn-sm btn-leaf" onClick={() => openBuy(row)}>
                    Buy
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {totalPages > 1 ? (
        <nav className="mk-pager" aria-label="Item pages">
          {page > 1 ? <Link href={pageHref(page - 1)}>Previous</Link> : null}
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link key={p} href={pageHref(p)} aria-current={p === page ? "page" : undefined}>
              {p}
            </Link>
          ))}
          {page < totalPages ? <Link href={pageHref(page + 1)}>Next</Link> : null}
        </nav>
      ) : null}

      <dialog className="fg mk-dlg" ref={dialogRef} aria-labelledby="mk-dlg-t">
        <form method="dialog">
          <h2 className="frame-title">
            <span id="mk-dlg-t">{active && active.quantity > 1 ? "Buy this stack?" : "Buy this item?"}</span>
          </h2>
          <div className="mk-db">
            <div className="mk-dhead">
              <span className="mk-dpic">
                {active?.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- see list icon above
                  <img src={active.imageUrl} alt="" />
                ) : null}
              </span>
              <div>
                <span className="mk-dname">
                  {active?.name}
                  {active && active.quantity > 1 ? ` ×${active.quantity}` : ""}
                </span>
                <span className="mk-dmeta">
                  Sold by {active?.sellerName}
                  {active && active.quantity > 1 ? ", the whole stack" : ""}
                </span>
              </div>
            </div>

            {both ? (
              <div className="mk-field">
                <span className="mk-sl">Pay with</span>
                <fieldset className="mk-seg">
                  <legend className="sr">Pay with</legend>
                  <label>
                    <input
                      type="radio"
                      checked={payWith === "coins"}
                      onChange={() => setPayWith("coins")}
                    />
                    <span className="coin" aria-hidden="true" />
                    <span>{active?.priceCoins}</span>
                  </label>
                  <label>
                    <input type="radio" checked={payWith === "gems"} onChange={() => setPayWith("gems")} />
                    <span className="coin gem" aria-hidden="true" />
                    <span>{active?.priceGems}</span>
                  </label>
                </fieldset>
              </div>
            ) : null}

            <dl className="mk-sum">
              <div className="mk-big">
                <dt>Price</dt>
                <dd>
                  <span className={payWith === "gems" ? "coin gem" : "coin"} aria-hidden="true" />
                  <span>{price}</span>
                </dd>
              </div>
              <div>
                <dt>You will have</dt>
                <dd>
                  <span className={payWith === "gems" ? "coin gem" : "coin"} aria-hidden="true" />
                  <span>{after}</span>
                </dd>
              </div>
            </dl>
            <p className="mk-warn">{after < 0 ? `You don't have enough ${payWith}.` : ""}</p>
          </div>
          <div className="mk-foot">
            <button type="submit" className="btn btn-cream" value="cancel" formNoValidate>
              Cancel
            </button>
            <button type="button" className="btn btn-leaf" disabled={isBuying || after < 0} onClick={handleBuy}>
              {isBuying ? "Buying…" : "Buy"}
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

function PriceTag({ coins, gems }: { coins: number | null; gems: number | null }) {
  if (coins !== null && gems !== null) {
    return (
      <span className="mk-price mk-both">
        <span>
          <span className="coin" aria-hidden="true" />
          {coins}
        </span>
        <span>
          <i className="mk-or">or</i>
          <span className="coin gem" aria-hidden="true" />
          {gems}
        </span>
      </span>
    );
  }
  return (
    <span className="mk-price">
      <span className={gems !== null ? "coin gem" : "coin"} aria-hidden="true" />
      {coins ?? gems}
    </span>
  );
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
