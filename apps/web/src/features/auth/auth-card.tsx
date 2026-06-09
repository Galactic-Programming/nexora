import type { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@tourism/ui/components/legacy/card";
import AuthBackgroundShape from "@tourism/ui/assets/svg/auth-background-shape";

interface AuthCardProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}

/** Centered auth card with the shared decorative background (adapted from
 *  shadcn-studio blocks; brand-neutral, no "Shadcn Studio" copy). */
export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <div className="relative flex min-h-[80vh] items-center justify-center overflow-x-hidden px-4 py-10">
      <div className="pointer-events-none absolute" aria-hidden="true">
        <AuthBackgroundShape />
      </div>
      <Card className="z-1 w-full gap-6 py-6 sm:max-w-md">
        <CardHeader className="gap-2 px-6">
          <CardTitle className="text-2xl font-semibold">{title}</CardTitle>
          <CardDescription className="text-base">{subtitle}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 px-6">
          {children}
          {footer}
        </CardContent>
      </Card>
    </div>
  );
}
