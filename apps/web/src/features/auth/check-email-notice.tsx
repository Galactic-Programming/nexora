"use client";

import { useTranslations } from "next-intl";

/** Shared "we sent you a link" panel (sign-up + forgot). */
export function CheckEmailNotice({ email }: { email: string }) {
  const t = useTranslations("Auth");
  return (
    <div className="space-y-2 text-center" role="status">
      <h2 className="text-lg font-semibold">{t("checkEmailTitle")}</h2>
      <p className="text-muted-foreground text-sm">{t("checkEmailBody", { email })}</p>
    </div>
  );
}
