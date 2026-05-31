'use client';

import * as React from 'react';
import { addDays, startOfDay } from 'date-fns';
import type { Matcher } from 'react-day-picker';

import { Calendar as BaseCalendar } from '@tourism/ui/components/legacy/calendar';

/**
 * Calendar (custom) — the legacy calendar plus domain convenience props for
 * booking flows. Everything else passes straight through to the legacy
 * calendar (and therefore react-day-picker).
 *
 * - `disablePast`   : block every day before today (today stays selectable).
 * - `leadDays`      : require N days of lead time — the earliest selectable
 *                     day becomes today + N (implies blocking the past).
 * - `disableFuture` : block every day after today (e.g. date of birth).
 *
 * "Today" is normalized with `startOfDay` so a raw time-of-day never blocks
 * today by accident, and these matchers are merged with any `disabled` matcher
 * the caller passes instead of overriding it.
 *
 *   <Calendar mode="single" disablePast />
 *   <Calendar mode="range" leadDays={2} />
 *   <Calendar mode="single" disableFuture />
 */
interface CalendarConvenienceProps {
  disablePast?: boolean;
  leadDays?: number;
  disableFuture?: boolean;
}

type CalendarProps = React.ComponentProps<typeof BaseCalendar> &
  CalendarConvenienceProps;

function toMatcherArray(disabled: Matcher | Matcher[] | undefined): Matcher[] {
  if (disabled === undefined) return [];
  return Array.isArray(disabled) ? disabled : [disabled];
}

function Calendar({
  disablePast = false,
  leadDays,
  disableFuture = false,
  disabled,
  ...props
}: CalendarProps) {
  const today = startOfDay(new Date());

  const matchers: Matcher[] = [];

  if (disablePast || leadDays != null) {
    matchers.push({ before: addDays(today, leadDays ?? 0) });
  }

  if (disableFuture) {
    matchers.push({ after: today });
  }

  matchers.push(...toMatcherArray(disabled));

  return (
    <BaseCalendar
      disabled={matchers.length > 0 ? matchers : undefined}
      {...props}
    />
  );
}

export { Calendar };
export type { CalendarProps };
