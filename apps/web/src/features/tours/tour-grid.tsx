import { TourCard } from "@tourism/ui/components/custom/tour-card";
import { toTourCardModel, type ApiTour } from "@/features/home/tour-view-model";

interface TourGridProps {
  tours: ApiTour[];
  locale: string;
  emptyLabel: string;
}

export function TourGrid({ tours, locale, emptyLabel }: TourGridProps) {
  if (tours.length === 0) {
    return <p className="text-muted-foreground py-16 text-center">{emptyLabel}</p>;
  }
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
      {tours.map((tour) => (
        <TourCard key={tour.slug} className="max-w-none" {...toTourCardModel(tour, locale)} />
      ))}
    </div>
  );
}
