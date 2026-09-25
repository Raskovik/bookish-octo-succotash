import { CurrencyIcon } from "@/components/currency-icon";

// Shared by the marketplace browse list and listing cards — a listing
// can be priced in coins, gems, or both.
export function PriceLabel({
  priceCoins,
  priceGems,
}: {
  priceCoins: number | null;
  priceGems: number | null;
}) {
  if (priceCoins === null && priceGems === null) return null;
  return (
    <>
      {priceCoins !== null ? (
        <>
          <CurrencyIcon kind="coin" /> {priceCoins}
        </>
      ) : null}
      {priceCoins !== null && priceGems !== null ? " or " : null}
      {priceGems !== null ? (
        <>
          <CurrencyIcon kind="gem" /> {priceGems}
        </>
      ) : null}
    </>
  );
}
