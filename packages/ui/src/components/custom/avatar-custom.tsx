import type * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@tourism/ui/lib/utils';

/**
 * Avatar (custom) — thin extension of the legacy Base UI avatar.
 *
 * Everything is re-exported untouched from legacy except `AvatarBadge`, which
 * gains a `status` prop for admin account states. Colors:
 *   active   -> green   (account enabled)
 *   onboard  -> blue    (onboarding in progress)
 *   block    -> red     (--destructive, blocked/banned)
 *   inactive -> gray    (deactivated / dormant)
 *   default  -> primary (original look, backward-compatible)
 *
 *   <AvatarBadge status="active" />
 */
export {
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
} from '@tourism/ui/components/legacy/avatar';

const avatarBadgeVariants = cva(
  'absolute right-0 bottom-0 z-10 inline-flex items-center justify-center rounded-full bg-blend-color ring-2 ring-background select-none group-data-[size=sm]/avatar:size-2 group-data-[size=sm]/avatar:[&>svg]:hidden group-data-[size=default]/avatar:size-2.5 group-data-[size=default]/avatar:[&>svg]:size-2 group-data-[size=lg]/avatar:size-3 group-data-[size=lg]/avatar:[&>svg]:size-2',
  {
    variants: {
      status: {
        default: 'bg-primary text-primary-foreground',
        active: 'bg-green-600 text-white dark:bg-green-500',
        onboard: 'bg-blue-600 text-white dark:bg-blue-500',
        block: 'bg-destructive text-white',
        inactive: 'bg-muted-foreground text-background',
      },
    },
    defaultVariants: {
      status: 'default',
    },
  },
);

function AvatarBadge({
  className,
  status,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof avatarBadgeVariants>) {
  return (
    <span
      data-slot="avatar-badge"
      data-status={status ?? 'default'}
      className={cn(avatarBadgeVariants({ status }), className)}
      {...props}
    />
  );
}

export { AvatarBadge, avatarBadgeVariants };
