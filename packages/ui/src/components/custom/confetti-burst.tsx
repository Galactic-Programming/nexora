'use client';

import * as React from 'react';
import { easeOut, motion } from 'motion/react';

import { cn } from '@tourism/ui/lib/utils';

/**
 * ConfettiBurst — a reusable one-shot confetti effect (motion).
 *
 * Drop it inside any `relative` container and change the `trigger` value to
 * fire a burst from the center. It manages its own lifecycle (renders the
 * particles, then clears them when the animation finishes), so it can be
 * reused anywhere: a checkbox, a like button, a booking-success screen.
 *
 *   const [burst, setBurst] = useState(0);
 *   ...
 *   <div className="relative">
 *     <Checkbox onCheckedChange={(c) => c && setBurst((b) => b + 1)} />
 *     <ConfettiBurst trigger={burst} />
 *   </div>
 */
const DEFAULT_COLORS = [
  '#FF0000',
  '#00FF00',
  '#0000FF',
  '#FFFF00',
  '#FF00FF',
  '#00FFFF',
];

const PARTICLE_STAGGER = 0.05; // seconds between particles
const PIECE_OFFSET = 2; // half of a size-1 (4px) dot, to center it

interface ConfettiBurstProps {
  /** Change this value to fire a new burst. Undefined never fires. */
  trigger?: number | string;
  /** Number of particles. */
  count?: number;
  /** Particle colors, cycled through. */
  colors?: string[];
  /** Animation duration per particle, in seconds. */
  duration?: number;
  /** Base spread distance from the center, in pixels. */
  spread?: number;
  className?: string;
}

function ConfettiParticles({
  count,
  colors,
  duration,
  spread,
}: Required<Pick<ConfettiBurstProps, 'count' | 'colors' | 'duration' | 'spread'>>) {
  const pieces = React.useMemo(
    () =>
      Array.from({ length: count }, (_, index) => {
        const angle = Math.random() * Math.PI * 2;
        const distance = spread * 0.7 + Math.random() * spread * 0.5;
        return {
          x: Math.cos(angle) * distance,
          y: Math.sin(angle) * distance,
          color: colors[index % colors.length],
          delay: index * PARTICLE_STAGGER,
        };
      }),
    [count, colors, spread],
  );

  return (
    <>
      {pieces.map((piece, index) => (
        <motion.span
          key={index}
          className="absolute top-1/2 left-1/2 size-1 rounded-full"
          style={{ backgroundColor: piece.color }}
          initial={{ x: -PIECE_OFFSET, y: -PIECE_OFFSET, scale: 0, opacity: 0 }}
          animate={{
            x: piece.x - PIECE_OFFSET,
            y: piece.y - PIECE_OFFSET,
            scale: [0, 1, 0],
            opacity: [0, 1, 0],
          }}
          transition={{ duration, delay: piece.delay, ease: easeOut }}
        />
      ))}
    </>
  );
}

function ConfettiBurst({
  trigger,
  count = 12,
  colors = DEFAULT_COLORS,
  duration = 0.4,
  spread = 40,
  className,
}: ConfettiBurstProps) {
  const [burstKey, setBurstKey] = React.useState<string | null>(null);
  const previousTrigger = React.useRef(trigger);

  React.useEffect(() => {
    if (trigger === undefined || previousTrigger.current === trigger) return;

    previousTrigger.current = trigger;
    const key = `${trigger}:${Date.now()}`;
    setBurstKey(key);

    const totalMs = (duration + count * PARTICLE_STAGGER) * 1000 + 50;
    const timer = setTimeout(
      () => setBurstKey((current) => (current === key ? null : current)),
      totalMs,
    );

    return () => clearTimeout(timer);
  }, [trigger, duration, count]);

  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute inset-0', className)}
    >
      {burstKey ? (
        <ConfettiParticles
          key={burstKey}
          count={count}
          colors={colors}
          duration={duration}
          spread={spread}
        />
      ) : null}
    </div>
  );
}

export { ConfettiBurst };
export type { ConfettiBurstProps };
