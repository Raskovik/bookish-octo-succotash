"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { ShopListingWithTarget, ShopSection } from "@/lib/supabase/types";

const SECTION_ORDER: ShopSection[] = ["pets", "food", "den", "specials"];

const SECTION_META: Record<ShopSection, { title: string; icon: string; blurb: string }> = {
  pets: { title: "Pets", icon: "var(--ic-paw)", blurb: "Meet your next friend." },
  food: { title: "Food", icon: "var(--ic-bag)", blurb: "Keep your pets full and happy." },
  den: { title: "Den", icon: "var(--ic-star)", blurb: "More room for more pets." },
  specials: { title: "Specials", icon: "var(--ic-diamond)", blurb: "Rare and seasonal finds." },
};

// The handoff's own .sh-ic-bag/.sh-ic-star color variants, applied to
// whichever section's fallback tile (no art uploaded yet) is shown —
// pets/specials fall back to the base .sh-ic gold tone, same as the
// reference markup's "special" items (no .sh-ic-diamond color variant
// exists in the CSS either, so that one's just the plain gold tile).
const SECTION_FALLBACK_CLASS: Record<ShopSection, string> = {
  pets: "",
  food: "sh-ic-bag",
  den: "sh-ic-star",
  specials: "",
};

type Currency = "coin" | "gem";

function affordabilityNote(listing: ShopListingWithTarget, coinBalance: number, gemBalance: number): string | null {
  const coinOk = listing.price_coins !== null && coinBalance >= listing.price_coins;
  const gemOk = listing.price_gems !== null && gemBalance >= listing.price_gems;
  if (coinOk || gemOk) return null;

  if (listing.price_coins !== null && listing.price_gems === null) {
    return `Need ${listing.price_coins - coinBalance} coins more`;
  }
  if (listing.price_gems !== null && listing.price_coins === null) {
    return `Need ${listing.price_gems - gemBalance} gems more`;
  }
  return "Not enough coins or gems";
}

