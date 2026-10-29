import Link from "next/link";

/**
 * The forum design's .fm-pager footer — matches pages/forum.html and
 * topic.html exactly (First/Prev/«Page X of Y»/Next/Last as
 * .btn.btn-sm.btn-cream). Forum-specific sibling of PaginationBar (which
 * stays as-is for the messages/mod pages, not yet ported to this theme).
 * Always includes an explicit ?page=, same reasoning as PaginationBar.
 */
export function FmPager({
  basePath,
  page,
  totalPages,
}: {
  basePath: string;
  page: number;
  totalPages: number;
}) {
  const clampedTotal = Math.max(totalPages, 1);

  function hrefFor(p: number) {
    return `${basePath}?page=${p}`;
  }

  return (
    <nav className="fm-pager" aria-label="Pages">
      <PagerLink href={hrefFor(1)} disabled={page <= 1} label="First page">
        «
      </PagerLink>
      <PagerLink href={hrefFor(page - 1)} disabled={page <= 1} label="Previous page">
        ‹
      </PagerLink>
      <span className="fm-pg">
        Page <b>{page}</b> of <b>{clampedTotal}</b>
      </span>
      <PagerLink href={hrefFor(page + 1)} disabled={page >= clampedTotal} label="Next page">
        ›
      </PagerLink>
      <PagerLink href={hrefFor(clampedTotal)} disabled={page >= clampedTotal} label="Last page">
        »
      </PagerLink>
    </nav>
  );
}

function PagerLink({
  href,
  disabled,
  label,
  children,
}: {
  href: string;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <button type="button" className="btn btn-sm btn-cream" disabled aria-label={label}>
        {children}
      </button>
    );
  }
  return (
    <Link href={href} className="btn btn-sm btn-cream" aria-label={label}>
      {children}
    </Link>
  );
}
