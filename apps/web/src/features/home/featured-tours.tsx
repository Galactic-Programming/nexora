import { getLocale } from "next-intl/server";
import { TourCard } from "@tourism/ui/components/custom/tour-card";
import { createApiClient } from "@/lib/api/client";
import { toTourCardModel, type ApiTour } from "./tour-view-model";

export function FeaturedToursList({
  tours,
  locale,
  emptyLabel,
}: {
  tours: ApiTour[];
  locale: string;
  emptyLabel: string;
}) {
  if (tours.length === 0) {
    return <p className="text-muted-foreground py-10 text-center">{emptyLabel}</p>;
  }
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {tours.map((tour) => (
        <TourCard key={tour.slug} className="max-w-none" {...toTourCardModel(tour, locale)} />
      ))}
    </div>
  );
}

/** Server Component: fetches featured tours and renders the list. */
export async function FeaturedTours({ emptyLabel }: { emptyLabel: string }) {
  const locale = await getLocale();
  const api = createApiClient();
  const { data } = await api.GET("/api/v1/tours", {
    params: { query: { featured: true, pageSize: 6 } },
  });
  const tours = (data ?? []) as unknown as ApiTour[];
  return <FeaturedToursList tours={tours} locale={locale} emptyLabel={emptyLabel} />;
}
