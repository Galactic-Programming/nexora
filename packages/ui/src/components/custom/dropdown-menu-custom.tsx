'use client';

import { Menu as MenuPrimitive } from '@base-ui/react/menu';

import { cn } from '@tourism/ui/lib/utils';

/**
 * DropdownMenu (custom) — admin-oriented extension of the legacy dropdown menu,
 * mirroring context-menu-custom for a uniform action-menu palette.
 *
 * Only `DropdownMenuItem` changes: it gains semantic `success`/`warning`
 * variants beside the existing `default`/`destructive`, reusing the same color
 * tokens. Everything else is re-exported untouched from legacy. Used in admin
 * row action menus ("⋮"): approve / set-pending / delete.
 *
 *   <DropdownMenuItem variant="success">Approve</DropdownMenuItem>
 *   <DropdownMenuItem variant="warning">Set pending</DropdownMenuItem>
 *   <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
 */
export {
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@tourism/ui/components/legacy/dropdown-menu';

function DropdownMenuItem({
  className,
  inset,
  variant = 'default',
  ...props
}: MenuPrimitive.Item.Props & {
  inset?: boolean;
  variant?: 'default' | 'destructive' | 'success' | 'warning';
}) {
  return (
    <MenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        "group/dropdown-menu-item relative flex cursor-default items-center gap-2.5 rounded-2xl px-3 py-2 text-sm font-medium outline-hidden select-none focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:not-data-[variant=success]:not-data-[variant=warning]:focus:**:text-accent-foreground data-inset:pl-9.5 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        // destructive (legacy)
        'data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive dark:data-[variant=destructive]:focus:bg-destructive/20 data-[variant=destructive]:*:[svg]:text-destructive',
        // success (custom)
        'data-[variant=success]:text-green-600 data-[variant=success]:focus:bg-green-600/10 data-[variant=success]:focus:text-green-600 data-[variant=success]:*:[svg]:text-green-600 dark:data-[variant=success]:text-green-400 dark:data-[variant=success]:focus:bg-green-400/10 dark:data-[variant=success]:focus:text-green-400 dark:data-[variant=success]:*:[svg]:text-green-400',
        // warning (custom)
        'data-[variant=warning]:text-amber-600 data-[variant=warning]:focus:bg-amber-600/10 data-[variant=warning]:focus:text-amber-600 data-[variant=warning]:*:[svg]:text-amber-600 dark:data-[variant=warning]:text-amber-400 dark:data-[variant=warning]:focus:bg-amber-400/10 dark:data-[variant=warning]:focus:text-amber-400 dark:data-[variant=warning]:*:[svg]:text-amber-400',
        className,
      )}
      {...props}
    />
  );
}

export { DropdownMenuItem };
