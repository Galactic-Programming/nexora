import { setRequestLocale, getTranslations } from "next-intl/server";
import { listDestinations } from "@/lib/api/destinations";
import { parseDestinationsQuery } from "@/features/destinations/destinations-query";
import { toDestinationModel } from "@/features/destinations/destination-view-model";
import { DestinationsArchive } from "@/features/destinations/destinations-archive";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DestinationsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Destinations");

  const query = parseDestinationsQuery(await searchParams);
  const { destinations, meta } = await listDestinations(query);

  return (
    <DestinationsArchive
      destinations={destinations.map((d) => toDestinationModel(d, locale))}
      total={meta.total}
      totalPages={meta.totalPages}
      text={{
        eyebrow: t("eyebrow"),
        title: t("title"),
        resultsCount: (n) => t("resultsCount", { count: n }),
        empty: t("empty"),
        searchPlaceholder: t("searchPlaceholder"),
        search: t("search"),
        paginationAria: t("paginationAria"),
      }}
    />
  );
}
