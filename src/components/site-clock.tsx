"use client";

import { useEffect, useState } from "react";

// Same live clock as the furgarden-theme.css reference's #clock script,
// as a React effect instead. Starts null (not "the server's guess at
// the time") to avoid a hydration mismatch — fills in a tick after
// mount, same reasoning as any client-only "current time" display.
export function SiteClock() {
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    function tick() {
      setTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }));
    }
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <span>
      <i className="ic i-clock" />
      <time>{time ?? "--:--"}</time>
    </span>
  );
}
