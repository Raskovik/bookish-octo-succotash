"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type PetTier = "" | "pt-silver" | "pt-gold" | "pt-diamond";

type PetOption = {
  id: string;
  name: string;
  speciesName: string;
  imageUrl: string | null;
  strength: number;
  speed: number;
  defence: number;
  strTier: PetTier;
  spdTier: PetTier;
  defTier: PetTier;
  unavailableReason: string | null;
};

type ItemOption = {
  id: string;
  name: string;
  imageUrl: string | null;
  category: string;
  quantity: number;
};

const CATEGORY_LABEL: Record<string, string> = {
  ingredient: "Ingredients",
  cosmetic: "Cosmetics",
  potion: "Potions",
  seed: "Seeds",
  fertilizer: "Fertilizer",
};

type Currency = "coin" | "gem" | "both";

function StatPlaques({ pet }: { pet: PetOption }) {
  return (
    <div className="mk-st">
      <div className={`pt-tier ${pet.strTier}`}>
        <div className="pt-p">
          <i />
          <small>STR</small>
          <b>{pet.strength}</b>
        </div>
      </div>
      <div className={`pt-tier ${pet.spdTier}`}>
        <div className="pt-p">
          <i />
          <small>SPD</small>
          <b>{pet.speed}</b>
        </div>
      </div>
      <div className={`pt-tier ${pet.defTier}`}>
        <div className="pt-p">
          <i />
          <small>DEF</small>
          <b>{pet.defence}</b>
        </div>
      </div>
    </div>
  );
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function SellForm({
  userId,
  petOptions,
  itemOptions,
  preselectItemId,
  preselectPetId,
  relistListingId,
}: {
  userId: string;
  petOptions: PetOption[];
  itemOptions: ItemOption[];
  preselectItemId: string | null;
  preselectPetId: string | null;
  relistListingId: string | null;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"items" | "pets">(preselectPetId ? "pets" : "items");

  const [selectedItemId, setSelectedItemId] = useState<string | null>(
    preselectItemId && itemOptions.some((i) => i.id === preselectItemId) ? preselectItemId : null,
  );
  const [selectedPetId, setSelectedPetId] = useState<string | null>(
    preselectPetId && petOptions.some((p) => p.id === preselectPetId && !p.unavailableReason) ? preselectPetId : null,
  );
  const [size, setSize] = useState(1);
  const [itemCurrency, setItemCurrency] = useState<Currency>("coin");
  const [itemCoin, setItemCoin] = useState("");
  const [itemGem, setItemGem] = useState("");
  const [petCurrency, setPetCurrency] = useState<Currency>("coin");
  const [petCoin, setPetCoin] = useState("");
  const [petGem, setPetGem] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedItem = selectedItemId ? itemOptions.find((i) => i.id === selectedItemId) ?? null : null;
  const selectedPet = selectedPetId ? petOptions.find((p) => p.id === selectedPetId) ?? null : null;

  function pickItem(item: ItemOption) {
    setError(null);
    setSelectedItemId(item.id);
    setSize(1);
    setItemCoin("");
    setItemGem("");
  }

  function pickPet(pet: PetOption) {
    setError(null);
    setSelectedPetId(pet.id);
    setPetCoin("");
    setPetGem("");
  }

  const itemCols = useMemo(
    () => (itemCurrency === "both" ? (["coin", "gem"] as const) : ([itemCurrency] as const)),
    [itemCurrency],
  );
  const itemCoinNum = Math.floor(Number(itemCoin));
  const itemGemNum = Math.floor(Number(itemGem));
  const itemCoinValid = itemCoinNum >= 1 && itemCoinNum <= 1000000;
  const itemGemValid = itemGemNum >= 1 && itemGemNum <= 1000000;
  const itemValid = itemCols.every((c) => (c === "coin" ? itemCoinValid : itemGemValid));
  const itemBad = itemCols.some((c) => (c === "coin" ? itemCoin !== "" && !itemCoinValid : itemGem !== "" && !itemGemValid));
  const itemEach = useMemo(() => {
    if (!itemValid || size <= 1) return null;
    return itemCols.map((c) => `${round2((c === "coin" ? itemCoinNum : itemGemNum) / size)} ${c === "gem" ? "gems" : "coins"}`).join(" or ");
  }, [itemValid, size, itemCols, itemCoinNum, itemGemNum]);

  const petCols = petCurrency === "both" ? (["coin", "gem"] as const) : ([petCurrency] as const);
  const petCoinNum = Math.floor(Number(petCoin));
  const petGemNum = Math.floor(Number(petGem));
  const petCoinValid = petCoinNum >= 1 && petCoinNum <= 1000000;
  const petGemValid = petGemNum >= 1 && petGemNum <= 1000000;
  const petValid = petCols.every((c) => (c === "coin" ? petCoinValid : petGemValid));
  const petBad = petCols.some((c) => (c === "coin" ? petCoin !== "" && !petCoinValid : petGem !== "" && !petGemValid));

  // Best-effort: the new listing is already live either way, so a
  // dismiss failure (stale relist id, already cleared, etc.) shouldn't
  // block the player from moving on.
  async function dismissRelisted() {
    if (!relistListingId) return;
    const supabase = createClient();
    await supabase.rpc("dismiss_listing", { p_user_id: userId, p_listing_id: relistListingId });
  }

  async function submitItem() {
    if (!selectedItem || !itemValid) return;
    setError(null);
    setIsPending(true);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("create_item_listing", {
      p_seller_id: userId,
      p_item_id: selectedItem.id,
      p_quantity: size,
      p_price_coins: itemCols.includes("coin") ? itemCoinNum : null,
      p_price_gems: itemCols.includes("gem") ? itemGemNum : null,
    });
    if (rpcError) {
      setIsPending(false);
      setError(rpcError.message);
      return;
    }
    await dismissRelisted();
    setIsPending(false);
    router.push("/marketplace/listings");
  }

  async function submitPet() {
    if (!selectedPet || !petValid) return;
    setError(null);
    setIsPending(true);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("create_pet_listing", {
      p_seller_id: userId,
      p_pet_id: selectedPet.id,
      p_price_coins: petCols.includes("coin") ? petCoinNum : null,
      p_price_gems: petCols.includes("gem") ? petGemNum : null,
    });
    if (rpcError) {
      setIsPending(false);
      setError(rpcError.message);
      return;
    }
    await dismissRelisted();
    setIsPending(false);
    router.push("/marketplace/listings");
  }

  return (
    <>
      <div className="sh-ftabs mk-tabs" role="tablist" aria-label="What to sell">
        <button type="button" className="sh-ft" role="tab" aria-selected={tab === "items"} onClick={() => setTab("items")}>
          Items<em>{itemOptions.length}</em>
        </button>
        <button type="button" className="sh-ft" role="tab" aria-selected={tab === "pets"} onClick={() => setTab("pets")}>
          Pets<em>{petOptions.length}</em>
        </button>
      </div>

      <div className="sh-fpage">
        {tab === "items" ? (
          <div className="mk-pane" id="mk-items">
            <div className="mk-sell">
              <div>
                <p className="mk-lab">Pick an item</p>
                {itemOptions.length === 0 ? (
                  <p className="mk-none">You don&apos;t have any items.</p>
                ) : (
                  <ul className="mk-slots">
                    {itemOptions.map((item) => (
                      <li className="mk-slotli" key={item.id}>
                        <button
                          type="button"
                          className="mk-slot"
                          aria-pressed={selectedItemId === item.id}
                          aria-label={`${item.name}, you have ${item.quantity}`}
                          onClick={() => pickItem(item)}
                        >
                          {item.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element -- unsized catalog art, object-fit: contain per .mk-slot img
                            <img src={item.imageUrl} alt="" />
                          ) : (
                            <span className="iv-ph bag blue" />
                          )}
                          {item.quantity > 1 ? (
                            <span className="mk-qty" aria-hidden="true">
                              &times;{item.quantity}
                            </span>
                          ) : null}
                        </button>
                        <span className="mk-sn">{item.name}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                {!selectedItem ? (
                  <p className="mk-none">Pick an item to set a price.</p>
                ) : (
                  <form
                    className="mk-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      submitItem();
                    }}
                  >
                    <div className="mk-dhead">
                      <span className="mk-dpic">
                        {selectedItem.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- see slot picture above
                          <img src={selectedItem.imageUrl} alt="" />
                        ) : null}
                      </span>
                      <div>
                        <span className="mk-dname">{selectedItem.name}</span>
                        <span className="mk-dmeta">
                          You have {selectedItem.quantity}. {CATEGORY_LABEL[selectedItem.category] ?? selectedItem.category}
                        </span>
                      </div>
                    </div>

                    <div className="mk-field">
                      <span className="mk-sl" id="i-sl">
                        How many to list?
                      </span>
                      <div className="mk-sc">
                        <button
                          type="button"
                          className="btn btn-sm btn-cream btn-round"
                          aria-label="One fewer"
                          onClick={() => setSize((s) => Math.max(1, s - 1))}
                        >
                          &minus;
                        </button>
                        <input
                          type="number"
                          min={1}
                          max={selectedItem.quantity}
                          value={size}
                          aria-labelledby="i-sl"
                          onChange={(e) =>
                            setSize(Math.max(1, Math.min(selectedItem.quantity, Math.floor(Number(e.target.value)) || 1)))
                          }
                        />
                        <button
                          type="button"
                          className="btn btn-sm btn-cream btn-round"
                          aria-label="One more"
                          onClick={() => setSize((s) => Math.min(selectedItem.quantity, s + 1))}
                        >
                          +
                        </button>
                        <button type="button" className="btn btn-sm btn-cream" onClick={() => setSize(selectedItem.quantity)}>
                          All
                        </button>
                      </div>
                    </div>

                    <fieldset className="mk-seg mk-seg3">
                      <legend className="sr">Buyers pay in</legend>
                      <label>
                        <input
                          type="radio"
                          checked={itemCurrency === "coin"}
                          onChange={() => setItemCurrency("coin")}
                        />
                        <span className="coin" aria-hidden="true" /> Coins
                      </label>
                      <label>
                        <input type="radio" checked={itemCurrency === "gem"} onChange={() => setItemCurrency("gem")} />
                        <span className="coin gem" aria-hidden="true" /> Gems
                      </label>
                      <label>
                        <input type="radio" checked={itemCurrency === "both"} onChange={() => setItemCurrency("both")} />
                        Both
                      </label>
                    </fieldset>
                    {itemCurrency === "both" ? <p className="mk-hint">Buyers pick one of the two to pay with.</p> : null}

                    {itemCols.includes("coin") ? (
                      <div className="mk-field">
                        <span className="mk-sl" id="i-coinl">
                          Price in coins{size > 1 ? ` for all ${size}` : ""}
                        </span>
                        <div className="mk-money">
                          <span className="coin" aria-hidden="true" />
                          <input
                            type="number"
                            min={1}
                            max={1000000}
                            value={itemCoin}
                            placeholder="0"
                            aria-labelledby="i-coinl"
                            onChange={(e) => setItemCoin(e.target.value)}
                          />
                        </div>
                      </div>
                    ) : null}
                    {itemCols.includes("gem") ? (
                      <div className="mk-field">
                        <span className="mk-sl" id="i-geml">
                          Price in gems{size > 1 ? ` for all ${size}` : ""}
                        </span>
                        <div className="mk-money">
                          <span className="coin gem" aria-hidden="true" />
                          <input
                            type="number"
                            min={1}
                            max={1000000}
                            value={itemGem}
                            placeholder="0"
                            aria-labelledby="i-geml"
                            onChange={(e) => setItemGem(e.target.value)}
                          />
                        </div>
                      </div>
                    ) : null}

                    <dl className="mk-sum">
                      {itemEach ? (
                        <div>
                          <dt>Works out to</dt>
                          <dd>{itemEach} each</dd>
                        </div>
                      ) : null}
                      <div className="mk-big">
                        <dt>You get when it sells</dt>
                        <dd>
                          {itemValid
                            ? itemCols
                                .map((c) => `${c === "coin" ? itemCoinNum : itemGemNum} ${c === "gem" ? "gems" : "coins"}`)
                                .join(" or ")
                            : "—"}
                        </dd>
                      </div>
                    </dl>
                    <p className="mk-warn">{itemBad ? "Pick a price from 1 to 1,000,000." : ""}</p>
                    <p className="mk-hint">Listings stay up for 7 days. If it doesn&apos;t sell, it comes back to you.</p>
                    {error ? <p className="mk-warn">{error}</p> : null}
                    <button type="submit" className="btn btn-leaf" disabled={!itemValid || isPending}>
                      {isPending ? "Listing…" : "List for sale"}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="mk-pane" id="mk-pets">
            <div className="mk-sell">
              <div>
                <p className="mk-lab">Pick a pet</p>
                {petOptions.length === 0 ? (
                  <p className="mk-none">You don&apos;t have any pets.</p>
                ) : (
                  <ul className="mk-mypets">
                    {petOptions.map((pet) => (
                      <li key={pet.id}>
                        <button
                          type="button"
                          className="mk-mp"
                          aria-pressed={selectedPetId === pet.id}
                          disabled={Boolean(pet.unavailableReason)}
                          onClick={() => pickPet(pet)}
                        >
                          {pet.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element -- unsized catalog art, object-fit: contain per .mk-mp img
                            <img src={pet.imageUrl} alt="" />
                          ) : null}
                          {pet.name}
                          <small>{pet.unavailableReason ?? pet.speciesName}</small>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                {!selectedPet ? (
                  <p className="mk-none">Pick a pet to set a price.</p>
                ) : (
                  <form
                    className="mk-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      submitPet();
                    }}
                  >
                    <div className="mk-dhead">
                      <span className="mk-dpic">
                        {selectedPet.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- see slot picture above
                          <img src={selectedPet.imageUrl} alt="" />
                        ) : null}
                      </span>
                      <div>
                        <span className="mk-dname">{selectedPet.name}</span>
                        <span className="mk-dmeta">{selectedPet.speciesName}</span>
                      </div>
                    </div>
                    <StatPlaques pet={selectedPet} />

                    <fieldset className="mk-seg mk-seg3">
                      <legend className="sr">Buyers pay in</legend>
                      <label>
                        <input type="radio" checked={petCurrency === "coin"} onChange={() => setPetCurrency("coin")} />
                        <span className="coin" aria-hidden="true" /> Coins
                      </label>
                      <label>
                        <input type="radio" checked={petCurrency === "gem"} onChange={() => setPetCurrency("gem")} />
                        <span className="coin gem" aria-hidden="true" /> Gems
                      </label>
                      <label>
                        <input type="radio" checked={petCurrency === "both"} onChange={() => setPetCurrency("both")} />
                        Both
                      </label>
                    </fieldset>
                    {petCurrency === "both" ? <p className="mk-hint">Buyers pick one of the two to pay with.</p> : null}

                    {petCols.includes("coin") ? (
                      <div className="mk-field">
                        <span className="mk-sl" id="p-coinl">
                          Price in coins
                        </span>
                        <div className="mk-money">
                          <span className="coin" aria-hidden="true" />
                          <input
                            type="number"
                            min={1}
                            max={1000000}
                            value={petCoin}
                            placeholder="0"
                            aria-labelledby="p-coinl"
                            onChange={(e) => setPetCoin(e.target.value)}
                          />
                        </div>
                      </div>
                    ) : null}
                    {petCols.includes("gem") ? (
                      <div className="mk-field">
                        <span className="mk-sl" id="p-geml">
                          Price in gems
                        </span>
                        <div className="mk-money">
                          <span className="coin gem" aria-hidden="true" />
                          <input
                            type="number"
                            min={1}
                            max={1000000}
                            value={petGem}
                            placeholder="0"
                            aria-labelledby="p-geml"
                            onChange={(e) => setPetGem(e.target.value)}
                          />
                        </div>
                      </div>
                    ) : null}

                    <dl className="mk-sum">
                      <div className="mk-big">
                        <dt>You get when it sells</dt>
                        <dd>
                          {petValid
                            ? petCols
                                .map((c) => `${c === "coin" ? petCoinNum : petGemNum} ${c === "gem" ? "gems" : "coins"}`)
                                .join(" or ")
                            : "—"}
                        </dd>
                      </div>
                    </dl>
                    <p className="mk-warn">{petBad ? "Pick a price from 1 to 1,000,000." : ""}</p>
                    <p className="mk-hint">
                      A pet for sale can&apos;t go exploring. It stays up for 7 days, and you can take it off the
                      Marketplace any time before it sells. If it doesn&apos;t sell, it comes back to you.
                    </p>
                    {error ? <p className="mk-warn">{error}</p> : null}
                    <button type="submit" className="btn btn-leaf" disabled={!petValid || isPending}>
                      {isPending ? "Listing…" : "List this pet"}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
