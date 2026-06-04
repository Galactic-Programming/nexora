import type * as React from 'react';

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@tourism/ui/components/legacy/pagination';

/**
 * PaginationControl — data-driven pagination over the legacy primitives.
 * Computes the visible page window with ellipses so callers don't hand-build
 * the range each time. Reused for tour listings (customer) and tables (admin).
 *
 * Provide `getHref` for link-based pagination (SEO-friendly) and/or
 * `onPageChange` for controlled/client pagination.
 *
 *   <PaginationControl page={page} pageCount={20} onPageChange={setPage} />
 *   <PaginationControl page={page} pageCount={20} getHref={(p) => `/tours?page=${p}`} />
 */
interface PaginationControlProps {
  page: number;
  pageCount: number;
  onPageChange?: (page: number) => void;
  getHref?: (page: number) => string;
  siblingCount?: number;
  className?: string;
  'aria-label'?: string;
}

/** Page items to render, inserting 'ellipsis' for gaps wider than one page. */
function getPaginationItems(
  page: number,
  pageCount: number,
  siblingCount: number,
): Array<number | 'ellipsis'> {
  const pages = new Set<number>([1, pageCount]);
  for (let p = page - siblingCount; p <= page + siblingCount; p++) {
    if (p >= 1 && p <= pageCount) pages.add(p);
  }

  const sorted = Array.from(pages).sort((a, b) => a - b);
  const items: Array<number | 'ellipsis'> = [];
  let previous = 0;

  for (const current of sorted) {
    const gap = current - previous;
    if (gap === 2) {
      items.push(previous + 1); // fill a single-page gap instead of an ellipsis
    } else if (gap > 2) {
      items.push('ellipsis');
    }
    items.push(current);
    previous = current;
  }

  return items;
}

function PaginationControl({
  page,
  pageCount,
  onPageChange,
  getHref,
  siblingCount = 1,
  className,
  'aria-label': ariaLabel,
}: PaginationControlProps) {
  if (pageCount <= 1) return null;

  const items = getPaginationItems(page, pageCount, siblingCount);

  const handleSelect =
    (target: number) => (event: React.MouseEvent<HTMLAnchorElement>) => {
      if (!getHref) event.preventDefault();
      if (target >= 1 && target <= pageCount && target !== page) {
        onPageChange?.(target);
      }
    };

  const disabledClass = (disabled: boolean) =>
    disabled ? 'pointer-events-none opacity-50' : undefined;

  return (
    <Pagination className={className} aria-label={ariaLabel}>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            href={getHref && page > 1 ? getHref(page - 1) : undefined}
            aria-disabled={page <= 1}
            tabIndex={page <= 1 ? -1 : undefined}
            className={disabledClass(page <= 1)}
            onClick={handleSelect(page - 1)}
          />
        </PaginationItem>

        {items.map((item, index) =>
          item === 'ellipsis' ? (
            <PaginationItem key={`ellipsis-${index}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={item}>
              <PaginationLink
                href={getHref ? getHref(item) : undefined}
                isActive={item === page}
                onClick={handleSelect(item)}
              >
                {item}
              </PaginationLink>
            </PaginationItem>
          ),
        )}

        <PaginationItem>
          <PaginationNext
            href={getHref && page < pageCount ? getHref(page + 1) : undefined}
            aria-disabled={page >= pageCount}
            tabIndex={page >= pageCount ? -1 : undefined}
            className={disabledClass(page >= pageCount)}
            onClick={handleSelect(page + 1)}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

export { PaginationControl };
export type { PaginationControlProps };
