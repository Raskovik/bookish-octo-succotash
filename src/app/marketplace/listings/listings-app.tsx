"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { MarketplaceListing } from "@/lib/supabase/types";

type Kind = "item" | "pet";
type ShowFilter = "" | Kind;

function kindOf(listing: MarketplaceListing): Kind {
  return listing.listing_type === "pet" ? "pet" : "item";
}

function name(listing: MarketplaceListing): string {
  return kindOf(listing) === "pet" ? listing.pet_custom_name ?? listing.pet_species_name ?? "Pet" : listing.itemName ?? "Item";
}

function imageUrl(listing: MarketplaceListing): string | null {
  return kindOf(listing) === "pet" ? listing.pet_species_image_url : listing.itemImageUrl;
}

function meta(listing: MarketplaceListing): string {
  if (kindOf(listing) === "pet") return `Pet, ${listing.pet_species_name ?? ""}`;
  const qty = listing.item_quantity ?? 1;
  return qty > 1 ? `Stack of ${qty}` : "Ingredients";
}

function ago(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
}

function endsIn(iso: string): { label: string; soon: boolean } {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return { label: "Ending…", soon: true };
  const hours = Math.ceil(ms / (60 * 60 * 1000));
  if (hours < 24) return { label: `Ends in ${hours} hour${hours === 1 ? "" : "s"}`, soon: true };
  const days = Math.ceil(hours / 24);
  return { label: `Ends in ${days} day${days === 1 ? "" : "s"}`, soon: false };
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

function ListingIcon({ listing }: { listing: MarketplaceListing }) {
  const isPet = kindOf(listing) === "pet";
  const img = imageUrl(listing);
  const qty = listing.item_quantity ?? 1;
  return (
    <span className={`mk-ic${isPet ? " mk-pic-pet" : ""}`}>
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element -- unsized catalog/species art, object-fit: contain per .mk-ic img
        <img src={img} alt="" />
      ) : !isPet ? (
        <span className="iv-ph bag blue" />
      ) : null}
      {!isPet && qty > 1 ? (
        <span className="mk-qty" aria-hidden="true">
          &times;{qty}
        </span>
      ) : null}
    </span>
  );
}

