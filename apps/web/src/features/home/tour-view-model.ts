import type { components } from "@/lib/api/schema";
import type { TourCardProps, TourCategory } from "@tourism/ui/components/custom/tour-card";

/** Inner DTO shape returned (post-unwrap) by GET /tours items. */
export type ApiTour = components["schemas"]["TourWithStatsDto"];

const LOCALE_TAG: Record<string, string> = { en: "en-US", vi: "vi-VN" };

function heroUrl(media: ApiTour["media"]): string | undefined {
  return media.find((m) => m.role === "hero")?.url ?? media[0]?.url;
}

export function toTourCardModel(tour: ApiTour, locale: string): TourCardProps {
  return {
    href: `/tours/${tour.slug}`,
    title: locale === "vi" ? tour.titleVi : tour.titleEn,
    summary: (locale === "vi" ? tour.summaryVi : tour.summaryEn) ?? undefined,
    image: heroUrl(tour.media),
    price: Number(tour.basePrice),
    currency: tour.currency,
    locale: LOCALE_TAG[locale] ?? "en-US",
    durationDays: tour.durationDays,
    category: tour.category as TourCategory,
    featured: tour.isFeatured,
    rating: tour.averageRating ?? undefined,
    reviewCount: tour.reviewsCount,
  };
}
