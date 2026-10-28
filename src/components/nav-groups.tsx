import Link from "next/link";
import type { ReactNode } from "react";

export type NavGroup = {
  label: string;
  links: { href: string; label: string }[];
};

/**
 * Matches furgarden-design/partials/site-header.html's
 * <li class="has-menu"><button class="navlink">...<ul class="menu">.
 * No JS of its own: open/close on click, outside-click, and Esc are all
 * handled globally by public/js/furgarden.js's delegated click listener
 * (any .has-menu > button). This only has to render the static markup
 * that script expects.
 */
export function NavGroups({
  groups,
  leading,
}: {
  groups: NavGroup[];
  // A plain (non-dropdown) item rendered before the mapped groups,
  // inside the same <ul> — e.g. SiteNav's Home link. Optional so this
  // component stays usable without one.
  leading?: ReactNode;
}) {
  return (
    <ul className="navlinks">
      {leading}
      {groups.map((group) => (
        <li className="has-menu" key={group.label}>
          <button className="navlink" type="button" aria-haspopup="true" aria-expanded="false">
            {group.label} ▾
          </button>
          <ul className="menu">
            {group.links.map((link) => (
              <li key={link.href}>
                <Link href={link.href}>{link.label}</Link>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
