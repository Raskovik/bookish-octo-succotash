"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export type NavGroup = {
  label: string;
  links: { href: string; label: string }[];
};

/**
 * The "sections are grouped together and fold into a dropdown when
 * clicked" nav bar. One group open at a time — clicking the open
 * group's own button closes it, clicking another switches to it,
 * clicking anywhere outside closes whichever is open.
 */
export function NavGroups({ groups }: { groups: NavGroup[] }) {
  const [openLabel, setOpenLabel] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openLabel) return;

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpenLabel(null);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openLabel]);

  return (
    <div ref={containerRef} className="flex flex-wrap items-center gap-1">
      {groups.map((group) => {
        const isOpen = openLabel === group.label;
        return (
          <div key={group.label} className="relative">
            <button
              type="button"
              onClick={() => setOpenLabel(isOpen ? null : group.label)}
              className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-semibold text-stone-900 hover:bg-yellow-300 ${
                isOpen ? "bg-yellow-300" : ""
              }`}
            >
              {group.label}
              <span className={`text-xs transition-transform ${isOpen ? "rotate-180" : ""}`}>▾</span>
            </button>
            {isOpen ? (
              <div className="absolute left-0 top-full z-10 mt-1 flex min-w-40 flex-col gap-0.5 rounded-md border border-stone-900/10 bg-yellow-50 p-1.5 shadow-lg">
                {group.links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpenLabel(null)}
                    className="rounded px-3 py-1.5 text-sm font-medium text-stone-900 hover:bg-yellow-200"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
