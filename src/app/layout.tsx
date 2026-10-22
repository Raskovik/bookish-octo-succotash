import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { SITE_NAME, SITE_TAGLINE } from "@/config";
import "./globals.css";
import "./style/jungle-ui.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: SITE_NAME,
  description: SITE_TAGLINE,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* Fonts the jungle-ui.css kit's var(--font-display)/var(--font-header)/
          var(--font-body) expect — loaded sitewide now that the kit itself
          is (see the import above and bg-jungle/.paper below). The lint
          rule below is a Pages Router holdover (it wants fonts declared in
          _document.js, which doesn't exist in App Router); a plain <link>
          in the root layout is the correct, documented App Router
          pattern, so this is a known false positive, not a real issue. */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@400;600;700&family=Chewy&family=Fredoka:wght@400;500;600;700&family=Lilita+One&family=Luckiest+Guy&family=Nunito+Sans:wght@400;600;700;800&family=Nunito:wght@400;600;700&family=Paytone+One&family=Titan+One&display=swap"
      />
      {/* suppressHydrationWarning here only covers this element's own
          attributes (React docs), not children — it's for attributes
          browser extensions inject into <body> before hydration (e.g.
          ColorZilla's cz-shortcut-listen), which are real, harmless
          mismatches with no app-code fix. */}
      <body
        className="bg-jungle flex min-h-full flex-col"
        suppressHydrationWarning
      >
        <SiteHeader />
        <SiteNav />
        {/* The torn-paper content box every page's own <main> renders
            into (jungle-ui.css's .paper — see AGENTS.md/README for the
            per-page max-w/padding pattern this wraps rather than
            replaces). flex-1 + flex-col here so a page's own `flex-1`
            main still stretches to push the footer down instead of
            leaving a gap. */}
        <div className="flex flex-1 justify-center px-4 py-8">
          <div className="paper flex w-full max-w-6xl flex-1 flex-col">
            {children}
          </div>
        </div>
        <SiteFooter />
      </body>
    </html>
  );
}
