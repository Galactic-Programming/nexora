"use client";

import { useRouter, usePathname } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { serializeToursQuery, parseToursQuery, type SortBy, type SortOrder } from "./tours-query";

type Option = { label: string; sortBy: SortBy; sortOrder: SortOrder };

export function TourSortBar({ options }: { options: Option[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const current = parseToursQuery(Object.fromEntries(sp.entries()));

  function select(o: Option) {
    const next = serializeToursQuery({ ...current, page: 1, sortBy: o.sortBy, sortOrder: o.sortOrder });
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = current.sortBy === o.sortBy && current.sortOrder === o.sortOrder;
        return (
          <button
            key={o.label}
            type="button"
            onClick={() => select(o)}
            aria-pressed={active}
            className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${active ? "bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground"}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
