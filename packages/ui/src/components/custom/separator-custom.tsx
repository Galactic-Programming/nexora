import type * as React from 'react';

import { cn } from '@tourism/ui/lib/utils';
import { Separator } from '@tourism/ui/components/legacy/separator';

/**
 * Separator (custom) — re-exports the legacy line separator and adds
 * `SeparatorLabel`: the recurring "line — content — line" divider (e.g. an
 * "OR" auth divider, a section label, a badge/button between rules), in either
 * orientation and three line styles.
 *
 *   <SeparatorLabel>OR</SeparatorLabel>
 *   <SeparatorLabel variant="dashed"><Badge>New</Badge></SeparatorLabel>
 *   <SeparatorLabel orientation="vertical" variant="dotted"><ClockIcon /></SeparatorLabel>
 */
export { Separator } from '@tourism/ui/components/legacy/separator';

type SeparatorLabelVariant = 'solid' | 'dashed' | 'dotted';

interface SeparatorLabelProps extends React.ComponentProps<'div'> {
  orientation?: 'horizontal' | 'vertical';
  variant?: SeparatorLabelVariant;
}

function lineClass(
  variant: SeparatorLabelVariant,
  orientation: 'horizontal' | 'vertical',
): string {
  if (variant === 'solid') return 'flex-1';

  const side = orientation === 'vertical' ? 'border-l-2' : 'border-b-2';
  const style = variant === 'dashed' ? 'border-dashed' : 'border-dotted';
  return cn('flex-1 border-border bg-transparent', side, style);
}

function SeparatorLabel({
  orientation = 'horizontal',
  variant = 'solid',
  className,
  children,
  ...props
}: SeparatorLabelProps) {
  const line = lineClass(variant, orientation);
  const verticalLine = orientation === 'vertical' ? 'mx-auto' : undefined;

  return (
    <div
      data-slot="separator-label"
      className={cn(
        'flex items-center gap-3',
        orientation === 'vertical' ? 'h-full flex-col' : 'w-full',
        className,
      )}
      {...props}
    >
      <Separator orientation={orientation} className={cn(line, verticalLine)} />
      {children != null ? (
        <span className="text-muted-foreground shrink-0 text-sm font-medium">
          {children}
        </span>
      ) : null}
      {children != null ? (
        <Separator
          orientation={orientation}
          className={cn(line, verticalLine)}
        />
      ) : null}
    </div>
  );
}

export { SeparatorLabel };
export type { SeparatorLabelProps };
