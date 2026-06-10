import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@tourism/ui/components/custom/button-custom";

export default function NotFound() {
  const t = useTranslations("NotFound");
  return (
    <main className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="text-muted-foreground">{t("description")}</p>
      <Button nativeButton={false} render={<Link href="/" />}>
        {t("home")}
      </Button>
    </main>
  );
}
