import { StarIcon } from "lucide-react";
import { Badge } from "@tourism/ui/components/custom/badge-custom";
import type { TourDetailVM } from "./detail-view-model";

interface Labels {
  title: string;
  destination: string; duration: string; groupSize: string; category: string; meetingPoint: string;
  included: string; excluded: string;
  days: (n: number) => string; people: (n: number) => string;
}

export function TourInfo({ tour, labels }: { tour: TourDetailVM; labels: Labels }) {
  const rows: [string, string][] = [
    [labels.destination, [tour.destination.name, tour.destination.region, tour.destination.country].filter(Boolean).join(", ")],
    [labels.duration, labels.days(tour.durationDays)],
    [labels.groupSize, labels.people(tour.maxGroupSize)],
    [labels.category, tour.category],
    ...(tour.meetingPoint ? ([[labels.meetingPoint, tour.meetingPoint]] as [string, string][]) : []),
  ];
  return (
    <section id="information" className="flex-1">
      <h2 className="font-heading text-3xl font-semibold tracking-tight">{labels.title}</h2>
      {tour.rating !== undefined && (
        <p className="text-muted-foreground mt-1 flex items-center gap-1 text-sm">
          <StarIcon className="size-4 fill-current" aria-hidden="true" /> {tour.rating.toFixed(1)} · {tour.reviewCount}
        </p>
      )}
      {tour.summary && <p className="text-muted-foreground mt-4 max-w-prose">{tour.summary}</p>}
      <dl className="mt-6 grid grid-cols-1 gap-y-3 sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex flex-col">
            <dt className="text-muted-foreground text-xs tracking-wide uppercase">{k}</dt>
            <dd className="text-sm font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      {tour.included.length > 0 && (
        <div className="mt-6">
          <p className="mb-2 text-sm font-medium">{labels.included}</p>
          <div className="flex flex-wrap gap-2">
            {tour.included.map((i) => <Badge key={i} variant="secondary">{i}</Badge>)}
          </div>
        </div>
      )}
      {tour.excluded.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-sm font-medium">{labels.excluded}</p>
          <div className="flex flex-wrap gap-2">
            {tour.excluded.map((i) => <Badge key={i} variant="outline">{i}</Badge>)}
          </div>
        </div>
      )}
    </section>
  );
}
