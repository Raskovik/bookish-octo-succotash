import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { SiteNav } from "@/components/site-nav";
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
      {/* suppressHydrationWarning here only covers this element's own
          attributes (React docs), not children — it's for attributes
          browser extensions inject into <body> before hydration (e.g.
          ColorZilla's cz-shortcut-listen), which are real, harmless
          mismatches with no app-code fix. */}
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        <SiteHeader />
        <SiteNav />
        {/* The white content box every page's own <main> renders into —
            see AGENTS.md/README for the per-page max-w/padding pattern
            this wraps rather than replaces. flex-1 + flex-col here so a
            page's own `flex-1` main still stretches to push the footer
            down instead of leaving a gap. */}
        <div className="flex flex-1 justify-center px-4 py-8">
          <div className="flex w-full max-w-6xl flex-1 flex-col rounded-lg border border-black/5 bg-white shadow-md dark:bg-stone-900">
            {children}
          </div>
        </div>
        <SiteFooter />
      </body>
    </html>
  );
}
