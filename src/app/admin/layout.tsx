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
  const { supabase, user } = await requireAdmin();

  // Nav item counts (the prototype's ".ct" badges) and the signed-in
  // admin's display name — fetched once here since the sidebar renders
  // on every admin page. Accounts has no honest total count available
  // (admin_list_accounts caps at 25 rows for its own search UI), so it
  // deliberately has no badge rather than showing a misleading number.
  const [
    { count: zoneCount },
    { count: itemCount },
    { count: speciesCount },
    { count: breedCount },
    { count: shopListingCount },
    { count: newsCount },
    { count: forumCategoryCount },
    { count: cannedMessageCount },
    { data: profile },
  ] = await Promise.all([
    supabase.from("zones").select("*", { count: "exact", head: true }),
    supabase.from("items").select("*", { count: "exact", head: true }),
    supabase.from("species").select("*", { count: "exact", head: true }),
    supabase.from("breeds").select("*", { count: "exact", head: true }),
    supabase.from("shop_listings").select("*", { count: "exact", head: true }),
    supabase.from("site_news_posts").select("*", { count: "exact", head: true }),
    supabase.from("forum_categories").select("*", { count: "exact", head: true }),
    supabase.from("canned_staff_messages").select("*", { count: "exact", head: true }),
    supabase.from("users").select("display_name").eq("id", user.id).single(),
  ]);

  const counts: Record<string, number> = {
    "/admin/zones": zoneCount ?? 0,
    "/admin/items": itemCount ?? 0,
    "/admin/species": speciesCount ?? 0,
    "/admin/breeds": breedCount ?? 0,
    "/admin/shop-listings": shopListingCount ?? 0,
    "/admin/news": newsCount ?? 0,
    "/admin/forums": forumCategoryCount ?? 0,
    "/admin/canned-messages": cannedMessageCount ?? 0,
  };

  return (
    <AdminSidebar counts={counts} signedInAs={profile?.display_name ?? user.email ?? "admin"}>
      {children}
    </AdminSidebar>
  );
}
