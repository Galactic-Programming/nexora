"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const LOCALE_LABELS: Record<string, string> = {
  en: "EN",
  vi: "VI",
};

export function LocaleSwitcher() {
  const t = useTranslations("LocaleSwitcher");
  const activeLocale = useLocale();
  const pathname = usePathname();

  return (
    <nav aria-label={t("label")} className="flex items-center gap-3 text-sm">
      {routing.locales.map((locale) => {
        const isActive = locale === activeLocale;
        return (
          <Link
            key={locale}
            href={pathname}
            locale={locale}
            aria-current={isActive ? "true" : undefined}
            className={
              isActive
                ? "text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground transition-colors"
            }
          >
            {LOCALE_LABELS[locale] ?? locale.toUpperCase()}
          </Link>
        );
      })}
    </nav>
  );
}
