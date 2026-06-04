import { setRequestLocale, getTranslations } from "next-intl/server";
import { listTours } from "@/lib/api/tours";
import { parseToursQuery } from "@/features/tours/tours-query";
import { ToursArchive } from "@/features/tours/tours-archive";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ToursPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("ToursArchive");

  const query = parseToursQuery(await searchParams);
  const { tours, meta } = await listTours(query);

  return (
    <ToursArchive
      tours={tours}
      meta={meta}
      locale={locale}
      text={{
        eyebrow: t("eyebrow"),
        title: t("title"),
        resultsCount: (n) => t("resultsCount", { count: n }),
        emptyLabel: t("empty"),
        sort: {
          date: t("sortDate"),
          priceAsc: t("sortPriceAsc"),
          priceDesc: t("sortPriceDesc"),
          name: t("sortName"),
        },
        filter: {
          title: t("filterTitle"),
          searchPlaceholder: t("searchPlaceholder"),
          minPrice: t("minPrice"),
          maxPrice: t("maxPrice"),
          apply: t("apply"),
          clear: t("clear"),
        },
        paginationAria: t("paginationAria"),
      }}
    />
  );
}
