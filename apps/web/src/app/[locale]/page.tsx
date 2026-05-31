import { use } from "react";
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { Button } from "@tourism/ui/components/button";
import { LocaleSwitcher } from "@/components/locale-switcher";

type Props = {
  params: Promise<{ locale: string }>;
};

export default function Home({ params }: Props) {
  const { locale } = use(params);

  // Enable static rendering before calling next-intl hooks.
  setRequestLocale(locale);

  const t = useTranslations("HomePage");

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 p-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="text-muted-foreground text-sm tracking-widest uppercase">
          {t("eyebrow")}
        </span>
        <h1 className="text-foreground text-4xl font-semibold tracking-tight">
          {t("title")}
        </h1>
        <p className="text-muted-foreground max-w-md">{t("description")}</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button>{t("explore")}</Button>
        <Button variant="outline">{t("signIn")}</Button>
        <Button variant="secondary">{t("learnMore")}</Button>
      </div>
      <LocaleSwitcher />
    </main>
  );
}
