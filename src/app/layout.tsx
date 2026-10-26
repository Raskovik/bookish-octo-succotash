import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { SITE_NAME, SITE_TAGLINE } from "@/config";
import "./globals.css";
import "./furgarden-theme.css";

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
      className={`${geistSans.variable} ${geistMono.variable} jungle-root h-full antialiased`}
    >
      {/* Fonts furgarden-theme.css's var(--font-display)/var(--font-body)
          expect — sitewide now that the theme itself is (see the import
          above). The lint rule below is a Pages Router holdover (it
          wants fonts declared in _document.js, which doesn't exist in
          App Router); a plain <link> in the root layout is the correct,
          documented App Router pattern, so this is a known false
          positive, not a real issue — same reasoning as /style's own
          copy of this comment. */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Londrina+Solid:wght@400;900&family=Nunito:wght@600;700;800&display=swap"
      />
      {/* suppressHydrationWarning here only covers this element's own
          attributes (React docs), not children — it's for attributes
          browser extensions inject into <body> before hydration (e.g.
          ColorZilla's cz-shortcut-listen), which are real, harmless
          mismatches with no app-code fix. */}
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        <a className="btn btn-orange skip" href="#main">
          Skip to content
        </a>
        {/* furgarden-theme.css's .page: a max-width/padding constraint,
            not a card — each page's own content now sits directly
            against the body's sky/jungle background rather than inside
            a generic white box. The homepage (src/app/page.tsx) gives
            its own content the torn-paper .sheet/.panel treatment from
            the theme; other pages haven't been converted yet and will
            render plainly here until they are — see commit notes for
            which pages are and aren't done. flex-1 + flex-col so a
            page's own `flex-1` main still stretches to push the footer
            down instead of leaving a gap. */}
        <div className="page flex flex-1 flex-col">
          <SiteHeader />
          <SiteNav />
          {children}
        </div>
        <SiteFooter />
      </body>
    </html>
  );
}
