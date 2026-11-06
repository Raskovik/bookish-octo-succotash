"use client";

import { useId, useState } from "react";

export type DailyResults = {
  date: string; // YYYY-MM-DD
  trips: number;
  items: number;
  friends: number;
  coins: number;
  xp: number;
};

type MetricKey = "trips" | "items" | "friends" | "coins" | "xp";

const METRICS: { key: MetricKey; label: string; axisLabel: string }[] = [
  { key: "trips", label: "Trips resolved", axisLabel: "trips" },
  { key: "items", label: "Items granted", axisLabel: "items" },
  { key: "friends", label: "Friends offered", axisLabel: "friends" },
  { key: "coins", label: "Coins earned", axisLabel: "coins" },
  { key: "xp", label: "XP earned", axisLabel: "XP" },
];

const CHART_HEIGHT = 200;
const BAR_MAX_WIDTH = 18;
const GAP = 3;
const TOP_PAD = 14;

function formatShortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function formatCompact(n: number): string {
  if (n >= 10000) return `${Math.round(n / 1000)}K`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function niceMax(max: number): number {
  if (max <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(max)));
  const normalized = max / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

export function ResultsChart({ days }: { days: DailyResults[] }) {
  const titleId = useId();
  const [metric, setMetric] = useState<MetricKey>("trips");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const activeMetric = METRICS.find((m) => m.key === metric)!;
  const values = days.map((d) => d[metric]);
  const total = values.reduce((sum, v) => sum + v, 0);
  const max = niceMax(Math.max(...values, 0));

  const width = days.length * (BAR_MAX_WIDTH + GAP);
  const ticks = [0, max / 2, max];

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-green-200 p-4 dark:border-stone-800">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-stone-500">Last {days.length} days</h3>
          <p className="text-2xl font-semibold tracking-tight" id={titleId}>
            {formatCompact(total)} <span className="text-base font-normal text-stone-500">{activeMetric.axisLabel}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Metric">
          {METRICS.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMetric(m.key)}
              aria-pressed={metric === m.key}
              className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
                metric === m.key
                  ? "border-blue-600 bg-blue-600 text-white dark:border-blue-400 dark:bg-blue-500"
                  : "border-green-300 text-stone-600 hover:bg-green-100 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <svg
          role="img"
          aria-labelledby={titleId}
          width={width + 40}
          height={CHART_HEIGHT + TOP_PAD + 36}
          className="max-w-none"
        >
          <g transform={`translate(0, ${TOP_PAD})`}>
          {/* gridlines + y ticks */}
          {ticks.map((t, i) => {
            const y = CHART_HEIGHT - (t / max) * CHART_HEIGHT;
            return (
              <g key={i}>
                <line
                  x1={36}
                  x2={width + 36}
                  y1={y}
                  y2={y}
                  stroke="currentColor"
                  className="text-stone-200 dark:text-stone-800"
                  strokeWidth={1}
                />
                <text x={32} y={y + 4} textAnchor="end" fontSize={10} className="fill-stone-400">
                  {formatCompact(Math.round(t))}
                </text>
              </g>
            );
          })}
          <line
            x1={36}
            x2={width + 36}
            y1={CHART_HEIGHT}
            y2={CHART_HEIGHT}
            stroke="currentColor"
            className="text-stone-300 dark:text-stone-700"
            strokeWidth={1}
          />

          {/* bars */}
          {days.map((d, i) => {
            const v = d[metric];
            const barH = max > 0 ? (v / max) * CHART_HEIGHT : 0;
            const x = 36 + i * (BAR_MAX_WIDTH + GAP);
            const y = CHART_HEIGHT - barH;
            const isHover = hoverIndex === i;
            return (
              <g
                key={d.date}
                onMouseEnter={() => setHoverIndex(i)}
                onMouseLeave={() => setHoverIndex((h) => (h === i ? null : h))}
                onFocus={() => setHoverIndex(i)}
                onBlur={() => setHoverIndex((h) => (h === i ? null : h))}
                tabIndex={0}
                role="img"
                aria-label={`${formatShortDate(d.date)}: ${v} ${activeMetric.axisLabel}`}
              >
                <rect x={x} y={0} width={BAR_MAX_WIDTH} height={CHART_HEIGHT} fill="transparent" />
                <rect
                  x={x}
                  y={y}
                  width={BAR_MAX_WIDTH}
                  height={Math.max(0, barH)}
                  rx={4}
                  fill={isHover ? "#1c5cab" : "#2a78d6"}
                />
                {i % 5 === 0 ? (
                  <text
                    x={x + BAR_MAX_WIDTH / 2}
                    y={CHART_HEIGHT + 16}
                    textAnchor="middle"
                    fontSize={10}
                    className="fill-stone-400"
                  >
                    {formatShortDate(d.date)}
                  </text>
                ) : null}
                {isHover ? (
                  <text
                    x={x + BAR_MAX_WIDTH / 2}
                    y={y - 6}
                    textAnchor="middle"
                    fontSize={11}
                    fontWeight={700}
                    className="fill-stone-900 dark:fill-stone-100"
                  >
                    {v}
                  </text>
                ) : null}
              </g>
            );
          })}
          </g>
        </svg>
      </div>
      <p className="text-xs text-stone-400">
        Hover or tab through a bar for that day&apos;s exact count. Tutorial trips aren&apos;t counted.
      </p>
    </div>
  );
}
