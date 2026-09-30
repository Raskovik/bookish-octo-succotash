import { createClient } from "@/lib/supabase/server";
import { TRADING_ENABLED } from "@/lib/feature-flags";
import { NavGroups, type NavGroup } from "@/components/nav-groups";

export async function SiteNav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("is_admin, is_moderator")
    .eq("id", user.id)
    .single();
  const isAdmin = profile?.is_admin ?? false;
  const isModerator = profile?.is_moderator ?? false;

  const groups: NavGroup[] = [
    {
      label: "Play",
      links: [
        { href: "/expeditions", label: "Expeditions" },
        { href: "/brewing", label: "Brewing" },
        { href: "/garden", label: "Garden" },
      ],
    },
    {
      label: "My Stuff",
      links: [
        { href: "/pets", label: "Pets" },
        { href: "/items", label: "Items" },
      ],
    },
    {
      label: "Trade",
      links: [
        { href: "/shop", label: "Shop" },
        { href: "/marketplace", label: "Marketplace" },
        ...(TRADING_ENABLED ? [{ href: "/trades", label: "Trades" }] : []),
      ],
    },
    {
      label: "Community",
      links: [
        { href: "/forums", label: "Forums" },
        { href: "/messages", label: "Messages" },
      ],
    },
    {
      label: "Account",
      links: [
        { href: "/settings", label: "Settings" },
        // Separate links, not one merged entry — a moderator who isn't
        // also an admin gets Mod Tools but must never see (or be able to
        // guess their way into) Admin. An admin gets both, since is_admin
        // satisfies both requireAdmin() and requireModerator().
        ...(isModerator || isAdmin ? [{ href: "/mod", label: "Mod Tools" }] : []),
        ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : []),
      ],
    },
  ];

  return (
    <nav className="mx-4 mt-3 rounded-md border-2 border-amber-900 bg-yellow-400 px-3 py-1.5 shadow-sm">
      <NavGroups groups={groups} />
    </nav>
  );
}
