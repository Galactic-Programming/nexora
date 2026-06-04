"use client";

import { useRouter, usePathname } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { PaginationControl } from "@tourism/ui/components/custom/pagination-control";
import { serializeToursQuery, parseToursQuery } from "./tours-query";

interface Props { totalPages: number; ariaLabel: string; }

export function ToursPagination({ totalPages, ariaLabel }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const current = parseToursQuery(Object.fromEntries(sp.entries()));

  function go(page: number) {
    const next = serializeToursQuery({ ...current, page });
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
