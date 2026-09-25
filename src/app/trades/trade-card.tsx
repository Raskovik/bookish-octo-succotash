import Image from "next/image";
import Link from "next/link";
import { CurrencyIcon } from "@/components/currency-icon";
import type { TradeWithParticipants } from "@/lib/supabase/types";

const STATUS_STYLES: Record<TradeWithParticipants["status"], string> = {
  pending: "bg-green-200 text-green-900 dark:bg-green-900 dark:text-green-100",
  completed: "bg-green-200 text-green-900 dark:bg-green-900 dark:text-green-100",
  declined: "bg-red-200 text-red-900 dark:bg-red-900 dark:text-red-100",
  cancelled: "bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300",
};

function OfferPreview({ trade, side }: { trade: TradeWithParticipants; side: "initiator" | "recipient" }) {
  const pets = trade.pets.filter((p) => p.side === side);
  const items = trade.items.filter((i) => i.side === side);
  const coins = side === "initiator" ? trade.initiator_coins : trade.recipient_coins;
  const gems = side === "initiator" ? trade.initiator_gems : trade.recipient_gems;

  const thumbnails = [
    ...pets.map((p) => ({ key: `pet-${p.petId}`, imageUrl: p.imageUrl, border: "border-blue-600" })),
    ...items.map((i) => ({ key: `item-${i.itemId}`, imageUrl: i.imageUrl, border: "border-green-600" })),
  ];

  if (thumbnails.length === 0 && coins === 0 && gems === 0) {
    return <span className="text-xs italic text-stone-500">Nothing yet</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {thumbnails.slice(0, 4).map((t) =>
        t.imageUrl ? (
          <Image
            key={t.key}
            src={t.imageUrl}
            alt=""
            width={32}
            height={32}
            className={`h-8 w-8 rounded border-2 ${t.border}`}
          />
        ) : (
          <div key={t.key} className={`h-8 w-8 rounded border-2 bg-green-200 dark:bg-stone-800 ${t.border}`} />
        ),
      )}
      {thumbnails.length > 4 ? (
        <span className="text-xs text-stone-500">+{thumbnails.length - 4}</span>
      ) : null}
      {coins > 0 ? (
        <span className="text-xs">
          <CurrencyIcon kind="coin" />
          {coins}
        </span>
      ) : null}
      {gems > 0 ? (
        <span className="text-xs">
          <CurrencyIcon kind="gem" />
          {gems}
        </span>
      ) : null}
    </div>
  );
}

export function TradeCard({
  trade,
  viewerId,
}: {
  trade: TradeWithParticipants;
  viewerId: string;
}) {
  const isInitiator = trade.initiatorId === viewerId;
  const counterpartName = isInitiator ? trade.recipientName : trade.initiatorName;

  return (
    <Link
      href={`/trades/${trade.id}`}
      className="flex flex-col gap-2 rounded-lg border border-green-200 p-3 hover:bg-green-50 dark:border-stone-800 dark:hover:bg-stone-900"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">
          {isInitiator ? `To ${counterpartName}` : `From ${counterpartName}`}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[trade.status]}`}
        >
          {trade.status}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-stone-500">Offering</span>
          <OfferPreview trade={trade} side="initiator" />
        </div>
        <span className="text-stone-400">→</span>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-stone-500">For</span>
          <OfferPreview trade={trade} side="recipient" />
        </div>
      </div>

      {trade.note ? <p className="text-xs italic text-stone-500">&ldquo;{trade.note}&rdquo;</p> : null}
    </Link>
  );
}
