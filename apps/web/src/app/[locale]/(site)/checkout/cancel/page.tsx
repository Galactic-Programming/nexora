import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function CheckoutCancelPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ code?: string }>;
}) {
  const { locale } = await params;
  const { code } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("Booking");
  return (
    <main className="mx-auto max-w-2xl px-4 py-14">
      <h1 className="font-heading text-2xl font-semibold">{t("cancel.title")}</h1>
      <p className="text-muted-foreground mt-2">{t("cancel.body")}</p>
      {code ? (
        <p className="mt-4 text-sm">
          {t("cancel.code")}:{" "}
          <span className="font-mono font-semibold">{code}</span>
        </p>
      ) : null}
      <Link href="/tours" className="mt-6 inline-block underline">
        {t("cancel.retry")}
      </Link>
    </main>
  );
}
