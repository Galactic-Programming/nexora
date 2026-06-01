'use client';

import { ContextMenu as ContextMenuPrimitive } from '@base-ui/react/context-menu';

import { cn } from '@tourism/ui/lib/utils';

/**
 * ContextMenu (custom) — admin-oriented extension of the legacy context menu.
 *
 * Right-click menus are primarily an admin surface (table row actions on
 * tours/bookings/users), so the only change is extending `ContextMenuItem`
 * with semantic `success`/`warning` variants alongside the existing
 * `default`/`destructive`, reusing the same color tokens as the custom Alert
 * and Avatar status. Everything else is re-exported untouched from legacy.
 *
 *   <ContextMenuItem variant="success">Approve review</ContextMenuItem>
 *   <ContextMenuItem variant="warning">Unpublish</ContextMenuItem>
 *   <ContextMenuItem variant="destructive">Delete tour</ContextMenuItem>
 */
export {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuCheckboxItem,
  ContextMenuRadioItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuGroup,
  ContextMenuPortal,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuRadioGroup,
} from '@tourism/ui/components/legacy/context-menu';

function ContextMenuItem({
  className,
  inset,
  variant = 'default',
  ...props
}: ContextMenuPrimitive.Item.Props & {
  inset?: boolean;
  variant?: 'default' | 'destructive' | 'success' | 'warning';
}) {
  return (
    <ContextMenuPrimitive.Item
      data-slot="context-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        "group/context-menu-item relative flex cursor-default items-center gap-2.5 rounded-2xl px-3 py-2 text-sm font-medium outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-inset:pl-9.5 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 focus:*:[svg]:text-accent-foreground",
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

export { ContextMenuItem };
