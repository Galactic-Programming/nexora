import { Accordion as AccordionPrimitive } from '@base-ui/react/accordion';
import { MinusIcon, PlusIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@tourism/ui/lib/utils';

/**
 * MediaAccordion — a composable accordion built on Base UI, mirroring the
 * legacy shadcn accordion API so it can be reused the same way:
 *
 *   <MediaAccordion multiple={false} defaultValue={['item-1']}>
 *     <MediaAccordionItem value="item-1">
 *       <MediaAccordionTrigger icon={<PackageIcon />} subtitle="Shipping">
 *         How do I track my order?
 *       </MediaAccordionTrigger>
 *       <MediaAccordionContent media="/image.jpg">
 *         You can track your order ...
 *       </MediaAccordionContent>
 *     </MediaAccordionItem>
 *   </MediaAccordion>
 *
 * Accent colors use the theme `--primary` token, so they stay in sync with
 * light/dark themes defined in globals.css instead of hardcoded values.
 */

function MediaAccordion({ className, ...props }: AccordionPrimitive.Root.Props) {
  return (
    <AccordionPrimitive.Root
      data-slot="media-accordion"
      className={cn('flex w-full flex-col', className)}
      {...props}
    />
  );
}

function MediaAccordionItem({ className, ...props }: AccordionPrimitive.Item.Props) {
  return (
    <AccordionPrimitive.Item
      data-slot="media-accordion-item"
      className={cn(
        'bg-transparent not-last:border-b border-transparent data-open:border-primary',
        className,
      )}
      {...props}
    />
  );
}

interface MediaAccordionTriggerProps extends AccordionPrimitive.Trigger.Props {
  /** Optional leading icon, rendered inside a circular badge. */
  icon?: ReactNode;
  /** Optional muted subtitle shown beneath the title. */
  subtitle?: ReactNode;
}

function MediaAccordionTrigger({
  className,
  children,
  icon,
  subtitle,
  ...props
}: MediaAccordionTriggerProps) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        data-slot="media-accordion-trigger"
        className={cn(
          'focus-visible:border-ring focus-visible:ring-ring/50 flex flex-1 items-center justify-between gap-4 rounded-lg border border-transparent py-2.5 text-left text-sm font-medium transition-all outline-none focus-visible:ring-3 aria-disabled:pointer-events-none aria-disabled:opacity-50 in-data-open:text-primary',
          className,
        )}
        {...props}
      >
        <span className="flex items-center gap-4">
          {icon ? (
            <span
              className="flex size-10 shrink-0 items-center justify-center rounded-full border *:size-4 in-data-open:border-primary in-data-open:text-primary"
              aria-hidden="true"
            >
              {icon}
            </span>
          ) : null}
          <span className="flex flex-col space-y-0.5">
            <span>{children}</span>
            {subtitle ? (
              <span className="text-muted-foreground font-normal in-data-open:text-primary/70">
                {subtitle}
              </span>
            ) : null}
          </span>
        </span>
        <PlusIcon className="text-muted-foreground pointer-events-none block size-4 shrink-0 transition-transform duration-500 in-data-open:hidden" />
        <MinusIcon className="text-primary pointer-events-none hidden size-4 shrink-0 transition-transform duration-500 in-data-open:block" />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

interface MediaAccordionContentProps extends AccordionPrimitive.Panel.Props {
  /** Optional image URL appended below the textual content. */
  media?: string;
  /** Alt text for the media image. */
  mediaAlt?: string;
}

function MediaAccordionContent({
  className,
  children,
  media,
  mediaAlt = '',
  ...props
}: MediaAccordionContentProps) {
  return (
    <AccordionPrimitive.Panel
      data-slot="media-accordion-content"
      className="overflow-hidden text-sm data-open:animate-accordion-down data-closed:animate-accordion-up"
      {...props}
    >
      <div
        className={cn(
          'h-(--accordion-panel-height) space-y-4 pt-0 pb-4 data-ending-style:h-0 data-starting-style:h-0',
          className,
        )}
      >
        {children ? <div className="text-muted-foreground">{children}</div> : null}
        {media ? (
          <img src={media} alt={mediaAlt} className="w-full rounded-lg" />
        ) : null}
      </div>
    </AccordionPrimitive.Panel>
  );
}

export {
  MediaAccordion,
  MediaAccordionItem,
  MediaAccordionTrigger,
  MediaAccordionContent,
};
export type { MediaAccordionTriggerProps, MediaAccordionContentProps };
