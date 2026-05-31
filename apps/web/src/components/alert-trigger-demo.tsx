"use client";

import { useState, type ReactNode } from "react";
import {
  CheckCheckIcon,
  CircleXIcon,
  InfoIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@tourism/ui/components/custom/alert-custom";

type AlertVariant = "success" | "destructive" | "warning" | "default";

interface AlertConfig {
  variant: AlertVariant;
  label: string;
  buttonClass: string;
  icon: ReactNode;
  title: string;
  description: string;
}

const alerts: AlertConfig[] = [
  {
    variant: "success",
    label: "Success",
    buttonClass:
      "border-green-600/50 text-green-600 hover:bg-green-600/10 dark:border-green-400/50 dark:text-green-400",
    icon: <CheckCheckIcon />,
    title: "Account created successfully",
    description: "You are all set! You can now log in and start exploring.",
  },
  {
    variant: "destructive",
    label: "Error",
    buttonClass: "border-destructive/50 text-destructive hover:bg-destructive/10",
    icon: <CircleXIcon />,
    title: "Payment failed",
    description: "Your card was declined. Please try a different payment method.",
  },
  {
    variant: "warning",
    label: "Warning",
    buttonClass:
      "border-amber-600/50 text-amber-600 hover:bg-amber-600/10 dark:border-amber-400/50 dark:text-amber-400",
    icon: <TriangleAlertIcon />,
    title: "Your subscription expires soon",
    description: "Renew within 3 days to avoid losing access to premium features.",
  },
  {
    variant: "default",
    label: "Info",
    buttonClass: "border-border text-foreground hover:bg-muted",
    icon: <InfoIcon />,
    title: "A new version is available",
    description: "Refresh the page to get the latest updates and improvements.",
  },
];

export function AlertTriggerDemo() {
  const [active, setActive] = useState<AlertVariant | null>(null);

  const current = alerts.find((alert) => alert.variant === active) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        {alerts.map((alert) => (
          <button
            key={alert.variant}
            type="button"
            onClick={() => setActive(alert.variant)}
            className={`cursor-pointer rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${alert.buttonClass}`}
          >
            {alert.label}
          </button>
        ))}
      </div>

      {current ? (
        <Alert variant={current.variant}>
          {current.icon}
          <AlertTitle>{current.title}</AlertTitle>
          <AlertDescription>{current.description}</AlertDescription>
          <AlertAction>
            <button
              type="button"
              className="cursor-pointer"
              onClick={() => setActive(null)}
            >
              <XIcon className="size-4" />
              <span className="sr-only">Close</span>
            </button>
          </AlertAction>
        </Alert>
      ) : (
        <p className="text-muted-foreground text-sm">
          Click a button to trigger its alert.
        </p>
      )}
    </div>
  );
}
