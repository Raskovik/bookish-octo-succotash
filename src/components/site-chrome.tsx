"use client";

import { usePathname } from "next/navigation";

// Admin gets the whole browser viewport to itself (its own
// .admin-shell/.app/.side chrome from admin-sidebar.tsx) instead of
// sitting inside the player-facing jungle header/footer — the
// furgarden-admin-panel prototype is a standalone page, not a widget
// nested in the site's own header/footer. `header`/`footer` are passed
// in as already-rendered elements (not functions) from the Server
// Component layout, since only functions can't cross the Server->Client
// boundary.
export function SiteChrome({
  header,
  footer,
  children,
}: {
  header: React.ReactNode;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin") ?? false;

  if (isAdmin) {
    return <>{children}</>;
  }

  return (
    <>
      <a className="btn btn-orange skip" href="#main">
        Skip to content
      </a>
      <div className="page">
        {header}
        {children}
      </div>
      {footer}
    </>
  );
}
