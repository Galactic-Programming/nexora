import { getTranslations } from "next-intl/server";

import {
  Avatar,
  AvatarFallback,
} from "@tourism/ui/components/custom/avatar-custom";
import type { User } from "@/lib/api/users";

function initials(user: Pick<User, "fullName" | "email">): string {
  const source = user.fullName?.trim() || user.email;
  return source.slice(0, 2).toUpperCase();
}

export async function IdentityBlock({
  user,
  locale,
}: {
  user: User;
  locale: string;
}) {
  const t = await getTranslations("Account");
  const memberSince = new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
  }).format(new Date(user.createdAt));

  return (
    <section
      aria-label={t("identity.heading")}
      className="flex items-center gap-4 rounded-lg border border-border bg-muted/30 p-4"
    >
      <Avatar>
        <AvatarFallback>{initials(user)}</AvatarFallback>
      </Avatar>
      <dl className="grid gap-1 text-sm">
        <div className="flex gap-2">
          <dt className="text-muted-foreground">{t("identity.email")}:</dt>
          <dd className="font-medium text-foreground">{user.email}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted-foreground">{t("identity.role")}:</dt>
          <dd className="text-foreground">{t(`role.${user.role}`)}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted-foreground">
            {t("identity.memberSince")}:
          </dt>
          <dd className="text-foreground">{memberSince}</dd>
        </div>
      </dl>
    </section>
  );
}
