'use client';

import * as React from 'react';
import { motion, type Transition } from 'motion/react';
import type { EmblaCarouselType, EmblaOptionsType } from 'embla-carousel';
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';

import { cn } from '@tourism/ui/lib/utils';
import { Button } from '@tourism/ui/components/legacy/button';

/**
 * MotionCarousel — an animated gallery carousel (embla + motion).
 *
 * The active slide scales up while neighbors shrink, and the pagination dots
 * morph into a labeled pill. Data-driven: pass an `items` array of
 * `{ image, alt }`; the real `alt` is used for accessibility.
 *
 *   <MotionCarousel
 *     items={[{ image: '/a.jpg', alt: 'Beach' }, ...]}
 *     options={{ loop: true }}
 *   />
 *
 * Inspired by Animate UI's motion carousel.
 */
interface MotionCarouselItem {
  image: string;
  alt: string;
}

interface MotionCarouselProps {
  items: MotionCarouselItem[];
  options?: EmblaOptionsType;
  className?: string;
}

type EmblaControls = {
  selectedIndex: number;
  scrollSnaps: number[];
  prevDisabled: boolean;
  nextDisabled: boolean;
  onDotClick: (index: number) => void;
  onPrev: () => void;
  onNext: () => void;
};

type DotButtonProps = {
  selected?: boolean;
  label: string;
  onClick: () => void;
};

const transition: Transition = {
  stiffness: 240,
  damping: 24,
  mass: 1,
};

function useEmblaControls(
  emblaApi: EmblaCarouselType | undefined,
): EmblaControls {
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [scrollSnaps, setScrollSnaps] = React.useState<number[]>([]);
  const [prevDisabled, setPrevDisabled] = React.useState(true);
  const [nextDisabled, setNextDisabled] = React.useState(true);

  const onDotClick = React.useCallback(
    (index: number) => emblaApi?.scrollTo(index),
    [emblaApi],
  );
  const onPrev = React.useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const onNext = React.useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  const updateSelectionState = (api: EmblaCarouselType) => {
    setSelectedIndex(api.selectedScrollSnap());
    setPrevDisabled(!api.canScrollPrev());
    setNextDisabled(!api.canScrollNext());
  };

  const onInit = React.useCallback((api: EmblaCarouselType) => {
    setScrollSnaps(api.scrollSnapList());
    updateSelectionState(api);
  }, []);

  const onSelect = React.useCallback((api: EmblaCarouselType) => {
    updateSelectionState(api);
  }, []);

  React.useEffect(() => {
    if (!emblaApi) return;

    onInit(emblaApi);
    emblaApi.on('reInit', onInit).on('select', onSelect);

    return () => {
      emblaApi.off('reInit', onInit).off('select', onSelect);
    };
  }, [emblaApi, onInit, onSelect]);

  return {
    selectedIndex,
    scrollSnaps,
    prevDisabled,
    nextDisabled,
    onDotClick,
    onPrev,
    onNext,
  };
}

function MotionCarousel({ items, options, className }: MotionCarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel(options);
  const {
    selectedIndex,
    scrollSnaps,
    prevDisabled,
    nextDisabled,
    onDotClick,
    onPrev,
    onNext,
  } = useEmblaControls(emblaApi);

  return (
    <div
      className={cn(
        'w-full space-y-4 [--slide-height:9rem] [--slide-size:55%] [--slide-spacing:1.5rem] sm:[--slide-height:13rem] md:[--slide-height:18rem]',
        className,
      )}
    >
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex touch-pan-y touch-pinch-zoom">
          {items.map((item, index) => {
            const isActive = index === selectedIndex;

            return (
              <motion.div
                key={index}
                className="mr-(--slide-spacing) flex h-(--slide-height) min-w-0 flex-none basis-(--slide-size)"
              >
                <motion.div
                  className="flex size-full items-center justify-center overflow-hidden rounded-xl select-none"
                  initial={false}
                  animate={{ scale: isActive ? 1 : 0.9 }}
                  transition={transition}
                >
                  <img
                    src={item.image}
                    alt={item.alt}
                    className="size-full object-cover"
                  />
                </motion.div>
              </motion.div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-between">
        <Button size="icon" onClick={onPrev} disabled={prevDisabled}>
          <ChevronLeftIcon className="size-5" />
        </Button>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {scrollSnaps.map((_, index) => (
            <DotButton
              key={index}
              label={`Slide ${index + 1}`}
              selected={index === selectedIndex}
              onClick={() => onDotClick(index)}
            />
          ))}
        </div>

        <Button size="icon" onClick={onNext} disabled={nextDisabled}>
          <ChevronRightIcon className="size-5" />
        </Button>
      </div>
    </div>
  );
}

function DotButton({ selected = false, label, onClick }: DotButtonProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      layout
      initial={false}
      className="bg-primary text-primary-foreground flex cursor-pointer items-center justify-center rounded-full border-none text-sm select-none"
      animate={{ width: selected ? 68 : 12, height: selected ? 28 : 12 }}
      transition={transition}
    >
      <motion.span
        layout
        initial={false}
        className="block px-3 py-1 whitespace-nowrap"
        animate={{
          opacity: selected ? 1 : 0,
          scale: selected ? 1 : 0,
          filter: selected ? 'blur(0px)' : 'blur(4px)',
        }}
        transition={transition}
      >
        {label}
      </motion.span>
    </motion.button>
  );
}

export { MotionCarousel };
export type { MotionCarouselItem, MotionCarouselProps };
