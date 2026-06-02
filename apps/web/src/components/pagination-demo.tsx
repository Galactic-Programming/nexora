"use client";

import { useState } from "react";
import { PaginationControl } from "@tourism/ui/components/custom/pagination-control";

export function PaginationDemo() {
  const [page, setPage] = useState(1);

  return (
    <div className="flex flex-col gap-2">
      <PaginationControl page={page} pageCount={20} onPageChange={setPage} />
      <p className="text-muted-foreground text-center text-xs">
        Page {page} of 20
      </p>
    </div>
  );
}
