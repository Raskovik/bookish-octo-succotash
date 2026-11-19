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
  { key: "trips", label: "Trips", axisLabel: "trips" },
  { key: "items", label: "Items found", axisLabel: "items found" },
  { key: "friends", label: "Friends made", axisLabel: "friends made" },
  { key: "coins", label: "Coins earned", axisLabel: "coins earned" },
  { key: "xp", label: "XP earned", axisLabel: "XP earned" },
];

function formatShortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

// Matches the furgarden-admin-panel prototype's dashboard chart exactly:
// a plain flex row of <i> bars sized by inline height %, not SVG — see
// .chart/.axis/.sum in public/css/admin.css.
export function ResultsChart({ days }: { days: DailyResults[] }) {
  const titleId = useId();
  const [metric, setMetric] = useState<MetricKey>("trips");

  const activeMetric = METRICS.find((m) => m.key === metric)!;
  const values = days.map((d) => d[metric]);
  const max = Math.max(...values, 1);
  const total = values.reduce((sum, v) => sum + v, 0);
  const perDay = days.length > 0 ? Math.round(total / days.length) : 0;

  return (
    <section className="card pad" aria-labelledby={titleId}>
      <h2 id={titleId}>Adventuring results</h2>
      <div className="seg" role="group" aria-label="Metric">
        {METRICS.map((m) => (
          <button key={m.key} type="button" onClick={() => setMetric(m.key)} aria-pressed={metric === m.key}>
            {m.label}
          </button>
        ))}
      </div>
      <div
        className="chart"
        role="img"
        aria-label={`${activeMetric.label} per day for the last ${days.length} days. Total ${total}.`}
      >
        <span className="y">{max}</span>
        {days.map((d) => {
          const v = d[metric];
          return (
            <i
              key={d.date}
              style={{ height: `${Math.round((v / max) * 100)}%` }}
              title={`${formatShortDate(d.date)}: ${v}`}
            />
          );
        })}
      </div>
      <div className="axis">
        <span>{days.length > 0 ? formatShortDate(days[0].date) : ""}</span>
        <span>{days.length > 0 ? formatShortDate(days[days.length - 1].date) : ""}</span>
      </div>
      <p className="sum">
        Last {days.length} days: <b>{total.toLocaleString()}</b> {activeMetric.axisLabel} · about{" "}
        <b>{perDay.toLocaleString()}</b> a day. <span className="muted">Tutorial trips aren&apos;t counted.</span>
      </p>
    </section>
  );
}
