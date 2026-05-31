import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@tourism/ui/lib/utils';

/**
 * Alert (custom) — composable alert mirroring the legacy shadcn API, extended
 * with four semantic variants. Usage matches legacy exactly:
 *
 *   <Alert variant="success">
 *     <CheckCheckIcon />
 *     <AlertTitle>Account created</AlertTitle>
 *     <AlertDescription>You are all set.</AlertDescription>
 *   </Alert>
 *
 * Icons inherit the variant color via `*:[svg]:text-current`. The error variant
 * uses the theme `--destructive` token so it stays in sync with light/dark;
 * success/warning use explicit semantic colors with dark-mode counterparts.
 */
const alertVariants = cva(
  "group/alert relative grid w-full gap-0.5 rounded-2xl border px-4 py-3 text-left text-sm has-data-[slot=alert-action]:relative has-data-[slot=alert-action]:pr-18 has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-2.5 *:[svg]:row-span-2 *:[svg]:translate-y-0.5 *:[svg]:text-current *:[svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // information — neutral default (black text on card)
        default: 'bg-card text-card-foreground',
        // success — green
        success:
          'bg-card text-green-600 border-green-600/50 *:data-[slot=alert-description]:text-green-600/80 dark:text-green-400 dark:border-green-400/50 dark:*:data-[slot=alert-description]:text-green-400/80',
        // warning — amber
        warning:
          'bg-card text-amber-600 border-amber-600/50 *:data-[slot=alert-description]:text-amber-600/80 dark:text-amber-400 dark:border-amber-400/50 dark:*:data-[slot=alert-description]:text-amber-400/80',
        // failed / error — red, theme-synced via --destructive
        destructive:
          'bg-card text-destructive border-destructive/50 *:data-[slot=alert-description]:text-destructive/80',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        'font-medium group-has-[>svg]/alert:col-start-2 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground',
        className,
      )}
      {...props}
    />
  );
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        'text-sm text-balance text-muted-foreground md:text-pretty [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-4',
        className,
      )}
      {...props}
    />
  );
}

function AlertAction({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-action"
      className={cn('absolute top-2.5 right-3', className)}
      {...props}
    />
  );
}

export { Alert, AlertTitle, AlertDescription, AlertAction, alertVariants };
