import type { DepartureVM } from "./detail-view-model";

interface Text {
  title: string;
  bookNow: string;
  seatsLeft: (n: number) => string;
  empty: string;
  from: string;
}

export function BookingSidebar({
  departures, currency, localeTag, text,
}: {
  departures: DepartureVM[];
  currency: string;
  localeTag: string;
  text: Text;
}) {
  const money = (n: number) =>
    new Intl.NumberFormat(localeTag, { style: "currency", currency }).format(n);
  const day = (d: string) =>
    new Intl.DateTimeFormat(localeTag, { dateStyle: "medium" }).format(new Date(d));

  return (
    <aside className="border-border bg-muted/30 sticky top-20 rounded-2xl border p-6">
      <h2 className="font-heading mb-4 text-xl font-semibold">{text.title}</h2>
      {departures.length === 0 ? (
        <p className="text-muted-foreground py-4 text-sm">{text.empty}</p>
      ) : (
        <ul className="mb-4 flex flex-col gap-3">
          {departures.map((d) => (
            <li key={d.id} className="border-border flex items-center justify-between rounded-xl border px-3 py-2">
              <div>
                <p className="text-sm font-medium">{day(d.startDate)} → {day(d.endDate)}</p>
                <p className="text-muted-foreground text-xs">{text.seatsLeft(d.seatsLeft)}</p>
              </div>
              <span className="text-sm font-semibold">{money(d.price)}</span>
            </li>
          ))}
        </ul>
      )}
      {/* Booking flow is phase D — CTA is intentionally disabled for now. */}
      <button
        type="button"
        disabled
        className="bg-foreground text-background w-full cursor-not-allowed rounded-md py-2.5 text-sm font-medium opacity-60"
      >
        {text.bookNow}
      </button>
    </aside>
  );
}
