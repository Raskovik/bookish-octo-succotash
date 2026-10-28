import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SITE_NAME, SITE_TAGLINE } from "@/config";
import "./globals.css";

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
      <head>
        {/* Self-hosted (public/fonts/) and preloaded so they start
            fetching in parallel with furgarden.css instead of after it
            — see the @font-face comment at the top of that file for
            why an @import was dropped. Only the two weights used on
            nearly every page (Londrina 400 for headings/numbers,
            Nunito 700 for body text) are worth the preload; 600/800/900
            are rarer and can load in after first paint. */}
        <link
          rel="preload"
          href="/fonts/londrina-solid-400.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/nunito-700.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        {/* The Furgarden "Jungle" design system — see public/css/furgarden.css
            and public/js/furgarden.js. Loaded on every page per its own
            README. A plain <link>, not a CSS import, since this is a
            static file served from public/, not a module for Next's
            CSS optimizer. */}
        {/* eslint-disable-next-line @next/next/no-css-tags */}
        <link rel="stylesheet" href="/css/furgarden.css" />
        <script src="/js/furgarden.js" defer />
      </head>
      {/* suppressHydrationWarning here only covers this element's own
          attributes (React docs), not children — it's for attributes
          browser extensions inject into <body> before hydration (e.g.
          ColorZilla's cz-shortcut-listen), which are real, harmless
          mismatches with no app-code fix. */}
      <body suppressHydrationWarning>
        {/* Page skeleton from the design system's README: skip link, then
            .page (header/nav + each page's own <main id="main">), then
            the full-width footer outside .page. Not yet converted: every
            individual page's own content still renders its pre-theme
            Tailwind styling inside that <main>, now sitting directly
            against the new background instead of inside a boxed wrapper. */}
        <a className="btn btn-orange skip" href="#main">
          Skip to content
        </a>
        <div className="page">
          <SiteHeader />
          {children}
        </div>
        <SiteFooter />
      </body>
    </html>
  );
}
