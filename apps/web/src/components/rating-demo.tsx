'use client';

import { useState } from 'react';
import { Rating } from '@tourism/ui/components/custom/rating';

export function RatingDemo() {
  const [value, setValue] = useState(3);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Interactive — {value} / 5
        </span>
        <Rating
          value={value}
          onValueChange={setValue}
          variant="yellow"
          size={28}
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Half-star precision
        </span>
        <Rating defaultValue={3.5} precision={0.5} variant="yellow" />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Read-only display
        </span>
        <Rating value={4} readOnly variant="yellow" size={18} />
      </div>
    </div>
  );
}
