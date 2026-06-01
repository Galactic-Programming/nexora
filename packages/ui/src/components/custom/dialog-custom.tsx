import type * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@tourism/ui/lib/utils';

/**
 * Dialog (custom) — re-exports the legacy dialog untouched and adds a
 * `DialogMedia` slot: a circular icon badge for the dialog header, the same
 * pattern several auth/verification dialogs repeat (sign-in, OTP).
 *
 * Tones reuse the same tokens as AlertDialogMedia / the custom Alert for a
 * consistent system. Place it at the top of a (centered) DialogHeader:
 *
 *   <DialogHeader className="items-center">
 *     <DialogMedia tone="success"><CheckIcon /></DialogMedia>
 *     <DialogTitle>Account verified!</DialogTitle>
 *     <DialogDescription>...</DialogDescription>
 *   </DialogHeader>
 */
export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from '@tourism/ui/components/legacy/dialog';

const dialogMediaVariants = cva(
  "mb-2 inline-flex size-12 items-center justify-center rounded-full *:[svg:not([class*='size-'])]:size-6",
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

function DialogMedia({
  className,
  tone,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof dialogMediaVariants>) {
  return (
    <div
      data-slot="dialog-media"
      className={cn(dialogMediaVariants({ tone }), className)}
      {...props}
    />
  );
}

export { DialogMedia, dialogMediaVariants };
