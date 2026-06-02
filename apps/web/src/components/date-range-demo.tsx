"use client";

import { useState } from "react";
import {
  DateRangePicker,
  type DateRange,
} from "@tourism/ui/components/custom/date-range-picker";

export function DateRangeDemo() {
  const [range, setRange] = useState<DateRange | undefined>();

  return <DateRangePicker value={range} onChange={setRange} />;
}
