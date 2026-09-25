import Image from "next/image";
import { CURRENCY, type CurrencyKind } from "@/config";

// Renders CURRENCY[kind].image if one is set in config.ts, otherwise
// falls back to the emoji. Every coin/gem display in the app goes
// through this, so setting an image path in one place swaps the icon
// everywhere at once.
export function CurrencyIcon({
  kind,
  size = 16,
  className,
}: {
  kind: CurrencyKind;
  size?: number;
  className?: string;
}) {
  const currency = CURRENCY[kind];

  if (currency.image) {
    return (
      <Image
        src={currency.image}
        alt={currency.label}
        width={size}
        height={size}
        className={`inline-block align-[-0.2em] ${className ?? ""}`}
      />
    );
  }

  return (
    <span aria-hidden className={className}>
      {currency.emoji}
    </span>
  );
}
