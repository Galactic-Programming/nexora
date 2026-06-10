import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import {
  getTour,
  getTourDepartures,
  getTourReviews,
  type TourDetail as TourDetailDto,
} from "@/lib/api/tours";
import { ApiError } from "@/lib/api/errors";
import {
  toTourDetailModel,
  toDepartureModel,
  toReviewModel,
} from "@/features/tour-detail/detail-view-model";
import { TourDetail } from "@/features/tour-detail/tour-detail";

type Props = { params: Promise<{ locale: string; slug: string }> };

export default async function TourDetailPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("TourDetail");

  let detail: TourDetailDto;
  try {
    detail = await getTour(slug);
  } catch (err) {
    if (ApiError.isApiError(err) && err.status === 404) notFound();
    throw err;
  }

  // Departures and reviews are non-critical: if either sub-resource fails we
  // degrade to empty rather than failing the whole page (the primary getTour
  // above already hard-fails to the error boundary / notFound). The catches
  // intentionally swallow all errors for graceful degradation in B2.
  const [departuresRaw, reviewsRes] = await Promise.all([
    getTourDepartures(slug).catch(() => []),
    getTourReviews(slug).catch(() => ({
      reviews: [],
      averageRating: null,
      meta: { page: 1, pageSize: 0, total: 0, totalPages: 0 },
    })),
  ]);

  const tour = toTourDetailModel(detail, locale);
  const departures = departuresRaw.map((d) => toDepartureModel(d, detail, locale));
  const reviews = reviewsRes.reviews.map((r) => toReviewModel(r, locale));

  return (
    <TourDetail
      tour={tour}
      departures={departures}
      reviews={reviews}
      averageRating={reviewsRes.averageRating}
      text={{
        eyebrow: t("eyebrow"),
        tabs: {
          information: t("tabInformation"),
          plan: t("tabPlan"),
          location: t("tabLocation"),
          gallery: t("tabGallery"),
        },
        info: {
          title: t("infoTitle"),
          destination: t("destination"),
          duration: t("duration"),
          groupSize: t("groupSize"),
          category: t("category"),
          meetingPoint: t("meetingPoint"),
          included: t("included"),
          excluded: t("excluded"),
          days: (n) => t("days", { count: n }),
          people: (n) => t("people", { count: n }),
        },
        booking: {
          title: t("bookTitle"),
          bookNow: t("bookNow"),
          seatsLeft: (n) => t("seatsLeft", { count: n }),
          empty: t("departuresEmpty"),
          from: t("from"),
        },
        plan: { title: t("planTitle"), empty: t("planEmpty") },
        location: { title: t("locationTitle"), meetingLabel: t("meetingPoint") },
        gallery: { title: t("galleryTitle"), empty: t("galleryEmpty") },
        reviews: { title: t("reviewsTitle"), empty: t("reviewsEmpty"), average: t("average") },
      }}
    />
  );
}
