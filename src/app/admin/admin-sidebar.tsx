"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AdminToastProvider } from "@/components/admin/toast";

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

// Full admin chrome: dark-green sticky sidebar + sticky top bar with
// a "jump to page" search box, matching the furgarden-admin-panel
// prototype's .app/.side/.mainwrap/.top structure. One client
// component because the mobile hamburger (in the top bar) and the
// sidebar's open/closed state are the same piece of UI, and because
// the jump-search's live filtering/keyboard nav needs client state —
// same architecture the original redesign used, just restyled.
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
    <div className={`admin-shell${navOpen ? " nav-open" : ""}`}>
      <link rel="stylesheet" href="/css/admin.css" />
      <a className="skip" href="#main">
        Skip to content
      </a>
      <div className="app">
        <aside className="side" id="side" aria-label="Admin sections">
          <Link className="brand" href="/admin">
            Furgarden
            <small>Admin panel</small>
          </Link>
          {NAV.map((group) => (
            <div key={group.label || "top"}>
              {group.label ? <h2>{group.label}</h2> : null}
              {group.items.map((item) => {
                const isCurrent = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="nl"
                    aria-current={isCurrent ? "page" : undefined}
                    onClick={() => setNavOpen(false)}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
          <div className="foot">
            <Link href="/">View site ↗</Link>
          </div>
        </aside>
        <div className="mainwrap">
          <header className="top">
            <button
              type="button"
              className="btn menu-btn"
              aria-expanded={navOpen}
              aria-controls="side"
              onClick={() => setNavOpen((o) => !o)}
            >
              ☰ Menu
            </button>
            <div className="jump">
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
                placeholder="Jump to a page or record…"
                aria-label="Jump to a page or record"
                autoComplete="off"
              />
              <kbd aria-hidden="true">/</kbd>
              {jumpOpen && jumpQuery.length > 0 ? (
                <ul className="jr">
                  {matches.length === 0 ? (
                    <li>
                      <span style={{ padding: "8px 10px", display: "block", color: "var(--soft)" }}>No matches</span>
                    </li>
                  ) : (
                    matches.map((page, i) => (
                      <li key={page.href}>
                        <Link
                          href={page.href}
                          className={i === selectedIndex ? "on" : undefined}
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
            <a className="vs" href="/">
              View site ↗
            </a>
          </header>
          <AdminToastProvider>
            <main id="main" tabIndex={-1}>
              {children}
            </main>
          </AdminToastProvider>
        </div>
      </div>
    </div>
  );
}
