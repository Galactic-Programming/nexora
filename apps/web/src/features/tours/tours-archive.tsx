import type { ApiTour } from "@/features/home/tour-view-model";
import type { PaginationMeta } from "@/lib/api/tours";
import type { SortBy, SortOrder } from "./tours-query";
import { TourHero } from "./tour-hero";
import { TourSortBar } from "./tour-sort-bar";
import { TourFilterSidebar } from "./tour-filter-sidebar";
import { TourGrid } from "./tour-grid";
import { ToursPagination } from "./tours-pagination";

interface ArchiveText {
  eyebrow: string; title: string;
  resultsCount: (n: number) => string;
  emptyLabel: string;
  sort: { date: string; priceAsc: string; priceDesc: string; name: string };
  filter: { title: string; searchPlaceholder: string; minPrice: string; maxPrice: string; apply: string; clear: string };
  paginationAria: string;
}

interface Props {
  tours: ApiTour[];
  meta: PaginationMeta;
  locale: string;
  text: ArchiveText;
}

export function ToursArchive({ tours, meta, locale, text }: Props) {
  const sortOptions: { label: string; sortBy: SortBy; sortOrder: SortOrder }[] = [
    { label: text.sort.date, sortBy: "createdAt", sortOrder: "desc" },
    { label: text.sort.priceAsc, sortBy: "basePrice", sortOrder: "asc" },
    { label: text.sort.priceDesc, sortBy: "basePrice", sortOrder: "desc" },
    { label: text.sort.name, sortBy: "titleEn", sortOrder: "asc" },
  ];
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <TourHero eyebrow={text.eyebrow} title={text.title} />
      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-sm">{text.resultsCount(meta.total)}</p>
        <TourSortBar options={sortOptions} />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
        <div>
          <TourGrid tours={tours} locale={locale} emptyLabel={text.emptyLabel} />
          <ToursPagination totalPages={meta.totalPages} ariaLabel={text.paginationAria} />
        </div>
        <TourFilterSidebar labels={text.filter} />
      </div>
    </main>
  );
}
