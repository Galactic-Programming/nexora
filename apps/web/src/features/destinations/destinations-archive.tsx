import type { DestinationVM } from "./destination-view-model";
import { DestinationsSearch } from "./destinations-search";
import { DestinationsGrid } from "./destinations-grid";
import { DestinationsPagination } from "./destinations-pagination";

interface Text {
  eyebrow: string;
  title: string;
  resultsCount: (n: number) => string;
  empty: string;
  searchPlaceholder: string;
  search: string;
  paginationAria: string;
}

export function DestinationsArchive({
  destinations,
  total,
  totalPages,
  text,
}: {
  destinations: DestinationVM[];
  total: number;
  totalPages: number;
  text: Text;
}) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <section className="bg-muted rounded-3xl px-6 py-16 text-center">
        <span className="text-muted-foreground text-sm tracking-[0.3em] uppercase">{text.eyebrow}</span>
        <h1 className="font-heading mt-3 text-4xl font-semibold sm:text-6xl">{text.title}</h1>
      </section>
      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-sm">{text.resultsCount(total)}</p>
        <DestinationsSearch placeholder={text.searchPlaceholder} submitLabel={text.search} />
      </div>
      <div className="mt-6">
        <DestinationsGrid destinations={destinations} emptyLabel={text.empty} />
        <DestinationsPagination totalPages={totalPages} ariaLabel={text.paginationAria} />
      </div>
    </main>
  );
}
