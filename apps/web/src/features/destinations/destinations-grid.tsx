import { DestinationCard } from "./destination-card";
import type { DestinationVM } from "./destination-view-model";

export function DestinationsGrid({
  destinations,
  emptyLabel,
}: {
  destinations: DestinationVM[];
  emptyLabel: string;
}) {
  if (destinations.length === 0) {
    return <p className="text-muted-foreground py-16 text-center">{emptyLabel}</p>;
  }
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {destinations.map((d) => (
        <DestinationCard key={d.slug} destination={d} />
      ))}
    </div>
  );
}
