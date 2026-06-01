'use client';

import type { DateRange, Matcher } from 'react-day-picker';
import { CalendarIcon } from 'lucide-react';

import { cn } from '@tourism/ui/lib/utils';
import { Button } from '@tourism/ui/components/legacy/button';
import { Calendar } from '@tourism/ui/components/legacy/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@tourism/ui/components/legacy/popover';

/**
 * DateRangePicker — a reusable date-range filter control extracted from the
 * analytics chart-filter pattern (a Popover + range Calendar behind a button
 * that shows the selected range). Common across admin filters: analytics
 * ranges, booking-date filters, report periods.
 *
 *   const [range, setRange] = useState<DateRange>();
 *   <DateRangePicker value={range} onChange={setRange} />
 */
interface DateRangePickerProps {
  value?: DateRange;
  onChange?: (range: DateRange | undefined) => void;
  placeholder?: string;
  numberOfMonths?: number;
  align?: 'start' | 'center' | 'end';
  /** react-day-picker matcher(s) for disabled days. */
  disabled?: Matcher | Matcher[];
  className?: string;
}

function formatRangeLabel(
  range: DateRange | undefined,
  placeholder: string,
): string {
  if (range?.from && range?.to) {
    return `${range.from.toLocaleDateString()} - ${range.to.toLocaleDateString()}`;
  }
  if (range?.from) {
    return range.from.toLocaleDateString();
  }
  return placeholder;
}

function DateRangePicker({
  value,
  onChange,
  placeholder = 'Pick a date range',
  numberOfMonths = 2,
  align = 'start',
  disabled,
  className,
}: DateRangePickerProps) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            className={cn(
              'justify-start gap-2 font-normal',
              !value?.from && 'text-muted-foreground',
              className,
            )}
          />
        }
      >
        <CalendarIcon />
        {formatRangeLabel(value, placeholder)}
      </PopoverTrigger>
      <PopoverContent className="w-auto overflow-hidden p-0" align={align}>
        <Calendar
          mode="range"
          defaultMonth={value?.from}
          selected={value}
          onSelect={onChange}
          numberOfMonths={numberOfMonths}
          disabled={disabled}
          showOutsideDays
        />
      </PopoverContent>
    </Popover>
  );
}

export { DateRangePicker };
export type { DateRangePickerProps };
