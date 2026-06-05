import { MapPinIcon } from "lucide-react";
import type { TourDetailVM } from "./detail-view-model";

export function TourLocation({ tour, title, meetingLabel }: { tour: TourDetailVM; title: string; meetingLabel: string }) {
  return (
    <section id="location" className="mx-auto max-w-6xl px-4 py-12">
      <h2 className="font-heading mb-6 text-2xl font-semibold">{title}</h2>
      <div className="border-border flex items-start gap-3 rounded-2xl border p-6">
        <MapPinIcon className="text-muted-foreground mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <div>
          <p className="font-medium">
            {[tour.destination.name, tour.destination.region, tour.destination.country].filter(Boolean).join(", ")}
          </p>
          {tour.meetingPoint && (
            <p className="text-muted-foreground mt-1 text-sm">{meetingLabel}: {tour.meetingPoint}</p>
          )}
          {tour.destination.description && (
            <p className="text-muted-foreground mt-2 max-w-prose text-sm">{tour.destination.description}</p>
          )}
        </div>
      </div>
    </section>
  );
}
