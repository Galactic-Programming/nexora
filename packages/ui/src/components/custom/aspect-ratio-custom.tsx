import type * as React from 'react';

import { cn } from '@tourism/ui/lib/utils';

/**
 * AspectRatio (custom) — the legacy primitive plus named ratio presets for a
 * consistent set of frame ratios across the site. `ratio` accepts either a raw
 * number (backward-compatible with legacy) or a preset name.
 *
 *   <AspectRatio ratio="video">...</AspectRatio>   // 16 / 9 preset
 *   <AspectRatio ratio={4 / 3}>...</AspectRatio>    // raw number still works
 */
const ASPECT_RATIO_PRESETS = {
  square: 1 / 1, // avatars, square thumbnails
  video: 16 / 9, // heroes, banners, video
  photo: 4 / 3, // standard tour photos
  portrait: 3 / 4, // vertical cards
  story: 9 / 16, // mobile stories / reels
  wide: 21 / 9, // panoramas, maps
} as const;

type AspectRatioPreset = keyof typeof ASPECT_RATIO_PRESETS;

interface AspectRatioProps extends React.ComponentProps<'div'> {
  ratio?: number | AspectRatioPreset;
}

function resolveRatio(ratio: number | AspectRatioPreset): number {
  return typeof ratio === 'number' ? ratio : ASPECT_RATIO_PRESETS[ratio];
}

function AspectRatio({
  ratio = 'video',
  className,
  ...props
}: AspectRatioProps) {
  return (
    <div
      data-slot="aspect-ratio"
      style={
        {
          '--ratio': resolveRatio(ratio),
        } as React.CSSProperties
      }
      className={cn('relative aspect-(--ratio)', className)}
      {...props}
    />
  );
}

export { AspectRatio, ASPECT_RATIO_PRESETS };
export type { AspectRatioPreset, AspectRatioProps };
