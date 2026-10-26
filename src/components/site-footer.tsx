import Link from "next/link";
import { FOOTER_TEXT } from "@/config";

// Matches furgarden-theme.css's .foot — the dark jungle band the page
// trails off into. Drops the reference's .foot-links list (About/
// Rules/Help/Contact/Terms/Privacy) since none of those pages exist in
// this app yet; linking them would just be dead links.
export function SiteFooter() {
  return (
    <footer className="foot">
      <div className="foot-in">
        <Link className="foot-logo" href="/">
          Furgarden
        </Link>
        <p className="copy">{FOOTER_TEXT}</p>
      </div>
    </footer>
  );
}
