import type { TourDetail, Departure, PublicReview } from "@/lib/api/tours";

const LOCALE_TAG: Record<string, string> = { en: "en-US", vi: "vi-VN" };
const isVi = (locale: string) => locale === "vi";

function heroUrl(media: TourDetail["media"]): string | undefined {
  return media.find((m) => m.role === "hero")?.url ?? media[0]?.url;
}

export interface ItineraryVM {
  day: number;
  title: string;
  description?: string;
}

export interface TourDetailVM {
  slug: string;
  title: string;
  summary?: string;
  heroImage?: string;
  gallery: string[];
  rating?: number;
  reviewCount: number;
  price: number;
  currency: string;
  durationDays: number;
  maxGroupSize: number;
  category: string;
  meetingPoint?: string;
  included: string[];
  excluded: string[];
  localeTag: string;
  destination: { name: string; region?: string; country: string; description?: string };
  itinerary: ItineraryVM[];
}

export function toTourDetailModel(tour: TourDetail, locale: string): TourDetailVM {
  const vi = isVi(locale);
  return {
    slug: tour.slug,
    title: vi ? tour.titleVi : tour.titleEn,
    summary: (vi ? tour.summaryVi : tour.summaryEn) ?? undefined,
    heroImage: heroUrl(tour.media),
    gallery: tour.media.map((m) => m.url),
    rating: tour.averageRating ?? undefined,
    reviewCount: tour.reviewsCount,
    price: Number(tour.basePrice),
    currency: tour.currency,
    durationDays: tour.durationDays,
    maxGroupSize: tour.maxGroupSize,
    category: tour.category,
    meetingPoint: tour.meetingPoint ?? undefined,
    included: tour.included,
    excluded: tour.excluded,
    localeTag: LOCALE_TAG[locale] ?? "en-US",
    destination: {
      name: vi ? tour.destination.nameVi : tour.destination.nameEn,
      region: tour.destination.region ?? undefined,
      country: tour.destination.country,
      description:
        (vi ? tour.destination.descriptionVi : tour.destination.descriptionEn) ?? undefined,
    },
    itinerary: [...tour.itinerary]
      .sort((a, b) => a.dayNumber - b.dayNumber)
      .map((d) => ({
        day: d.dayNumber,
        title: vi ? d.titleVi : d.titleEn,
        description: (vi ? d.descriptionVi : d.descriptionEn) ?? undefined,
      })),
  };
}

export interface DepartureVM {
  id: string;
  startDate: string;
  endDate: string;
  seatsLeft: number;
  soldOut: boolean;
  price: number;
}

export function toDepartureModel(dep: Departure, tour: TourDetail, _locale: string): DepartureVM {
  const seatsLeft = dep.seatsTotal - dep.seatsBooked;
  return {
    id: dep.id,
    startDate: dep.startDate,
    endDate: dep.endDate,
    seatsLeft,
    soldOut: seatsLeft <= 0,
    price: Number(dep.priceOverride ?? tour.basePrice),
  };
}

export interface ReviewVM {
  id: string;
  rating: number;
  title?: string;
  body: string;
  author: string;
  date: string;
}

export function toReviewModel(r: PublicReview, _locale: string): ReviewVM {
  return {
    id: r.id,
    rating: r.rating,
    title: r.title ?? undefined,
    body: r.body,
    author: r.userFullName ?? "Anonymous",
    date: r.createdAt,
  };
}
