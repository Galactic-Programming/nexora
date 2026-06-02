import { use } from 'react';
import { setRequestLocale } from 'next-intl/server';
import {
  CheckCheckIcon,
  CheckIcon,
  ChevronsUpDownIcon,
  ClockIcon,
  HeadsetIcon,
  HomeIcon,
  PackageIcon,
  PencilIcon,
  RefreshCwIcon,
  Trash2Icon,
} from 'lucide-react';
import {
  MediaAccordion,
  MediaAccordionContent,
  MediaAccordionItem,
  MediaAccordionTrigger,
} from '@tourism/ui/components/custom/accordion-custom';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@tourism/ui/components/custom/alert-dialog-custom';
import { Button } from '@tourism/ui/components/legacy/button';
import {
  AspectRatio,
  type AspectRatioPreset,
} from '@tourism/ui/components/custom/aspect-ratio-custom';
import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
} from '@tourism/ui/components/custom/avatar-custom';
import { Badge } from '@tourism/ui/components/custom/badge-custom';
import { BreadcrumbAuto } from '@tourism/ui/components/custom/breadcrumb-custom';
import { MotionCarousel } from '@tourism/ui/components/custom/motion-carousel';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@tourism/ui/components/custom/collapsible-custom';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@tourism/ui/components/custom/context-menu-custom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@tourism/ui/components/custom/dropdown-menu-custom';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogMedia,
  DialogTitle,
  DialogTrigger,
} from '@tourism/ui/components/custom/dialog-custom';
import { Stagger } from '@tourism/ui/components/custom/stagger';
import {
  Field,
  FieldDescription,
  FieldLabel,
} from '@tourism/ui/components/custom/field-custom';
import { Input } from '@tourism/ui/components/legacy/input';
import { AlertTriggerDemo } from '@/components/alert-trigger-demo';
import { ConfettiDemo } from '@/components/confetti-demo';
import { ButtonDemo } from '@/components/button-demo';
import { CalendarDemo } from '@/components/calendar-demo';
import { TourCardDemo } from '@/components/tour-card-demo';
import { DataTableDemo } from '@/components/data-table-demo';
import { DateRangeDemo } from '@/components/date-range-demo';
import { FormDemo } from '@/components/form-demo';
import { DescriptionList } from '@tourism/ui/components/custom/description-list';
import { PhoneDemo } from '@/components/phone-demo';
import { PaginationDemo } from '@/components/pagination-demo';
import { StepperDemo } from '@/components/stepper-demo';
import { RatingDemo } from '@/components/rating-demo';
import { SeparatorLabel } from '@tourism/ui/components/custom/separator-custom';
import { ShimmerSkeleton } from '@tourism/ui/components/custom/shimmer-skeleton';

const AVATAR_STATUSES = ['active', 'onboard', 'block', 'inactive'] as const;

const carouselItems = [
  {
    image:
      'https://cdn.shadcnstudio.com/ss-assets/blocks/marketing/gallery/image-1.png',
    alt: 'Silhouettes on a beach',
  },
  {
    image:
      'https://cdn.shadcnstudio.com/ss-assets/blocks/marketing/gallery/image-2.png',
    alt: 'Snowy mountain peaks',
  },
  {
    image:
      'https://cdn.shadcnstudio.com/ss-assets/blocks/marketing/gallery/image-3.png',
    alt: 'Rolling green hills',
  },
  {
    image:
      'https://cdn.shadcnstudio.com/ss-assets/blocks/marketing/gallery/image-4.png',
    alt: 'Sunset landscape',
  },
  {
    image:
      'https://cdn.shadcnstudio.com/ss-assets/blocks/marketing/gallery/image-7.png',
    alt: 'Coastal cliffs at dusk',
  },
];

type Props = {
  params: Promise<{ locale: string }>;
};

