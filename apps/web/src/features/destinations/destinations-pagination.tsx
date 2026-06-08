"use client";

import { useRouter, usePathname } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { PaginationControl } from "@tourism/ui/components/custom/pagination-control";
import { parseDestinationsQuery, serializeDestinationsQuery } from "./destinations-query";

interface Props {
  totalPages: number;
  ariaLabel: string;
}

export function DestinationsPagination({ totalPages, ariaLabel }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const current = parseDestinationsQuery(Object.fromEntries(sp.entries()));

  function go(page: number) {
    const next = serializeDestinationsQuery({ ...current, page });
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <PaginationControl
      page={current.page}
      pageCount={totalPages}
      onPageChange={go}
      className="mt-10"
      aria-label={ariaLabel}
    />
  );
}
