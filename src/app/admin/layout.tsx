import { requireAdmin } from "@/lib/admin";
import { AdminSidebar } from "./admin-sidebar";
import { AdminToastProvider } from "@/components/admin/toast";

// Grouped left sidebar (furgarden-admin-panel redesign package) —
// replaces the old single row of top-nav text links. Deliberately
// outside the jungle theme's .sheet/.panel card shell (admin doesn't
// need the player-facing decoration) — a plain, scannable Tailwind
// layout, same as every admin page's own content already was.
//
// Every other page gets an opaque surface for free from .sheet/.panel
// (the parchment card) sitting on top of the site's fixed jungle sky/
// cloud/grass body background. Admin skips that card on purpose, so it
// needs its own solid background here instead — without one, that
// background shows straight through behind the sidebar and content
// (and badly washes out text contrast wherever it does).
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <main
      id="main"
      className="mx-auto my-4 w-full max-w-6xl rounded-xl bg-white px-4 py-6 shadow-sm sm:px-6 dark:bg-stone-950"
    >
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Admin panel</h1>
      <AdminToastProvider>
        <AdminSidebar>{children}</AdminSidebar>
      </AdminToastProvider>
    </main>
  );
}
