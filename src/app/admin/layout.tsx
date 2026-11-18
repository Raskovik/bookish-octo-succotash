import { requireAdmin } from "@/lib/admin";
import { AdminSidebar } from "./admin-sidebar";

// Full app/side/mainwrap/top chrome, restyled to match the
// furgarden-admin-panel static HTML/CSS prototype's visual design
// system (dark-green sticky sidebar, sticky top "jump to page"
// search, cards/tables/badges/forms everywhere below). The
// stylesheet is scoped to this subtree by only ever being linked
// from this layout — see public/css/admin.css — and AdminSidebar
// owns the actual .app/.side/.top markup (and the mobile nav-open
// toggle + jump-search state), since that's all one coordinated
// piece of client-side UI. `children` is plain React output from
// this Server Component, not a function, so passing it down is fine
// — the Server->Client boundary only forbids functions.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return <AdminSidebar>{children}</AdminSidebar>;
}
