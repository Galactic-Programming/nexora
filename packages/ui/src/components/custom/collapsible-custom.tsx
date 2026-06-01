'use client';

import { Collapsible as CollapsiblePrimitive } from '@base-ui/react/collapsible';

import { cn } from '@tourism/ui/lib/utils';

/**
 * Collapsible (custom) — re-exports the legacy Collapsible/Trigger untouched
 * and overrides CollapsibleContent to bake in the open/close height animation
 * by default, so consumers don't repeat the verbose className every time.
 *
 * Uses Base UI's native `--collapsible-panel-height` + data-starting/ending
 * style attributes (pure CSS transition, no motion dependency), mirroring how
 * the legacy AccordionContent already animates its panel.
 *
 *   <Collapsible>
 *     <CollapsibleTrigger ... />
 *     <CollapsibleContent>...</CollapsibleContent>   // animates for free
 *   </Collapsible>
 */
export {
  Collapsible,
  CollapsibleTrigger,
} from '@tourism/ui/components/legacy/collapsible';

function CollapsibleContent({
  className,
  ...props
}: CollapsiblePrimitive.Panel.Props) {
  return (
    <CollapsiblePrimitive.Panel
      data-slot="collapsible-content"
      className={cn(
        'h-(--collapsible-panel-height) overflow-hidden transition-all duration-300 data-ending-style:h-0 data-starting-style:h-0',
        className,
      )}
      {...props}
    />
  );
}

export { CollapsibleContent };
