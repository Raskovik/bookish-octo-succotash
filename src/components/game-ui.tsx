import type { LucideIcon } from "lucide-react";

// Shared "game chrome" primitives — the wood-frame/parchment/glossy-pill
// look used sitewide (header, nav, footer, page wrapper, modals), built
// from CSS gradients (see .wood-frame/.parchment in globals.css) rather
// than real wood-grain/paper texture art, which doesn't exist yet. Swap
// the look everywhere at once later by editing those two classes and the
// variant gradients below, same "one place to edit" idea as the color
// tokens in globals.css.

/**
 * A wood-framed parchment panel. Used both for small boxes (modals) and
 * as the sitewide page wrapper in layout.tsx — `title` renders an
 * inset pill like a window's title bar; omit it for a plain panel.
 */
export function GamePanel({
  title,
  right,
  children,
  className = "",
  contentClassName = "",
}: {
  title?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <div className={`wood-frame rounded-2xl border-2 border-black/30 p-2 shadow-lg ${className}`}>
      <div className={`parchment flex flex-1 flex-col rounded-xl border border-black/10 ${contentClassName}`}>
        {title ? (
          <div className="flex items-center justify-between gap-3 p-3 pb-0">
            <div className="rounded-full border-2 border-amber-800 bg-amber-100 px-4 py-1.5 text-sm font-bold text-amber-900 shadow-inner">
              {title}
            </div>
            {right}
          </div>
        ) : (
          right
        )}
        {children}
      </div>
    </div>
  );
}

const BUTTON_VARIANTS: Record<string, string> = {
  primary:
    "border-green-900 from-green-400 to-green-700 text-green-950 dark:border-green-950 dark:from-green-600 dark:to-green-900 dark:text-green-50",
  danger:
    "border-red-900 from-red-400 to-red-700 text-red-950 dark:border-red-950 dark:from-red-600 dark:to-red-900 dark:text-red-50",
};

/** A glossy beveled pill button — the site's primary call-to-action style. */
export function GameButton({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof BUTTON_VARIANTS }) {
  return (
    <button
      {...props}
      className={`relative overflow-hidden rounded-full border-2 bg-gradient-to-b px-5 py-2 text-sm font-bold shadow-md transition active:scale-[0.97] disabled:cursor-not-allowed disabled:border-stone-300 disabled:from-stone-200 disabled:to-stone-300 disabled:text-stone-400 disabled:shadow-none disabled:active:scale-100 dark:disabled:border-stone-700 dark:disabled:from-stone-800 dark:disabled:to-stone-900 dark:disabled:text-stone-600 ${BUTTON_VARIANTS[variant]} ${className}`}
    >
      <span className="pointer-events-none absolute inset-x-1.5 top-1 h-1/3 rounded-full bg-white/35" />
      <span className="relative inline-flex items-center gap-1.5">{children}</span>
    </button>
  );
}

const ICON_BUTTON_VARIANTS: Record<string, string> = {
  neutral: "border-blue-800 from-blue-300 to-blue-600",
  danger: "border-red-800 from-red-400 to-red-700",
};

/**
 * The chunky-icon-button look as a plain className string, for a <Link>
 * or anything else that can't be a <button> (IconButton itself always
 * renders a <button> and uses this internally). Caller still needs its
 * own height/width sizing and to render the icon.
 */
export function iconButtonClassName(variant: keyof typeof ICON_BUTTON_VARIANTS = "neutral", className = "") {
  return `relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 bg-gradient-to-b text-white shadow-md transition active:scale-95 ${ICON_BUTTON_VARIANTS[variant]} ${className}`;
}

/** The gloss highlight overlay IconButton/iconButtonClassName expect inside them. */
export function IconGloss() {
  return <span className="pointer-events-none absolute inset-x-1 top-0.5 h-1/3 rounded-full bg-white/35" />;
}

/** A chunky circular icon button — close/edit/small actions. */
export function IconButton({
  icon: Icon,
  label,
  variant = "neutral",
  size = 36,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: LucideIcon;
  label: string;
  variant?: keyof typeof ICON_BUTTON_VARIANTS;
  size?: number;
}) {
  return (
    <button
      {...props}
      aria-label={label}
      title={label}
      style={{ width: size, height: size }}
      className={iconButtonClassName(
        variant,
        `disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 ${className}`,
      )}
    >
      <IconGloss />
      <Icon size={Math.round(size * 0.5)} className="relative" />
    </button>
  );
}
