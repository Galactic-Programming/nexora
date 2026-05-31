'use client';

import {
  ClockIcon,
  HeartIcon,
  MapPinIcon,
  StarIcon,
} from 'lucide-react';

import { cn } from '@tourism/ui/lib/utils';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@tourism/ui/components/legacy/card';
import { Badge } from '@tourism/ui/components/custom/badge-custom';
import { Button } from '@tourism/ui/components/custom/button-custom';

/**
 * TourCard — data-driven listing card derived from the `Tour` schema.
 *
 * It expects an already-prepared view-model: localized strings (the page
 * decides EN/VI via next-intl), a computed `rating`/`reviewCount` aggregate,
 * and a plain `price` number + currency. It does not receive the raw Prisma
 * model. Fields are optional where the schema allows nulls.
 */
type TourCategory = 'DAY' | 'PACKAGE' | 'CUSTOM' | 'HONEYMOON' | 'MUSICAL';

const CATEGORY_LABELS: Record<TourCategory, string> = {
  DAY: 'Day tour',
  PACKAGE: 'Package',
  CUSTOM: 'Custom',
  HONEYMOON: 'Honeymoon',
  MUSICAL: 'Musical',
};

interface TourCardProps {
  href: string;
  title: string;
  image?: string;
  summary?: string;
  destination?: string;
  price: number;
  currency?: string;
  locale?: string;
  durationDays?: number;
  category?: TourCategory;
  difficulty?: string;
  featured?: boolean;
  rating?: number;
  reviewCount?: number;
  liked?: boolean;
  onLike?: () => void;
  className?: string;
}

function formatPrice(price: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(price);
}

function TourCard({
  href,
  title,
  image,
  summary,
  destination,
  price,
  currency = 'USD',
  locale = 'en-US',
  durationDays,
  category,
  difficulty,
  featured = false,
  rating,
  reviewCount,
  liked = false,
  onLike,
  className,
}: TourCardProps) {
  return (
    <Card className={cn('relative max-w-md', className)}>
      {featured ? (
        <Badge variant="gradient" className="absolute top-3 left-3 z-10">
          Featured
        </Badge>
      ) : null}

      {onLike ? (
        <Button
          type="button"
          size="icon"
          variant="secondary"
          aria-pressed={liked}
          aria-label={liked ? 'Remove from wishlist' : 'Add to wishlist'}
          onClick={onLike}
          className="absolute top-3 right-3 z-10 rounded-full"
        >
          <HeartIcon
            className={cn(liked && 'fill-destructive stroke-destructive')}
          />
        </Button>
      ) : null}

      {image ? (
        <img
          src={image}
          alt={title}
          className="aspect-video w-full object-cover"
        />
      ) : null}

      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-1.5">
          {destination ? (
            <Badge variant="outline" className="gap-1">
              <MapPinIcon />
              {destination}
            </Badge>
          ) : null}
          {durationDays ? (
            <Badge variant="outline" className="gap-1">
              <ClockIcon />
              {durationDays} {durationDays === 1 ? 'day' : 'days'}
            </Badge>
          ) : null}
          {category ? (
            <Badge variant="secondary">{CATEGORY_LABELS[category]}</Badge>
          ) : null}
          {difficulty ? (
            <Badge variant="outline">{difficulty}</Badge>
          ) : null}
        </CardDescription>
      </CardHeader>

      {summary || rating != null ? (
        <CardContent className="flex flex-col gap-2">
          {rating != null ? (
            <div className="flex items-center gap-1 text-sm">
              <StarIcon className="size-4 fill-amber-500 stroke-amber-500" />
              <span className="font-medium">{rating.toFixed(1)}</span>
              {reviewCount != null ? (
                <span className="text-muted-foreground">({reviewCount})</span>
              ) : null}
            </div>
          ) : null}
          {summary ? (
            <p className="line-clamp-2 text-muted-foreground">{summary}</p>
          ) : null}
        </CardContent>
      ) : null}

      <CardFooter className="justify-between gap-3 max-sm:flex-col max-sm:items-stretch">
        <div className="flex flex-col">
          <span className="text-muted-foreground text-xs uppercase">From</span>
          <span className="text-xl font-semibold">
            {formatPrice(price, currency, locale)}
          </span>
        </div>
        <Button render={<a href={href} />}>View tour</Button>
      </CardFooter>
    </Card>
  );
}

export { TourCard };
export type { TourCardProps, TourCategory };
