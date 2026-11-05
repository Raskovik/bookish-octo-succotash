"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { timeLeftLabel } from "./time-left";
import { buildPageHref } from "./query-string";
import type { ListingCurrency } from "@/lib/supabase/types";

export type PetListingRow = {
  id: string;
  name: string;
  speciesName: string;
  imageUrl: string | null;
  level: number;
  strength: number;
  speed: number;
  defence: number;
  strTier: "" | "pt-silver" | "pt-gold" | "pt-diamond";
  spdTier: "" | "pt-silver" | "pt-gold" | "pt-diamond";
  defTier: "" | "pt-silver" | "pt-gold" | "pt-diamond";
  priceCoins: number | null;
  priceGems: number | null;
  expiresAt: string;
  sellerId: string;
  sellerDisplayId: number;
  sellerName: string;
  isMine: boolean;
};

type Filters = { q: string; cur: string; min: number | ""; max: number | ""; sort: string };

function StatPlaques({ row }: { row: PetListingRow }) {
  return (
    <div className="mk-st">
      <div className={`pt-tier ${row.strTier}`}>
        <div className="pt-p">
          <i />
          <small>STR</small>
          <b>{row.strength}</b>
        </div>
      </div>
      <div className={`pt-tier ${row.spdTier}`}>
        <div className="pt-p">
          <i />
          <small>SPD</small>
          <b>{row.speed}</b>
        </div>
      </div>
      <div className={`pt-tier ${row.defTier}`}>
        <div className="pt-p">
          <i />
          <small>DEF</small>
          <b>{row.defence}</b>
        </div>
      </div>
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

export function MarketplacePetsPane({
  rows,
  userId,
  coinBalance,
  gemBalance,
  filters,
  page,
  totalPages,
  tab,
}: {
  rows: PetListingRow[];
  userId: string;
  coinBalance: number;
  gemBalance: number;
  filters: Filters;
  page: number;
  totalPages: number;
  tab: "items" | "pets";
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [view, setView] = useState<"mk-cards" | "mk-prows">("mk-cards");

  useEffect(() => {
    // Deferred a tick so the effect body itself never synchronously
    // calls setState — react-hooks/set-state-in-effect flags that.
    const timer = setTimeout(() => {
      try {
        const saved = localStorage.getItem("mk-view-mk-pets");
        if (saved === "mk-cards" || saved === "mk-prows") setView(saved);
      } catch {
        /* default layout */
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  function chooseView(v: "mk-cards" | "mk-prows") {
    setView(v);
    try {
      localStorage.setItem("mk-view-mk-pets", v);
    } catch {
      /* the choice just isn't remembered */
    }
  }

  const dialogRef = useRef<HTMLDialogElement>(null);
  const [active, setActive] = useState<PetListingRow | null>(null);
  const [payWith, setPayWith] = useState<ListingCurrency>("coins");
  const [isBuying, setIsBuying] = useState(false);

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function toast(msg: string) {
    setToastMsg(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMsg(null), 2800);
  }

  function openBuy(row: PetListingRow) {
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
    toast(`${active.name} is yours! Find them in your pets.`);
    router.refresh();
  }

  const both = active ? active.priceCoins !== null && active.priceGems !== null : false;
  const price = active ? (payWith === "coins" ? active.priceCoins : active.priceGems) : null;
  const balance = payWith === "coins" ? coinBalance : gemBalance;
  const after = price !== null ? balance - price : balance;

  return (
    <div className="mk-pane" id="mk-pets">
      <form
        ref={formRef}
        className="mk-tools"
        method="get"
        onChange={() => formRef.current?.requestSubmit()}
      >
        <input type="hidden" name="tab" value="pets" />
        <input
          className="mk-q"
          type="search"
          name="q"
          defaultValue={filters.q}
          placeholder="Search pets or species"
          aria-label="Search pets or species"
          autoComplete="off"
        />
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
          <option value="left">Ending soon</option>
          <option value="level">Highest level</option>
          <option value="str">Highest STR</option>
          <option value="spd">Highest SPD</option>
          <option value="def">Highest DEF</option>
        </select>
        <button type="submit" className="btn btn-sm btn-cream">
          Filter
        </button>
        <div className="mk-view" role="group" aria-label="Layout">
          <button type="button" aria-pressed={view === "mk-cards"} onClick={() => chooseView("mk-cards")}>
            Cards
          </button>
          <button type="button" aria-pressed={view === "mk-prows"} onClick={() => chooseView("mk-prows")}>
            Rows
          </button>
        </div>
      </form>

      {rows.length === 0 ? (
        <p className="mk-empty">No pets for sale. Try different filters.</p>
      ) : (
        <ul className={`mk-lot-list ${view}`}>
          {rows.map((row) => {
            const exp = timeLeftLabel(row.expiresAt);
            return (
              <li key={row.id} className="mk-lot mk-pet">
                <div className="mk-ppic">
                  {row.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- unsized catalog art, object-fit: contain per .mk-ppic img
                    <img src={row.imageUrl} alt="" />
                  ) : null}
                  <span className="tag">Lv {row.level}</span>
                </div>
                <h3 className="mk-pn">
                  {row.name}
                  <small className="mk-lv">Level {row.level}</small>
                </h3>
                <StatPlaques row={row} />
                <p className="mk-by">
                  Listed by{" "}
                  <Link className="lnk" href={`/u/${row.sellerDisplayId}`}>
                    {row.sellerName}
                  </Link>
                  <span className={`mk-exp${exp.soon ? " soon" : ""}`}>{exp.label}</span>
                </p>
                <div className="mk-buy">
                  <PriceTag coins={row.priceCoins} gems={row.priceGems} />
                  {row.isMine ? (
                    <Link className="btn btn-sm btn-cream" href="/marketplace/listings">
                      Yours
                    </Link>
                  ) : (
                    <button type="button" className="btn btn-sm btn-leaf" onClick={() => openBuy(row)}>
                      Buy
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {totalPages > 1 ? (
        <nav className="mk-pager" aria-label="Pet pages">
          {page > 1 ? <Link href={buildPageHref(tab, filters, page - 1)}>Previous</Link> : null}
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link key={p} href={buildPageHref(tab, filters, p)} aria-current={p === page ? "page" : undefined}>
              {p}
            </Link>
          ))}
          {page < totalPages ? <Link href={buildPageHref(tab, filters, page + 1)}>Next</Link> : null}
        </nav>
      ) : null}

      <dialog className="fg mk-dlg" ref={dialogRef} aria-labelledby="mk-dlg-pet-t">
        <form method="dialog">
          <h2 className="frame-title">
            <span id="mk-dlg-pet-t">Buy this pet?</span>
          </h2>
          <div className="mk-db">
            <div className="mk-pcenter">
              {active?.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- see card picture above
                <img src={active.imageUrl} alt="" />
              ) : null}
              <p className="mk-pn">
                <span>{active?.name}</span> <span className="tag">Lv {active?.level}</span>
              </p>
              {active ? <StatPlaques row={active} /> : null}
              <p className="mk-by">Sold by {active?.sellerName}</p>
            </div>

            {both ? (
              <div className="mk-field">
                <span className="mk-sl">Pay with</span>
                <fieldset className="mk-seg">
                  <legend className="sr">Pay with</legend>
                  <label>
                    <input type="radio" checked={payWith === "coins"} onChange={() => setPayWith("coins")} />
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
              {isBuying ? "Buying…" : "Buy pet"}
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
