import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getDestination } from "@/lib/api/destinations";
import { listTours } from "@/lib/api/tours";
import { ApiError } from "@/lib/api/errors";
import { toDestinationModel } from "@/features/destinations/destination-view-model";
import { DestinationDetail } from "@/features/destinations/destination-detail";
import type { ApiTour } from "@/features/home/tour-view-model";

type Props = { params: Promise<{ locale: string; slug: string }> };

export default async function DestinationDetailPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Destinations");

  let dest: Awaited<ReturnType<typeof getDestination>>;
  try {
    dest = await getDestination(slug);
  } catch (err) {
    if (ApiError.isApiError(err) && err.status === 404) notFound();
    throw err;
  }

  // Tours in this destination are non-critical; degrade to empty on failure.
  const { tours } = await listTours({
    page: 1,
    pageSize: 6,
    sortBy: "createdAt",
    sortOrder: "desc",
    destination: slug,
  }).catch(() => ({ tours: [] as ApiTour[], meta: { page: 1, pageSize: 6, total: 0, totalPages: 0 } }));

  return (
    <DestinationDetail
      destination={toDestinationModel(dest, locale)}
      tours={tours}
      locale={locale}
      text={{
        eyebrow: t("eyebrow"),
        toursTitle: (name) => t("toursTitle", { name }),
        toursEmpty: t("toursEmpty"),
      }}
    />
  );
}
