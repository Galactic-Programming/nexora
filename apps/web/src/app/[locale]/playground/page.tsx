import { use } from "react";
import { setRequestLocale } from "next-intl/server";
import {
  CheckCheckIcon,
  CircleXIcon,
  HeadsetIcon,
  InfoIcon,
  PackageIcon,
  RefreshCwIcon,
  TriangleAlertIcon,
} from "lucide-react";
import {
  MediaAccordion,
  MediaAccordionContent,
  MediaAccordionItem,
  MediaAccordionTrigger,
} from "@tourism/ui/components/custom/accordion-custom";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@tourism/ui/components/custom/alert-custom";

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
          Alert — 4 variants
        </h2>

        <Alert variant="success">
          <CheckCheckIcon />
          <AlertTitle>Account created successfully</AlertTitle>
          <AlertDescription>
            You are all set! You can now log in and start exploring.
          </AlertDescription>
        </Alert>

        <Alert variant="destructive">
          <CircleXIcon />
          <AlertTitle>Payment failed</AlertTitle>
          <AlertDescription>
            Your card was declined. Please try a different payment method.
          </AlertDescription>
        </Alert>

        <Alert variant="warning">
          <TriangleAlertIcon />
          <AlertTitle>Your subscription expires soon</AlertTitle>
          <AlertDescription>
            Renew within 3 days to avoid losing access to premium features.
          </AlertDescription>
        </Alert>

        <Alert variant="default">
          <InfoIcon />
          <AlertTitle>A new version is available</AlertTitle>
          <AlertDescription>
            Refresh the page to get the latest updates and improvements.
          </AlertDescription>
        </Alert>
      </section>
    </main>
  );
}
