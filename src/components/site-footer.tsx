import Link from "next/link";
import { FOOTER_TEXT } from "@/config";

// Matches furgarden-design/partials/site-footer.html's .foot — the dark
// jungle band the page trails off into. Drops the partial's .foot-links
// list (About/Rules/Help/Contact/Terms/Privacy): its own README calls
// it "Static; edit the link list as the site grows", and none of those
// pages exist in this app yet, so linking them would just be dead ends.
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
