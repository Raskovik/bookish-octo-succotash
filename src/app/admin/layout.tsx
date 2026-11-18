import { requireAdmin } from "@/lib/admin";
import { AdminSidebar } from "./admin-sidebar";
import { AdminToastProvider } from "@/components/admin/toast";

// Grouped left sidebar (furgarden-admin-panel redesign package) —
// replaces the old single row of top-nav text links. Deliberately
// outside the jungle theme's .sheet/.panel card shell (admin doesn't
// need the player-facing decoration) — a plain, scannable Tailwind
// layout, same as every admin page's own content already was.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <main id="main" className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Admin panel</h1>
      <AdminToastProvider>
        <AdminSidebar>{children}</AdminSidebar>
      </AdminToastProvider>
    </main>
  );
}
