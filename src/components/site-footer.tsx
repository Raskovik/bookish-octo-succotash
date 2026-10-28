import Link from "next/link";
import { FOOTER_TEXT, SITE_NAME } from "@/config";

// Matches furgarden-design/partials/site-footer.html's .foot — the dark
// jungle band the page trails off into, including the .foot-links list
// (About/Rules/Help/Contact/Terms of Service/Privacy Policy) its own
// README calls "Static; edit the link list as the site grows". None of
// those pages exist in this app yet, so each renders as plain red text
// (.tbd) instead of a real link — swap an entry to a <Link> once its
// page exists.
const FOOTER_LINKS = ["About", "Rules", "Help", "Contact", "Terms of Service", "Privacy Policy"];

export function SiteFooter() {
  return (
    <footer className="foot">
      <div className="foot-in">
        <Link className="foot-logo" href="/">
          {SITE_NAME}
        </Link>
        <nav aria-label="Footer">
          <ul className="foot-links">
            {FOOTER_LINKS.map((label) => (
              <li key={label}>
                <span className="tbd" title="This page doesn't exist yet">
                  {label}
                </span>
              </li>
            ))}
          </ul>
        </nav>
        <p className="copy">{FOOTER_TEXT}</p>
        {/* The commit actually deployed — see getBuildSha() in
            next.config.ts. Updates itself on every push, no manual
            bumping; "dev" outside a build that has git available. */}
        <p className="build-ver">build {process.env.NEXT_PUBLIC_BUILD_SHA ?? "dev"}</p>
      </div>
    </footer>
  );
}
