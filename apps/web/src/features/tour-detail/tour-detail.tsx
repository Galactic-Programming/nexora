import type { TourDetailVM, DepartureVM, ReviewVM } from "./detail-view-model";
import { DetailHero } from "./detail-hero";
import { DetailTabNav } from "./detail-tab-nav";
import { TourInfo } from "./tour-info";
import { BookingSidebar } from "./booking-sidebar";
import { TourPlan } from "./tour-plan";
import { TourLocation } from "./tour-location";
import { TourGallery } from "./tour-gallery";
import { TourReviews } from "./tour-reviews";

export interface DetailText {
  eyebrow: string;
  tabs: { information: string; plan: string; location: string; gallery: string };
  info: {
    title: string;
    destination: string;
    duration: string;
    groupSize: string;
    category: string;
    meetingPoint: string;
    included: string;
    excluded: string;
    days: (n: number) => string;
    people: (n: number) => string;
  };
  booking: { title: string; bookNow: string; seatsLeft: (n: number) => string; empty: string; from: string };
  plan: { title: string; empty: string };
  location: { title: string; meetingLabel: string };
  gallery: { title: string; empty: string };
  reviews: { title: string; empty: string; average: string };
}

export function TourDetail({
  tour,
  departures,
  reviews,
  averageRating,
  text,
}: {
  tour: TourDetailVM;
  departures: DepartureVM[];
  reviews: ReviewVM[];
  averageRating: number | null;
  text: DetailText;
}) {
  return (
    <main className="flex flex-col">
      <DetailHero image={tour.heroImage} eyebrow={text.eyebrow} title={tour.title} />
      <DetailTabNav
        items={[
          { href: "#information", label: text.tabs.information },
          { href: "#plan", label: text.tabs.plan },
          { href: "#location", label: text.tabs.location },
          { href: "#gallery", label: text.tabs.gallery },
        ]}
      />
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-10 px-4 py-12 lg:grid-cols-[1fr_340px]">
        <TourInfo tour={tour} labels={text.info} />
        <BookingSidebar
          departures={departures}
          currency={tour.currency}
          localeTag={tour.localeTag}
          text={text.booking}
        />
      </div>
      <TourPlan days={tour.itinerary} title={text.plan.title} emptyLabel={text.plan.empty} />
      <TourLocation tour={tour} title={text.location.title} meetingLabel={text.location.meetingLabel} />
      <TourGallery images={tour.gallery} title={text.gallery.title} emptyLabel={text.gallery.empty} />
      <TourReviews
        reviews={reviews}
        averageRating={averageRating}
        reviewCount={tour.reviewCount}
        text={text.reviews}
        localeTag={tour.localeTag}
      />
    </main>
  );
}
