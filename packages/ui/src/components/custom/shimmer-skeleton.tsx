'use client';

import { motion, useReducedMotion, type HTMLMotionProps } from 'motion/react';

import { cn } from '@tourism/ui/lib/utils';

/**
 * ShimmerSkeleton — a loading placeholder with a sweeping shimmer (motion)
 * instead of the legacy pulse. Reused for loading states (tour lists, tables).
 *
 * Respects `prefers-reduced-motion`: falls back to the static pulse skeleton.
 *
 *   <ShimmerSkeleton className="h-4 w-40" />
 */
type ShimmerSkeletonProps = HTMLMotionProps<'div'>;

function ShimmerSkeleton({ className, ...props }: ShimmerSkeletonProps) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return (
      <motion.div
        data-slot="shimmer-skeleton"
        className={cn('animate-pulse rounded-md bg-muted', className)}
        {...props}
      />
    );
  }

  return (
    <motion.div
      data-slot="shimmer-skeleton"
      className={cn(
        'rounded-md bg-[linear-gradient(120deg,var(--muted)_calc(var(--shimmer-x)-25%),oklch(100%_0_0/0.4)_var(--shimmer-x),var(--muted)_calc(var(--shimmer-x)+25%))] [--shimmer-x:0%]',
        className,
      )}
      initial={{ '--shimmer-x': '-100%' }}
      animate={{ '--shimmer-x': '200%' }}
      transition={{
        '--shimmer-x': {
          duration: 1.7,
          repeat: Infinity,
          ease: [0.445, 0.05, 0.55, 0.95] as [number, number, number, number],
        },
      }}
      {...props}
    />
  );
}

export { ShimmerSkeleton };
export type { ShimmerSkeletonProps };
