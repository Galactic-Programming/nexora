"use client";

import { useState } from "react";
import { Calendar } from "@tourism/ui/components/custom/calendar-custom";

export function CalendarDemo() {
  const [date, setDate] = useState<Date | undefined>(undefined);

  return (
    <Calendar
      mode="single"
      selected={date}
      onSelect={setDate}
      disablePast
      className="w-fit rounded-2xl border"
    />
  );
}