export function ListingsApp({ userId, listings }: { userId: string; listings: MarketplaceListing[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<"sale" | "expired" | "sold" | "purchases">("sale");
  const [show, setShow] = useState<ShowFilter>("");

  const selling = useMemo(() => listings.filter((l) => l.sellerId === userId), [listings, userId]);
  const purchases = useMemo(() => listings.filter((l) => l.buyerId === userId), [listings, userId]);
  const forSale = useMemo(() => selling.filter((l) => l.status === "active"), [selling]);
  const expired = useMemo(() => selling.filter((l) => l.status === "expired" || l.status === "cancelled"), [selling]);
  const sold = useMemo(() => selling.filter((l) => l.status === "sold"), [selling]);

  const apply = (rows: MarketplaceListing[]) => (show ? rows.filter((l) => kindOf(l) === show) : rows);
  const saleRows = apply(forSale);
  const expiredRows = apply(expired);
  const soldRows = apply(sold);
  const purchaseRows = apply(purchases);

  const earnedCoins = sold.reduce((sum, l) => sum + (l.price_coins ?? 0), 0);
  const earnedGems = sold.reduce((sum, l) => sum + (l.price_gems ?? 0), 0);

  const dialogRef = useRef<HTMLDialogElement>(null);
  const [cancelTarget, setCancelTarget] = useState<MarketplaceListing | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function toast(msg: string) {
    setToastMsg(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMsg(null), 2800);
  }

  function openCancel(listing: MarketplaceListing) {
    setCancelTarget(listing);
    dialogRef.current?.showModal();
  }

  async function confirmCancel() {
    if (!cancelTarget) return;
    setIsCancelling(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("cancel_listing", {
      p_user_id: userId,
      p_listing_id: cancelTarget.id,
    });
    setIsCancelling(false);

    if (error) {
      toast(error.message);
      return;
    }

    dialogRef.current?.close();
    toast(`${name(cancelTarget)} is back in your ${kindOf(cancelTarget) === "pet" ? "pets" : "items"}.`);
    router.refresh();
  }

  return (
    <main id="main">
      <div className="sheet">
        <div className="panel">
          <div className="mk-top">
            <div>
              <h1 className="mk-h1">My listings</h1>
              <p className="mk-sub">What you have for sale, what has sold, and what ran out of time.</p>
            </div>
            <div className="mk-act">
              <Link className="btn btn-sm btn-cream" href="/marketplace">
                Back to Marketplace
              </Link>
              <Link className="btn btn-sm btn-orange" href="/marketplace/sell">
                Sell something
              </Link>
            </div>
          </div>

          <div className="sh-ftabs mk-tabs" role="tablist" aria-label="My listings">
            <button type="button" className="sh-ft" role="tab" aria-selected={tab === "sale"} onClick={() => setTab("sale")}>
              For sale<em>{forSale.length}</em>
            </button>
            <button type="button" className="sh-ft" role="tab" aria-selected={tab === "expired"} onClick={() => setTab("expired")}>
              Expired<em>{expired.length}</em>
            </button>
            <button type="button" className="sh-ft" role="tab" aria-selected={tab === "sold"} onClick={() => setTab("sold")}>
              Sold<em>{sold.length}</em>
            </button>
            <button
              type="button"
              className="sh-ft"
              role="tab"
              aria-selected={tab === "purchases"}
              onClick={() => setTab("purchases")}
            >
              Purchases<em>{purchases.length}</em>
            </button>
          </div>

          <div className="sh-fpage mk-mine">
            <div className="mk-tools">
              <select aria-label="Show" value={show} onChange={(e) => setShow(e.target.value as ShowFilter)}>
                <option value="">Items and pets</option>
                <option value="item">Items only</option>
                <option value="pet">Pets only</option>
              </select>
            </div>

            {tab === "sale" ? (
              <div className="mk-pane" id="mk-sale">
                {saleRows.length === 0 ? (
                  <p className="mk-empty">
                    Nothing for sale right now.{" "}
                    <Link className="lnk" href="/marketplace/sell">
                      Sell something
                    </Link>
                  </p>
                ) : (
                  <ul className="mk-lines">
                    {saleRows.map((l) => {
                      const exp = endsIn(l.expires_at);
                      return (
                        <li className="mk-line" key={l.id}>
                          <ListingIcon listing={l} />
                          <span className="mk-nm">
                            {name(l)}
                            <small>{meta(l)}</small>
                          </span>
                          <p className="mk-when">
                            Listed {ago(l.created_at)}
                            <span className={`mk-exp${exp.soon ? " soon" : ""}`}>{exp.label}</span>
                          </p>
                          <span className="mk-pp">
                            <PriceTag coins={l.price_coins} gems={l.price_gems} />
                          </span>
                          <button type="button" className="btn btn-sm btn-cream" onClick={() => openCancel(l)}>
                            Take down
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ) : null}

            {tab === "expired" ? (
              <div className="mk-pane" id="mk-expired">
                <p className="mk-earn">Listings stay up for 7 days. These didn&apos;t sell, so they went back to you.</p>
                {expiredRows.length === 0 ? (
                  <p className="mk-empty">Nothing has expired.</p>
                ) : (
                  <ul className="mk-lines">
                    {expiredRows.map((l) => (
                      <li className="mk-line" key={l.id}>
                        <ListingIcon listing={l} />
                        <span className="mk-nm">
                          {name(l)}
                          <small>{meta(l)}</small>
                        </span>
                        <p className="mk-when">
                          {l.status === "cancelled" ? "Taken down" : "Expired"} {ago(l.expires_at)}
                          <span className="mk-exp">Back in your {kindOf(l) === "pet" ? "pets" : "items"}</span>
                        </p>
                        <span className="mk-pp">
                          <PriceTag coins={l.price_coins} gems={l.price_gems} />
                        </span>
                        <Link
                          className="btn btn-sm btn-cream"
                          href={kindOf(l) === "pet" ? `/marketplace/sell?pet=${l.pet_id}` : `/marketplace/sell?item=${l.itemId}`}
                        >
                          List again
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}

            {tab === "sold" ? (
              <div className="mk-pane" id="mk-sold">
                <p className="mk-earn">
                  Earned from your sales:{" "}
                  <b>
                    <span className="coin" aria-hidden="true" />
                    {earnedCoins}
                  </b>{" "}
                  <b>
                    <span className="coin gem" aria-hidden="true" />
                    {earnedGems}
                  </b>{" "}
                  <span>Already paid to you when each one sold.</span>
                </p>
                {soldRows.length === 0 ? (
                  <p className="mk-empty">Nothing has sold yet.</p>
                ) : (
                  <ul className="mk-lines">
                    {soldRows.map((l) => (
                      <li className="mk-line" key={l.id}>
                        <ListingIcon listing={l} />
                        <span className="mk-nm">
                          {name(l)}
                          <small>{meta(l)}</small>
                        </span>
                        <p className="mk-when">
                          Sold to{" "}
                          <Link className="lnk" href={`/u/${l.buyerDisplayId}`}>
                            {l.buyerName}
                          </Link>
                          , {ago(l.sold_at ?? l.created_at)}
                        </p>
                        <span className="mk-pp">
                          <PriceTag coins={l.price_coins} gems={l.price_gems} />
                        </span>
                        <span className="tag green">Paid out</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}

            {tab === "purchases" ? (
              <div className="mk-pane" id="mk-purchases">
                {purchaseRows.length === 0 ? (
                  <p className="mk-empty">
                    You haven&apos;t bought anything yet.{" "}
                    <Link className="lnk" href="/marketplace">
                      Browse the Marketplace
                    </Link>
                  </p>
                ) : (
                  <ul className="mk-lines">
                    {purchaseRows.map((l) => (
                      <li className="mk-line" key={l.id}>
                        <ListingIcon listing={l} />
                        <span className="mk-nm">
                          {name(l)}
                          <small>{meta(l)}</small>
                        </span>
                        <p className="mk-when">
                          Bought from{" "}
                          <Link className="lnk" href={`/u/${l.sellerDisplayId}`}>
                            {l.sellerName}
                          </Link>
                          , {ago(l.sold_at ?? l.created_at)}
                        </p>
                        <span className="mk-pp">
                          <PriceTag coins={l.price_coins} gems={l.price_gems} />
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <dialog className="fg mk-dlg" ref={dialogRef} aria-labelledby="mk-dlg-t">
        <form method="dialog">
          <h2 className="frame-title">
            <span id="mk-dlg-t">Take it down?</span>
          </h2>
          <div className="mk-db">
            <div className="mk-dhead">
              <span className="mk-dpic">
                {cancelTarget && imageUrl(cancelTarget) ? (
                  // eslint-disable-next-line @next/next/no-img-element -- see list icon above
                  <img src={imageUrl(cancelTarget) ?? ""} alt="" />
                ) : null}
              </span>
              <div>
                <span className="mk-dname">{cancelTarget ? name(cancelTarget) : ""}</span>
                <span className="mk-dmeta">
                  It goes back to <span>{cancelTarget && kindOf(cancelTarget) === "pet" ? "your pets" : "your items"}</span>.
                </span>
              </div>
            </div>
          </div>
          <div className="mk-foot">
            <button type="submit" className="btn btn-cream" value="cancel" formNoValidate>
              Keep it listed
            </button>
            <button type="button" className="btn btn-orange" disabled={isCancelling} onClick={confirmCancel}>
              {isCancelling ? "Taking down…" : "Take it down"}
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
    </main>
  );
}
