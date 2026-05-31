'use client';

import * as React from 'react';

import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@tourism/ui/components/legacy/breadcrumb';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@tourism/ui/components/legacy/dropdown-menu';

/**
 * BreadcrumbAuto — a data-driven breadcrumb built on the legacy parts.
 *
 * - Pass an `items` array; separators are inserted automatically.
 * - The last item is rendered as the current page (no link).
 * - When `items.length` exceeds `maxItems`, the middle items collapse into an
 *   ellipsis dropdown, keeping `itemsBeforeCollapse` leading and
 *   `itemsAfterCollapse` trailing items visible.
 *
 *   <BreadcrumbAuto
 *     items={[
 *       { label: 'Home', href: '/', icon: <HomeIcon className="size-4" /> },
 *       { label: 'Tours', href: '/tours' },
 *       { label: 'Ha Long Bay' },
 *     ]}
 *   />
 */
interface BreadcrumbAutoItem {
  label: React.ReactNode;
  href?: string;
  icon?: React.ReactNode;
}

interface BreadcrumbAutoProps extends React.ComponentProps<'nav'> {
  items: BreadcrumbAutoItem[];
  separator?: React.ReactNode;
  maxItems?: number;
  itemsBeforeCollapse?: number;
  itemsAfterCollapse?: number;
}

function renderLabel(item: BreadcrumbAutoItem): React.ReactNode {
  if (!item.icon) return item.label;
  return (
    <span className="flex items-center gap-1.5">
      {item.icon}
      {item.label}
    </span>
  );
}

function CollapsedMenu({ items }: { items: BreadcrumbAutoItem[] }) {
  return (
    <BreadcrumbItem>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Show collapsed breadcrumb items"
          className="flex items-center"
        >
          <BreadcrumbEllipsis />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {items.map((item, index) => (
            <DropdownMenuItem
              key={index}
              render={item.href ? <a href={item.href} /> : undefined}
            >
              {renderLabel(item)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </BreadcrumbItem>
  );
}

function BreadcrumbAuto({
  items,
  separator,
  maxItems = 4,
  itemsBeforeCollapse = 1,
  itemsAfterCollapse = 1,
  className,
  ...props
}: BreadcrumbAutoProps) {
  const shouldCollapse =
    items.length > maxItems &&
    itemsBeforeCollapse + itemsAfterCollapse < items.length;

  const collapseStart = itemsBeforeCollapse;
  const collapseEnd = items.length - itemsAfterCollapse;
  const collapsedItems = shouldCollapse
    ? items.slice(collapseStart, collapseEnd)
    : [];

  const segments: React.ReactNode[] = [];
  items.forEach((item, index) => {
    const isLast = index === items.length - 1;

    if (shouldCollapse && index >= collapseStart && index < collapseEnd) {
      if (index === collapseStart) {
        segments.push(<CollapsedMenu key="collapsed" items={collapsedItems} />);
      }
      return;
    }

    segments.push(
      <BreadcrumbItem key={index}>
        {isLast || !item.href ? (
          <BreadcrumbPage>{renderLabel(item)}</BreadcrumbPage>
        ) : (
          <BreadcrumbLink href={item.href}>{renderLabel(item)}</BreadcrumbLink>
        )}
      </BreadcrumbItem>,
    );
  });

  return (
    <Breadcrumb className={className} {...props}>
      <BreadcrumbList>
        {segments.map((segment, index) => (
          <React.Fragment key={index}>
            {index > 0 && <BreadcrumbSeparator>{separator}</BreadcrumbSeparator>}
            {segment}
          </React.Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

export { BreadcrumbAuto };
export type { BreadcrumbAutoItem, BreadcrumbAutoProps };
