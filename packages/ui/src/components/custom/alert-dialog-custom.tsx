import type * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@tourism/ui/lib/utils';

/**
 * AlertDialog (custom) — thin extension of the legacy Base UI alert-dialog.
 *
 * Everything is re-exported untouched from the legacy component except
 * `AlertDialogMedia`, which gains an optional `tone` prop so confirmation
 * dialogs can signal intent at a glance (e.g. a red badge for destructive
 * actions). Tones reuse the same color tokens as the custom Alert for a
 * consistent system; `tone="default"` keeps the original neutral look.
 *
 *   <AlertDialogMedia tone="destructive">
 *     <Trash2Icon />
 *   </AlertDialogMedia>
 *
 * The action button color is handled by the existing `variant` passthrough:
 *   <AlertDialogAction variant="destructive">Delete</AlertDialogAction>
 */
export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@tourism/ui/components/legacy/alert-dialog';

const alertDialogMediaVariants = cva(
  "mb-2 inline-flex size-16 items-center justify-center rounded-full sm:group-data-[size=default]/alert-dialog-content:row-span-2 *:[svg:not([class*='size-'])]:size-8",
  {
    variants: {
      tone: {
        default: 'bg-muted text-foreground',
        success:
          'bg-green-600/10 text-green-600 dark:bg-green-400/10 dark:text-green-400',
        warning:
          'bg-amber-600/10 text-amber-600 dark:bg-amber-400/10 dark:text-amber-400',
        destructive: 'bg-destructive/10 text-destructive',
      },
    },
    defaultVariants: {
      tone: 'default',
    },
  },
);

function AlertDialogMedia({
  className,
  tone,
  ...props
}: React.ComponentProps<'div'> &
  VariantProps<typeof alertDialogMediaVariants>) {
  return (
    <div
      data-slot="alert-dialog-media"
      className={cn(alertDialogMediaVariants({ tone }), className)}
      {...props}
    />
  );
}

export { AlertDialogMedia, alertDialogMediaVariants };
