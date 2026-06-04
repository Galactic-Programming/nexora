import { use, Suspense } from "react";
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { Hero } from "@/features/home/hero";
import { FeaturedTours } from "@/features/home/featured-tours";

type Props = { params: Promise<{ locale: string }> };

export default function Home({ params }: Props) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations("HomePage");

  return (
    <main className="flex flex-col">
      <Hero />
      <section className="mx-auto w-full max-w-6xl px-4 pb-20">
        <h2 className="mb-6 text-2xl font-semibold tracking-tight">{t("featuredTitle")}</h2>
        <Suspense fallback={<p className="text-muted-foreground py-10 text-center">…</p>}>
          <FeaturedTours emptyLabel={t("featuredEmpty")} />
        </Suspense>
      </section>
    </main>
  );
}