const items = [
  {
    value: 'item-1',
    icon: <PackageIcon />,
    title: 'How do I track my order?',
    subtitle: 'Shipping & Delivery',
    content:
      'You can track your order by logging into your account and visiting the "Orders" section. You\'ll receive tracking information via email once your order ships.',
    media:
      'https://cdn.shadcnstudio.com/ss-assets/components/accordion/image-1.jpg?width=520&format=auto',
  },
  {
    value: 'item-2',
    icon: <RefreshCwIcon />,
    title: 'What is your return policy?',
    subtitle: 'Returns & Refunds',
    content:
      'We offer a 30-day return policy for most items. Products must be unused and in their original packaging.',
    media:
      'https://cdn.shadcnstudio.com/ss-assets/components/accordion/image-2.jpg?width=520&format=auto',
  },
  {
    value: 'item-3',
    icon: <HeadsetIcon />,
    title: 'How can I contact customer support?',
    subtitle: 'Help & Support',
    content:
      'Our customer support team is available 24/7 via live chat, email at support@example.com, or phone at 1-800-123-4567.',
    media:
      'https://cdn.shadcnstudio.com/ss-assets/components/accordion/image-3.jpg?width=520&format=auto',
  },
];

export default function PlaygroundPage({ params }: Props) {
  const { locale } = use(params);
  setRequestLocale(locale);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 p-8">
      <header className="flex flex-col gap-1">
        <span className="text-muted-foreground text-sm tracking-widest uppercase">
          Playground
        </span>
        <h1 className="text-foreground text-3xl font-semibold tracking-tight">
          MediaAccordion
        </h1>
        <p className="text-muted-foreground">
          Composable accordion (Base UI) with badge icon, subtitle, plus/minus
          toggle, theme-synced accent, and media content.
        </p>
      </header>

      <MediaAccordion multiple={false} defaultValue={['item-1']}>
        {items.map((item) => (
          <MediaAccordionItem key={item.value} value={item.value}>
            <MediaAccordionTrigger icon={item.icon} subtitle={item.subtitle}>
              {item.title}
            </MediaAccordionTrigger>
            <MediaAccordionContent media={item.media} mediaAlt={item.title}>
              {item.content}
            </MediaAccordionContent>
          </MediaAccordionItem>
        ))}
      </MediaAccordion>

      <section className="flex flex-col gap-4">
        <h2 className="text-foreground text-2xl font-semibold tracking-tight">
          Alert — click to trigger
        </h2>
        <AlertTriggerDemo />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-foreground text-2xl font-semibold tracking-tight">
          Alert Dialog — confirm with intent
        </h2>
        <p className="text-muted-foreground text-sm">
          The icon badge tone signals intent (destructive = red) while the
          action button color reinforces it.
        </p>
        <div>
          <AlertDialog>
            <AlertDialogTrigger render={<Button variant="destructive" />}>
              Delete account
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogMedia tone="destructive">
                  <Trash2Icon />
                </AlertDialogMedia>
                <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently deletes your account and removes your data
                  from our servers. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction variant="destructive">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-foreground text-2xl font-semibold tracking-tight">
          Aspect Ratio — named presets
        </h2>
        <p className="text-muted-foreground text-sm">
          Same image rendered with different frame-ratio presets.
        </p>
        <div className="grid grid-cols-3 gap-4">
          {(['square', 'video', 'portrait'] as AspectRatioPreset[]).map(
            (preset) => (
              <div key={preset} className="flex flex-col gap-2">
                <AspectRatio
                  ratio={preset}
                  className="overflow-hidden rounded-xl"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- external demo image */}
                  <img
                    src="https://cdn.shadcnstudio.com/ss-assets/components/accordion/image-1.jpg?width=520&format=auto"
                    alt={`${preset} ratio`}
                    className="size-full object-cover"
                  />
                </AspectRatio>
                <span className="text-muted-foreground text-center text-xs">
                  {preset}
                </span>
              </div>
            ),
          )}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-foreground text-2xl font-semibold tracking-tight">
          Avatar — status badge
        </h2>
        <div className="flex flex-wrap items-center gap-6">
          {AVATAR_STATUSES.map((status) => (
            <div key={status} className="flex flex-col items-center gap-2">
              <Avatar size="lg">
                <AvatarFallback>
                  {status.slice(0, 2).toUpperCase()}
                </AvatarFallback>
                <AvatarBadge status={status} />
              </Avatar>
              <span className="text-muted-foreground text-xs">{status}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-foreground text-2xl font-semibold tracking-tight">
          Badge — variants
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="destructive">Destructive</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="gradient">Gradient</Badge>
          <Badge variant="gradient-outline">Gradient Outline</Badge>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-foreground text-2xl font-semibold tracking-tight">
          Breadcrumb — auto + collapse
        </h2>
        <p className="text-muted-foreground text-sm">
          5 items with maxItems=4 → middle items collapse into a dropdown.
        </p>
        <BreadcrumbAuto
          items={[
            { label: 'Home', href: '/', icon: <HomeIcon className="size-4" /> },
            { label: 'Tours', href: '/tours' },
            { label: 'Vietnam', href: '/tours/vietnam' },
            { label: 'Northern', href: '/tours/vietnam/northern' },
            { label: 'Ha Long Bay' },
          ]}
        />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-foreground text-2xl font-semibold tracking-tight">
          Button — gradient variants + loading
        </h2>
        <ButtonDemo />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-foreground text-2xl font-semibold tracking-tight">
          Calendar — disablePast (booking)
        </h2>
        <p className="text-muted-foreground text-sm">
          Past dates are locked; today stays selectable.
        </p>
        <CalendarDemo />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-foreground text-2xl font-semibold tracking-tight">
          Tour Card — data-driven
        </h2>
        <TourCardDemo />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-foreground text-2xl font-semibold tracking-tight">
          Motion Carousel — animated gallery
        </h2>
        <p className="text-muted-foreground text-sm">
          Active slide scales up; dots morph into a labeled pill.
        </p>
        <MotionCarousel items={carouselItems} options={{ loop: true }} />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-foreground text-2xl font-semibold tracking-tight">
          Confetti Burst — reusable effect
        </h2>
        <p className="text-muted-foreground text-sm">
          Same primitive on a checkbox and a button.
        </p>
        <ConfettiDemo />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-foreground text-2xl font-semibold tracking-tight">
          Collapsible — animated content
        </h2>
        <Collapsible className="w-full max-w-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium">
              @tourism starred 3 repositories
            </span>
            <CollapsibleTrigger
              render={
                <Button variant="ghost" size="icon-sm">
                  <ChevronsUpDownIcon />
                </Button>
              }
            />
          </div>
          <div className="mt-2 rounded-md border px-4 py-2 font-mono text-sm">
            @tourism/ui
          </div>
          <CollapsibleContent className="mt-2 flex flex-col gap-2">
            <div className="rounded-md border px-4 py-2 font-mono text-sm">
              @tourism/web
            </div>
            <div className="rounded-md border px-4 py-2 font-mono text-sm">
              @tourism/admin
            </div>
          </CollapsibleContent>
        </Collapsible>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-foreground text-2xl font-semibold tracking-tight">
          Dropdown Menu — semantic variants
        </h2>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="outline">Row actions</Button>}
          />
          <DropdownMenuContent className="w-48">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem>
                <PencilIcon />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem variant="success">
                <CheckIcon />
                Approve
              </DropdownMenuItem>
              <DropdownMenuItem variant="warning">
                <ClockIcon />
                Set pending
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive">
              <Trash2Icon />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-foreground text-2xl font-semibold tracking-tight">
          Context Menu — right-click actions
        </h2>
        <ContextMenu>
          <ContextMenuTrigger className="text-muted-foreground flex h-24 w-full max-w-sm items-center justify-center rounded-2xl border border-dashed text-sm">
            Right-click here
          </ContextMenuTrigger>
          <ContextMenuContent className="w-48">
            <ContextMenuGroup>
              <ContextMenuLabel>Actions</ContextMenuLabel>
              <ContextMenuItem>
                <PencilIcon />
                Edit
              </ContextMenuItem>
              <ContextMenuItem variant="success">
                <CheckIcon />
                Approve
              </ContextMenuItem>
              <ContextMenuItem variant="warning">
                <ClockIcon />
                Set pending
              </ContextMenuItem>
            </ContextMenuGroup>
            <ContextMenuSeparator />
            <ContextMenuItem variant="destructive">
              <Trash2Icon />
              Delete
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-foreground text-2xl font-semibold tracking-tight">
          Dialog — media header
        </h2>
        <Dialog>
          <DialogTrigger
            render={<Button variant="outline">Open dialog</Button>}
          />
          <DialogContent>
            <DialogHeader className="items-center text-center">
              <DialogMedia tone="success">
                <CheckCheckIcon />
              </DialogMedia>
              <DialogTitle>Account verified!</DialogTitle>
              <DialogDescription>
                Your email has been verified successfully.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose
                render={<Button className="w-full">Continue</Button>}
              />
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-foreground text-2xl font-semibold tracking-tight">
          Stagger — sequential reveal
        </h2>
        <Stagger className="flex w-full max-w-sm flex-col gap-2">
          <div className="rounded-lg border px-4 py-2 text-sm">First item</div>
          <div className="rounded-lg border px-4 py-2 text-sm">Second item</div>
          <div className="rounded-lg border px-4 py-2 text-sm">Third item</div>
          <div className="rounded-lg border px-4 py-2 text-sm">Fourth item</div>
        </Stagger>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-foreground text-2xl font-semibold tracking-tight">
          Field Label — required & hint
        </h2>
        <div className="w-full max-w-xs space-y-4">
          <Field>
            <FieldLabel htmlFor="pg-email" required>
              Email
            </FieldLabel>
            <Input id="pg-email" type="email" placeholder="you@example.com" />
            <FieldDescription>
              We&apos;ll never share your email.
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="pg-phone" hint="Optional field">
              Phone
            </FieldLabel>
            <Input id="pg-phone" placeholder="+1 ..." />
          </Field>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-foreground text-2xl font-semibold tracking-tight">
          Date Range Picker
        </h2>
        <DateRangeDemo />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-foreground text-2xl font-semibold tracking-tight">
          Data Table — sort / paginate (admin)
        </h2>
        <DataTableDemo />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-foreground text-2xl font-semibold tracking-tight">
          Form — FormField + password
        </h2>
        <FormDemo />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-foreground text-2xl font-semibold tracking-tight">
          Phone Input — country-aware
        </h2>
        <PhoneDemo />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-foreground text-2xl font-semibold tracking-tight">
          Description List — entity details
        </h2>
        <div className="w-full max-w-md">
          <DescriptionList
            items={[
              { label: 'Duration', value: '2 days 1 night' },
              { label: 'Group size', value: 'Max 20' },
              { label: 'Difficulty', value: 'Easy' },
              { label: 'Meeting point', value: 'Hanoi Old Quarter' },
              { label: 'Category', value: 'Package' },
            ]}
          />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-foreground text-2xl font-semibold tracking-tight">
          Pagination Control — windowed
        </h2>
        <PaginationDemo />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-foreground text-2xl font-semibold tracking-tight">
          Stepper — composable multi-step
        </h2>
        <p className="text-muted-foreground text-sm">
          One composable component. Both layouts (numbered horizontal, vertical
          icon + description + side panel) compose the same parts. Keyboard:
          arrows / Home / End move focus, Enter / Space selects.
        </p>
        <StepperDemo />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-foreground text-2xl font-semibold tracking-tight">
          Rating — input & display
        </h2>
        <p className="text-muted-foreground text-sm">
          Controlled, half-star precision, and read-only display (Review.rating
          1–5).
        </p>
        <RatingDemo />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-foreground text-2xl font-semibold tracking-tight">
          Separator Label — line · content · line
        </h2>
        <div className="flex flex-col gap-6">
          <SeparatorLabel>OR</SeparatorLabel>
          <SeparatorLabel variant="dashed">
            <Badge variant="secondary">New</Badge>
          </SeparatorLabel>
          <SeparatorLabel variant="dotted">Continue with</SeparatorLabel>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-foreground text-2xl font-semibold tracking-tight">
          Shimmer Skeleton — loading placeholder
        </h2>
        <p className="text-muted-foreground text-sm">
          Sweeping shimmer; falls back to a static pulse under reduced-motion.
        </p>
        <div className="flex w-full max-w-sm items-center gap-4">
          <ShimmerSkeleton className="size-12 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <ShimmerSkeleton className="h-4 w-3/4" />
            <ShimmerSkeleton className="h-4 w-1/2" />
          </div>
        </div>
      </section>
    </main>
  );
}
