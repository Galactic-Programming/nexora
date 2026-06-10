"use client";

import { useTranslations } from "next-intl";
import { Button } from "@tourism/ui/components/custom/button-custom";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("Error");
  return (
    <main className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="text-muted-foreground">{t("description")}</p>
      <Button onClick={reset}>{t("retry")}</Button>
    </main>
  );
}
