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
 * clicking anywhere outside closes whichever is open. Classes match
 * furgarden-theme.css's .has-menu/.navlink/.menu — that CSS doesn't
 * care how .is-open gets toggled, so this keeps its own React state
 * instead of the reference file's vanilla-JS click delegation.
 */
export function NavGroups({ groups }: { groups: NavGroup[] }) {
  const [openLabel, setOpenLabel] = useState<string | null>(null);
  const containerRef = useRef<HTMLUListElement>(null);

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
    <ul ref={containerRef} className="navlinks">
      {groups.map((group) => {
        const isOpen = openLabel === group.label;
        return (
          <li key={group.label} className={`has-menu${isOpen ? " is-open" : ""}`}>
            <button
              className="navlink"
              type="button"
              aria-haspopup="true"
              aria-expanded={isOpen}
              onClick={() => setOpenLabel(isOpen ? null : group.label)}
            >
              {group.label} ▾
            </button>
            <ul className="menu">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} onClick={() => setOpenLabel(null)}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ul>
  );
}
