"use client";

import { useState } from "react";
import { useRouter, usePathname } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { Button } from "@tourism/ui/components/custom/button-custom";
import { serializeToursQuery, parseToursQuery } from "./tours-query";

interface Labels {
  title: string;
  searchPlaceholder: string;
  minPrice: string;
  maxPrice: string;
  apply: string;
  clear: string;
}

export function TourFilterSidebar({ labels }: { labels: Labels }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const current = parseToursQuery(Object.fromEntries(sp.entries()));

  const [q, setQ] = useState(current.q ?? "");
  const [min, setMin] = useState(current.minPrice?.toString() ?? "");
  const [max, setMax] = useState(current.maxPrice?.toString() ?? "");

  function apply() {
    const next = serializeToursQuery({
      ...current,
      page: 1,
      q: q.trim() || undefined,
      minPrice: min ? Number(min) : undefined,
      maxPrice: max ? Number(max) : undefined,
    });
    router.push(`${pathname}?${next.toString()}`);
  }
  function clear() {
    setQ(""); setMin(""); setMax("");
    const next = serializeToursQuery({ page: 1, pageSize: current.pageSize, sortBy: current.sortBy, sortOrder: current.sortOrder });
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <aside className="bg-muted/40 rounded-2xl p-6">
      <h2 className="font-heading mb-4 text-xl font-semibold">{labels.title}</h2>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && apply()}
        placeholder={labels.searchPlaceholder}
        className="border-border mb-3 w-full rounded-md border bg-background px-3 py-2 text-sm"
      />
      <div className="mb-4 flex gap-2">
        <input inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value)} placeholder={labels.minPrice}
          className="border-border w-full rounded-md border bg-background px-3 py-2 text-sm" />
        <input inputMode="numeric" value={max} onChange={(e) => setMax(e.target.value)} placeholder={labels.maxPrice}
          className="border-border w-full rounded-md border bg-background px-3 py-2 text-sm" />
      </div>
      <div className="flex gap-2">
        <Button onClick={apply} className="flex-1">{labels.apply}</Button>
        <Button onClick={clear} variant="outline" className="flex-1">{labels.clear}</Button>
      </div>
    </aside>
  );
}
