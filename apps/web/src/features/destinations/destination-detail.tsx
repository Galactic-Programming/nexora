import type { DestinationVM } from "./destination-view-model";
import type { ApiTour } from "@/features/home/tour-view-model";
import { DetailHero } from "@/features/tour-detail/detail-hero";
import { TourGrid } from "@/features/tours/tour-grid";

interface DestinationDetailText {
  eyebrow: string;
  toursTitle: (name: string) => string;
  toursEmpty: string;
}

export function DestinationDetail({
  destination,
  tours,
  locale,
  text,
}: {
  destination: DestinationVM;
  tours: ApiTour[];
  locale: string;
  text: DestinationDetailText;
}) {
  return (
    <main className="flex flex-col">
      <DetailHero image={destination.heroImage} eyebrow={text.eyebrow} title={destination.name} />
      <section aria-label={destination.name} className="mx-auto w-full max-w-6xl px-4 py-10">
        <p className="text-muted-foreground text-sm">
          {[destination.region, destination.country].filter(Boolean).join(", ")}
        </p>
        {destination.description && (
          <p className="mt-3 max-w-prose">{destination.description}</p>
        )}
      </section>
      <section className="mx-auto w-full max-w-6xl px-4 pb-16">
        <h2 className="font-heading mb-6 text-2xl font-semibold">
          {text.toursTitle(destination.name)}
        </h2>
        <TourGrid tours={tours} locale={locale} emptyLabel={text.toursEmpty} />
      </section>
    </main>
  );
}
