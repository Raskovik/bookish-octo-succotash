import Link from "next/link";
import { requireModerator } from "@/lib/moderation";

// Deliberately its own layout, not nested under /admin's — a moderator
// who isn't also an admin can reach every page under here but must never
// reach anything under /admin (see requireModerator() vs requireAdmin()).
export default async function ModLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireModerator();

  return (
    <main id="main">
      <div className="sheet">
        <div className="panel flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mod tools</h1>
        <nav className="mt-3 flex flex-wrap gap-4 text-sm">
          <Link href="/mod" className="hover:underline">
            Dashboard
          </Link>
          <Link href="/mod/reports" className="hover:underline">
            Reports
          </Link>
        </nav>
      </div>
      {children}
        </div>
      </div>
    </main>
  );
}
