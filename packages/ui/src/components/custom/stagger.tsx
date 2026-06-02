'use client';

import * as React from 'react';
import {
  type Variants,
  easeOut,
  motion,
  useReducedMotion,
} from 'motion/react';

import { cn } from '@tourism/ui/lib/utils';

/**
 * Stagger — reveals its direct children one after another (fade + slide-up)
 * when it mounts. A reusable motion primitive for the "natural" entrance feel,
 * generalized so it works inside drawers, dialogs, lists, or sections instead
 * of hand-writing per-element delays.
 *
 * Respects `prefers-reduced-motion`: when the user opts out, children render
 * statically with no animation.
 *
 *   <Stagger>
 *     <DrawerTitle>...</DrawerTitle>
 *     <p>...</p>
 *     <DrawerFooter>...</DrawerFooter>
 *   </Stagger>
 *
 * Note: each child is wrapped in a motion element, so it stacks as a block.
 */
interface StaggerProps {
  children: React.ReactNode;
  className?: string;
  /** Seconds between consecutive children. */
  stagger?: number;
  /** Delay before the first child animates, in seconds. */
  delay?: number;
  /** Duration of each child's animation, in seconds. */
  duration?: number;
  /** Pixels each child rises from. */
  offset?: number;
}

function Stagger({
  children,
  className,
  stagger = 0.08,
  delay = 0.1,
  duration = 0.35,
  offset = 12,
}: StaggerProps) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <div className={className}>{children}</div>;
  }

  const container: Variants = {
    hidden: {},
    show: {
      transition: { staggerChildren: stagger, delayChildren: delay },
    },
  };

  const item: Variants = {
    hidden: { opacity: 0, y: offset },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration, ease: easeOut },
    },
  };

  return (
    <motion.div
      className={cn(className)}
      initial="hidden"
      animate="show"
      variants={container}
    >
      {React.Children.map(children, (child, index) => (
        <motion.div key={index} variants={item}>
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}

export { Stagger };
export type { StaggerProps };
