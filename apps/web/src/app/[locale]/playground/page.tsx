import { use } from "react";
import { setRequestLocale } from "next-intl/server";
import {
  HeadsetIcon,
  HomeIcon,
  PackageIcon,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react";
import {
  MediaAccordion,
  MediaAccordionContent,
  MediaAccordionItem,
  MediaAccordionTrigger,
} from "@tourism/ui/components/custom/accordion-custom";
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
} from "@tourism/ui/components/custom/alert-dialog-custom";
import { Button } from "@tourism/ui/components/legacy/button";
import {
  AspectRatio,
  type AspectRatioPreset,
} from "@tourism/ui/components/custom/aspect-ratio-custom";
import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
} from "@tourism/ui/components/custom/avatar-custom";
import { Badge } from "@tourism/ui/components/custom/badge-custom";
import { BreadcrumbAuto } from "@tourism/ui/components/custom/breadcrumb-custom";
import { AlertTriggerDemo } from "@/components/alert-trigger-demo";
import { ButtonDemo } from "@/components/button-demo";
import { CalendarDemo } from "@/components/calendar-demo";
import { TourCardDemo } from "@/components/tour-card-demo";

const AVATAR_STATUSES = ["active", "onboard", "block", "inactive"] as const;

type Props = {
  params: Promise<{ locale: string }>;
};

const items = [
  {
    value: "item-1",
    icon: <PackageIcon />,
    title: "How do I track my order?",
    subtitle: "Shipping & Delivery",
    content:
      "You can track your order by logging into your account and visiting the \"Orders\" section. You'll receive tracking information via email once your order ships.",
    media:
      "https://cdn.shadcnstudio.com/ss-assets/components/accordion/image-1.jpg?width=520&format=auto",
  },
  {
    value: "item-2",
    icon: <RefreshCwIcon />,
    title: "What is your return policy?",
    subtitle: "Returns & Refunds",
    content:
      "We offer a 30-day return policy for most items. Products must be unused and in their original packaging.",
    media:
      "https://cdn.shadcnstudio.com/ss-assets/components/accordion/image-2.jpg?width=520&format=auto",
  },
  {
    value: "item-3",
    icon: <HeadsetIcon />,
    title: "How can I contact customer support?",
    subtitle: "Help & Support",
    content:
      "Our customer support team is available 24/7 via live chat, email at support@example.com, or phone at 1-800-123-4567.",
    media:
      "https://cdn.shadcnstudio.com/ss-assets/components/accordion/image-3.jpg?width=520&format=auto",
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

      <MediaAccordion multiple={false} defaultValue={["item-1"]}>
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
          {(["square", "video", "portrait"] as AspectRatioPreset[]).map(
            (preset) => (
              <div key={preset} className="flex flex-col gap-2">
                <AspectRatio ratio={preset} className="overflow-hidden rounded-xl">
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
                <AvatarFallback>{status.slice(0, 2).toUpperCase()}</AvatarFallback>
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
            { label: "Home", href: "/", icon: <HomeIcon className="size-4" /> },
            { label: "Tours", href: "/tours" },
            { label: "Vietnam", href: "/tours/vietnam" },
            { label: "Northern", href: "/tours/vietnam/northern" },
            { label: "Ha Long Bay" },
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
    </main>
  );
}
