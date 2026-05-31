import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2Icon } from 'lucide-react';

import { cn } from '@tourism/ui/lib/utils';

/**
 * Button (custom) — superset of the legacy button. cva cannot be extended
 * across files, so the legacy variants/sizes are mirrored here, plus:
 *
 * - Three animated-gradient variants (`gradient`, `gradient-destructive`,
 *   `gradient-warning`) — a sliding gradient that shifts on hover.
 * - A `loading` prop that shows a spinner before the label and disables the
 *   button (keeps the label so width stays stable).
 *
 *   <Button variant="gradient">Get Started</Button>
 *   <Button loading>Saving…</Button>
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-4xl border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/80',
        outline:
          'border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:bg-transparent dark:hover:bg-input/30',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground',
        ghost:
          'hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50',
        destructive:
          'bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40',
        link: 'text-primary underline-offset-4 hover:underline',
        // --- custom: animated sliding gradient ---
        gradient:
          'border-0 bg-transparent bg-linear-to-r from-primary via-primary/60 to-primary bg-size-[200%_auto] text-primary-foreground hover:bg-transparent hover:bg-position-[99%_center]',
        'gradient-destructive':
          'border-0 bg-transparent bg-linear-to-r from-destructive via-destructive/60 to-destructive bg-size-[200%_auto] text-white hover:bg-transparent hover:bg-position-[99%_center] focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40',
        'gradient-warning':
          'border-0 bg-transparent bg-linear-to-r from-amber-600 via-amber-600/60 to-amber-600 bg-size-[200%_auto] text-white hover:bg-transparent hover:bg-position-[99%_center] focus-visible:ring-amber-600/20 dark:from-amber-400 dark:via-amber-400/60 dark:to-amber-400 dark:focus-visible:ring-amber-400/40',
      },
      size: {
        default:
          'h-9 gap-1.5 px-3 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5',
        xs: "h-6 gap-1 px-2.5 text-xs has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3",
        sm: 'h-8 gap-1 px-3 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2',
        lg: 'h-10 gap-1.5 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3',
        icon: 'size-9',
        'icon-xs': "size-6 [&_svg:not([class*='size-'])]:size-3",
        'icon-sm': 'size-8',
        'icon-lg': 'size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function Button({
  className,
  variant = 'default',
  size = 'default',
  loading = false,
  disabled,
  children,
  ...props
}: ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants> & {
    loading?: boolean;
  }) {
  return (
    <ButtonPrimitive
      data-slot="button"
      data-loading={loading || undefined}
      aria-busy={loading || undefined}
      disabled={loading || disabled}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {loading && <Loader2Icon className="animate-spin" />}
      {children}
    </ButtonPrimitive>
  );
}

export { Button, buttonVariants };
