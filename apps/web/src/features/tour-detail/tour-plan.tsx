import type { ItineraryVM } from "./detail-view-model";

export function TourPlan({ days, title, emptyLabel }: { days: ItineraryVM[]; title: string; emptyLabel: string }) {
  return (
    <section id="plan" className="mx-auto max-w-6xl px-4 py-12">
      <h2 className="font-heading mb-6 text-2xl font-semibold">{title}</h2>
      {days.length === 0 ? (
        <p className="text-muted-foreground py-8">{emptyLabel}</p>
      ) : (
        <ol className="border-border ml-3 border-l">
          {days.map((d) => (
            <li key={d.day} className="relative pb-8 pl-6 last:pb-0">
              <span className="bg-foreground text-background absolute -left-3 flex size-6 items-center justify-center rounded-full text-xs">
                {d.day}
              </span>
              <h3 className="font-medium">{d.title}</h3>
              {d.description && <p className="text-muted-foreground text-sm">{d.description}</p>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
