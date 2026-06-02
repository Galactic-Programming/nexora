import type * as React from 'react';

import { cn } from '@tourism/ui/lib/utils';

/**
 * DescriptionList — a data-driven label/value list (`<dl>`) for entity detail
 * views: tour specs on the customer side, record detail panels on admin.
 *
 *   <DescriptionList
 *     items={[
 *       { label: 'Duration', value: '2 days' },
 *       { label: 'Group size', value: 'Max 20' },
 *       { label: 'Meeting point', value: 'Hanoi Old Quarter' },
 *     ]}
 *   />
 *
 * Rows stack on mobile and align label/value in a responsive grid from `sm`.
 */
interface DescriptionListItem {
  label: React.ReactNode;
  value: React.ReactNode;
}

interface DescriptionListProps extends React.ComponentProps<'dl'> {
  items: DescriptionListItem[];
}

function DescriptionList({ items, className, ...props }: DescriptionListProps) {
  return (
    <dl
      data-slot="description-list"
      className={cn('divide-y', className)}
      {...props}
    >
      {items.map((item, index) => (
        <div
          key={index}
          className="grid gap-1 py-4 text-sm sm:grid-cols-3 sm:gap-4"
        >
          <dt className="text-muted-foreground font-medium">{item.label}</dt>
          <dd className="sm:col-span-2">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export { DescriptionList };
export type { DescriptionListItem, DescriptionListProps };
