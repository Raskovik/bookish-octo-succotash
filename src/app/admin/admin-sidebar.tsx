"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type NavGroup = { label: string; items: { href: string; label: string }[] };

const NAV: NavGroup[] = [
  { label: "", items: [{ href: "/admin", label: "Dashboard" }] },
  {
    label: "Game content",
    items: [
      { href: "/admin/zones", label: "Zones" },
      { href: "/admin/items", label: "Items" },
      { href: "/admin/species", label: "Models" },
      { href: "/admin/breeds", label: "Breeds" },
      { href: "/admin/game-config", label: "Adventuring odds" },
    ],
  },
  {
    label: "Economy",
    items: [
      { href: "/admin/shop-listings", label: "Shop listings" },
      { href: "/admin/currency", label: "Currency (testing)" },
    ],
  },
  {
    label: "Community",
    items: [
      { href: "/admin/news", label: "Site news" },
      { href: "/admin/forums", label: "Forums" },
      { href: "/admin/canned-messages", label: "Canned messages" },
    ],
  },
  {
    label: "Safety & accounts",
    items: [
      { href: "/admin/accounts", label: "Accounts" },
      { href: "/admin/content-filter", label: "Content filter" },
      { href: "/admin/audit-log", label: "Audit log" },
    ],
  },
];

const ALL_PAGES = NAV.flatMap((g) => g.items);

export function AdminSidebar({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);
  const [jumpQuery, setJumpQuery] = useState("");
  const [jumpOpen, setJumpOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const jumpInputRef = useRef<HTMLInputElement>(null);

  const matches = ALL_PAGES.filter((p) => p.label.toLowerCase().includes(jumpQuery.trim().toLowerCase()));

  // Press "/" anywhere (outside a text field) to jump to the search box —
  // same affordance as the design package's prototype.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") {
        e.preventDefault();
        jumpInputRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="rounded-md border border-green-300 px-3 py-1.5 text-sm font-medium md:hidden dark:border-stone-700"
          aria-expanded={navOpen}
          aria-controls="admin-nav"
          onClick={() => setNavOpen((o) => !o)}
        >
          ☰ Menu
        </button>
        <div className="relative w-full max-w-sm">
          <input
            ref={jumpInputRef}
            type="search"
            value={jumpQuery}
            onChange={(e) => {
              setJumpQuery(e.target.value);
              setSelectedIndex(0);
              setJumpOpen(true);
            }}
            onFocus={() => setJumpOpen(true)}
            onBlur={() => setTimeout(() => setJumpOpen(false), 150)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                setSelectedIndex((i) => Math.min(matches.length - 1, i + 1));
                e.preventDefault();
              } else if (e.key === "ArrowUp") {
                setSelectedIndex((i) => Math.max(0, i - 1));
                e.preventDefault();
              } else if (e.key === "Enter" && matches[selectedIndex]) {
                router.push(matches[selectedIndex].href);
                setJumpQuery("");
                setJumpOpen(false);
              } else if (e.key === "Escape") {
                setJumpOpen(false);
              }
            }}
            placeholder="Jump to a page…"
            aria-label="Jump to a page"
            autoComplete="off"
            className="w-full rounded-full border border-green-300 py-2 pl-4 pr-10 text-sm dark:border-stone-700 dark:bg-stone-900"
          />
          <kbd className="pointer-events-none absolute right-3 top-2 rounded border border-green-300 px-1.5 text-xs text-stone-500 dark:border-stone-700">
            /
          </kbd>
          {jumpOpen && jumpQuery.length > 0 ? (
            <ul className="absolute left-0 right-0 top-full z-30 mt-1 max-h-60 overflow-y-auto rounded-md border border-green-200 bg-white shadow-lg dark:border-stone-800 dark:bg-stone-900">
              {matches.length === 0 ? (
                <li className="px-3 py-2 text-sm text-stone-500">No matches</li>
              ) : (
                matches.map((page, i) => (
                  <li key={page.href}>
                    <Link
                      href={page.href}
                      className={`block px-3 py-2 text-sm ${i === selectedIndex ? "bg-green-100 dark:bg-stone-800" : ""}`}
                      onClick={() => {
                        setJumpQuery("");
                        setJumpOpen(false);
                      }}
                    >
                      {page.label}
                    </Link>
                  </li>
                ))
              )}
            </ul>
          ) : null}
        </div>
      </div>

      <div className="md:flex md:gap-6">
      <nav
        id="admin-nav"
        aria-label="Admin sections"
        className={`${navOpen ? "block" : "hidden"} mb-6 h-fit rounded-lg border border-green-200 p-3 md:block md:w-56 md:shrink-0 dark:border-stone-800`}
      >
        {NAV.map((group) => (
          <div key={group.label || "top"} className="mb-3 last:mb-0">
            {group.label ? (
              <h2 className="mb-1 px-2 text-xs font-bold uppercase tracking-wide text-stone-500">{group.label}</h2>
            ) : null}
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const isCurrent = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={isCurrent ? "page" : undefined}
                      onClick={() => setNavOpen(false)}
                      className={`block rounded-md px-2 py-1.5 text-sm font-medium ${
                        isCurrent
                          ? "bg-green-800 text-white dark:bg-green-200 dark:text-green-950"
                          : "text-stone-700 hover:bg-green-100 dark:text-stone-300 dark:hover:bg-stone-800"
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
