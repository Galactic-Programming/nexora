"use client";

import { useState } from "react";
import { useRouter, usePathname } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { Button } from "@tourism/ui/components/custom/button-custom";
import { parseDestinationsQuery, serializeDestinationsQuery } from "./destinations-query";

export function DestinationsSearch({
  placeholder,
  submitLabel,
}: {
  placeholder: string;
  submitLabel: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const current = parseDestinationsQuery(Object.fromEntries(sp.entries()));
  const [q, setQ] = useState(current.search ?? "");

  function apply() {
    const next = serializeDestinationsQuery({
      page: 1,
      pageSize: current.pageSize,
      search: q.trim() || undefined,
    });
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="flex gap-2">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && apply()}
        placeholder={placeholder}
        aria-label={placeholder}
        className="border-border w-full max-w-sm rounded-md border bg-background px-3 py-2 text-sm"
      />
      <Button onClick={apply}>{submitLabel}</Button>
    </div>
  );
}
