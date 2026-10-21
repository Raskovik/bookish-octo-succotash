import { FOOTER_TEXT } from "@/config";

export function SiteFooter() {
  return (
    <footer className="wood-frame mt-8 border-t-2 border-amber-950 px-4 py-6 text-center text-sm text-amber-100 shadow-[inset_0_4px_8px_rgba(0,0,0,0.3)]">
      {FOOTER_TEXT}
    </footer>
  );
}
