import Image from "next/image";
import { CurrencyIcon } from "@/components/currency-icon";
import type { TradeWithParticipants } from "@/lib/supabase/types";

export function TradeSideSummary({
  trade,
  side,
  heading,
}: {
  trade: TradeWithParticipants;
  side: "initiator" | "recipient";
  heading: string;
}) {
  const pets = trade.pets.filter((p) => p.side === side);
  const items = trade.items.filter((i) => i.side === side);
  const coins = side === "initiator" ? trade.initiator_coins : trade.recipient_coins;
  const gems = side === "initiator" ? trade.initiator_gems : trade.recipient_gems;
  const isEmpty = pets.length === 0 && items.length === 0 && coins === 0 && gems === 0;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-green-200 p-4 dark:border-stone-800">
      <h3 className="text-sm font-semibold">{heading}</h3>

      {isEmpty ? (
        <p className="text-sm italic text-stone-500">Nothing offered.</p>
      ) : (
        <>
          {pets.length > 0 ? (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {pets.map((pet) => (
                <li key={pet.petId} className="flex flex-col items-center gap-1 text-center">
                  {pet.imageUrl ? (
                    <Image
                      src={pet.imageUrl}
                      alt={pet.speciesName}
                      width={64}
                      height={64}
                      className="h-16 w-16 rounded border-2 border-blue-600"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded bg-green-200 dark:bg-stone-800" />
                  )}
                  <span className="text-xs">{pet.customName ?? pet.speciesName}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {items.length > 0 ? (
            <ul className="flex flex-col gap-1.5">
              {items.map((item) => (
                <li key={item.itemId} className="flex items-center gap-2">
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt={item.name}
                      width={32}
                      height={32}
                      className="h-8 w-8 rounded border-2 border-green-600"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded bg-green-200 dark:bg-stone-800" />
                  )}
                  <span className="text-sm">
                    {item.name} × {item.quantity}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          {coins > 0 || gems > 0 ? (
            <div className="flex gap-3 text-sm">
              {coins > 0 ? (
                <span>
                  <CurrencyIcon kind="coin" /> {coins}
                </span>
              ) : null}
              {gems > 0 ? (
                <span>
                  <CurrencyIcon kind="gem" /> {gems}
                </span>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
