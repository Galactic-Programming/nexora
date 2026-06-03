import { useTranslations } from "next-intl";

export function SiteFooter() {
  const t = useTranslations("Footer");
  return (
    <footer className="border-border/60 mt-auto border-t">
      <div className="text-muted-foreground mx-auto flex max-w-6xl flex-col gap-1 px-4 py-8 text-sm">
        <span className="text-foreground font-semibold">{t("brand")}</span>
        <span>{t("tagline")}</span>
        <span>
          © {new Date().getFullYear()} {t("brand")}. {t("rights")}
        </span>
      </div>
    </footer>
  );
}