export function ShopFolder({
  userId,
  coinBalance,
  gemBalance,
  sections,
}: {
  userId: string;
  coinBalance: number;
  gemBalance: number;
  sections: Record<ShopSection, ShopListingWithTarget[]>;
}) {
  const router = useRouter();
  const firstNonEmpty = SECTION_ORDER.find((s) => sections[s].length > 0) ?? "pets";
  const [activeSection, setActiveSection] = useState<ShopSection>(firstNonEmpty);

  const dialogRef = useRef<HTMLDialogElement>(null);
  const [activeListing, setActiveListing] = useState<ShopListingWithTarget | null>(null);
  const [isBuying, setIsBuying] = useState(false);

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastClosing, setToastClosing] = useState(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function toast(msg: string) {
    setToastMsg(msg);
    setToastClosing(false);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToastClosing(true);
      toastTimerRef.current = setTimeout(() => {
        setToastClosing(false);
        setToastMsg(null);
      }, 400);
    }, 2800);
  }

  function openBuyDialog(listing: ShopListingWithTarget) {
    setActiveListing(listing);
    dialogRef.current?.showModal();
  }

  async function handleBuy(currency: Currency) {
    if (!activeListing) return;
    setIsBuying(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("buy_shop_listing", {
      p_user_id: userId,
      p_listing_id: activeListing.id,
      p_currency: currency,
    });
    setIsBuying(false);

    if (error) {
      toast(error.message);
      return;
    }

    dialogRef.current?.close();
    toast(activeListing.listing_type === "pet" ? `${activeListing.name} joined your den!` : `Bought ${activeListing.name}!`);
    router.refresh();
  }

  return (
    <>
      <section className="col sh-shops sh-folderframe" aria-label="Shops">
        <div className="sh-folder">
          <div className="sh-ftabs" role="tablist" aria-label="Shop sections">
            {SECTION_ORDER.map((section) => (
              <button
                key={section}
                type="button"
                role="tab"
                aria-selected={activeSection === section}
                onClick={() => setActiveSection(section)}
                className="sh-ft"
              >
                <span className="sh-ti" style={{ "--ic": SECTION_META[section].icon } as React.CSSProperties} />
                {SECTION_META[section].title}
              </button>
            ))}
          </div>
          <div className="sh-fpage">
            <p className="sh-blurb">{SECTION_META[activeSection].blurb}</p>
            <div role="tabpanel">
              {sections[activeSection].length === 0 ? (
                <p style={{ margin: 0 }}>Nothing here right now — check back soon.</p>
              ) : (
                <ul className="sh-grid">
                  {sections[activeSection].map((listing) => {
                    const note = affordabilityNote(listing, coinBalance, gemBalance);
                    const coinOk = listing.price_coins !== null && coinBalance >= listing.price_coins;
                    const gemOk = listing.price_gems !== null && gemBalance >= listing.price_gems;
                    const expiresSoon = listing.ends_at !== null;
                    return (
                      <li className="sh-item" key={listing.id}>
                        <div
                          className={`sh-pic${listing.imageUrl ? "" : ` sh-ic ${SECTION_FALLBACK_CLASS[activeSection]}`}`}
                          style={listing.imageUrl ? undefined : ({ "--ic": SECTION_META[activeSection].icon } as React.CSSProperties)}
                        >
                          {listing.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element -- unsized, object-fit: contain per .sh-pic img, same as the design's own <img>
                            <img src={listing.imageUrl} alt="" />
                          ) : null}
                        </div>
                        {expiresSoon ? <span className="tag">Limited</span> : listing.is_new ? <span className="tag green">New</span> : null}
                        <div className="sh-info">
                          <h3 className="sh-name">{listing.name}</h3>
                          {listing.description ? <p className="sh-desc">{listing.description}</p> : null}
                        </div>
                        <div className="sh-buyrow">
                          <div className="sh-cost">
                            {listing.price_coins !== null ? (
                              <span className={`sh-c${coinOk ? "" : " short"}`}>
                                <span className="coin" aria-hidden="true" />
                                <b>{listing.price_coins}</b>
                                <span className="sr">coins</span>
                              </span>
                            ) : null}
                            {listing.price_coins !== null && listing.price_gems !== null ? (
                              <span className="sh-or">or</span>
                            ) : null}
                            {listing.price_gems !== null ? (
                              <span className={`sh-c${gemOk ? "" : " short"}`}>
                                <span className="coin gem" aria-hidden="true" />
                                <b>{listing.price_gems}</b>
                                <span className="sr">gems</span>
                              </span>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            className="btn btn-sm btn-leaf sh-buybtn"
                            disabled={!coinOk && !gemOk}
                            onClick={() => openBuyDialog(listing)}
                          >
                            Buy
                          </button>
                        </div>
                        {note ? <p className="sh-note">{note}</p> : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      </section>

      <dialog className="fg" ref={dialogRef} aria-labelledby="sh-dt">
        <form method="dialog">
          <h2 className="frame-title" id="sh-dt">
            <span>Buy {activeListing?.name}?</span>
          </h2>
          <div className="fg-body sh-d2">
            <div className="sh-dpic">
              <div
                className={`sh-pic${activeListing?.imageUrl ? "" : ` sh-ic ${SECTION_FALLBACK_CLASS[activeListing?.section ?? "pets"]}`}`}
                style={
                  activeListing?.imageUrl
                    ? undefined
                    : ({ "--ic": SECTION_META[activeListing?.section ?? "pets"].icon } as React.CSSProperties)
                }
              >
                {activeListing?.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- see the card picture above
                  <img src={activeListing.imageUrl} alt="" />
                ) : null}
              </div>
            </div>
            {activeListing?.description ? <p className="sh-ddesc">{activeListing.description}</p> : null}
            <p className="sh-dlab">Pay with</p>
            <div className="sh-paybtns">
              {activeListing && activeListing.price_coins !== null ? (
                <PayButton
                  currency="coin"
                  price={activeListing.price_coins}
                  balance={coinBalance}
                  disabled={isBuying}
                  onPay={() => handleBuy("coin")}
                />
              ) : null}
              {activeListing && activeListing.price_gems !== null ? (
                <PayButton
                  currency="gem"
                  price={activeListing.price_gems}
                  balance={gemBalance}
                  disabled={isBuying}
                  onPay={() => handleBuy("gem")}
                />
              ) : null}
            </div>
          </div>
          <div className="sh-dfoot">
            <button type="button" className="sh-cancel" onClick={() => dialogRef.current?.close()}>
              Cancel
            </button>
          </div>
        </form>
      </dialog>

      {typeof document !== "undefined"
        ? createPortal(
            <div
              className={`pets-toast${toastClosing ? " pets-toast-closing" : ""}`}
              role="status"
              aria-live="polite"
              hidden={!toastMsg}
              onAnimationEnd={() => {
                if (!toastClosing) return;
                if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
                setToastClosing(false);
                setToastMsg(null);
              }}
            >
              <span>{toastMsg}</span>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function PayButton({
  currency,
  price,
  balance,
  disabled,
  onPay,
}: {
  currency: Currency;
  price: number;
  balance: number;
  disabled: boolean;
  onPay: () => void;
}) {
  const canAfford = balance >= price;
  return (
    <div className="sh-pw">
      <button type="button" className="btn btn-leaf" disabled={disabled || !canAfford} onClick={onPay}>
        <span className={currency === "gem" ? "coin gem" : "coin"} aria-hidden="true" />
        {price}
      </button>
      <small className={canAfford ? undefined : "short"}>
        {canAfford ? `you have ${balance}` : `need ${price - balance} more`}
      </small>
    </div>
  );
}
