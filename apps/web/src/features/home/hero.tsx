import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@tourism/ui/components/custom/button-custom";

export function Hero() {
  const t = useTranslations("HomePage");
  return (
    <section className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-16 sm:py-24">
      <span className="text-muted-foreground text-sm tracking-widest uppercase">
        {t("eyebrow")}
      </span>
      <h1 className="text-foreground max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
        {t("title")}
      </h1>
      <p className="text-muted-foreground max-w-xl text-lg">{t("description")}</p>
      <div className="flex flex-wrap gap-3">
        <Button nativeButton={false} render={<Link href="/tours" />}>
          {t("explore")}
        </Button>
      </div>
    </section>
  );
}
