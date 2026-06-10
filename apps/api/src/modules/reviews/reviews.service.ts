import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, Prisma, Review } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { ListReviewsQueryDto } from './dto/list-reviews-query.dto';

/**
 * Shape of a public review item — strips bookingId + userId so the
 * customer's purchase history isn't probeable from the marketing page.
 * `reviewer` exposes only the public-safe display name.
 */
export interface PublicReview {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  createdAt: Date;
  reviewer: { fullName: string };
}

export interface PaginatedPublicReviews {
  data: PublicReview[];
  meta: {
    total: number;
    page: number;
    limit: number;
    averageRating: number | null;
  };
}

/**
 * Customer review surface (Sprint B4.1).
 *
 * Eligibility rules:
 *  - Booking must be PAID (we accept REFUNDED → no; CANCELLED → no).
 *  - Caller must own the booking (anti-impersonation).
 *  - One review per booking — enforced by `Review.bookingId UNIQUE`.
 *
 * Moderation flow:
 *  - Reviews land with `isApproved = false`. They become visible on
 *    `GET /tours/:slug/reviews` only after admin flips the flag (B4.3).
 *
 * Why store `tourId` on the review when it's derivable from `bookingId`:
 *  - The hot read (`GET /tours/:slug/reviews`) filters by `tourId` +
 *    `isApproved`. Denormalising avoids a join on every public hit,
 *    and the value is immutable for the life of the booking.
 */
@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createForCustomer(
    customerUserId: string,
    body: CreateReviewDto,
  ): Promise<Review> {
    const booking = await this.prisma.booking.findUnique({
      where: { code: body.bookingCode },
      select: {
        id: true,
        code: true,
        userId: true,
        tourId: true,
        status: true,
      },
    });
    if (!booking) {
      throw new NotFoundException({
        code: 'BOOKING_NOT_FOUND',
        message: `Booking "${body.bookingCode}" not found`,
      });
    }
    if (booking.userId !== customerUserId) {
      // 403 here (not 404) because the user can already see the code in
      // their own list — denying ownership is the honest signal.
      throw new ForbiddenException({
        code: 'BOOKING_FORBIDDEN',
        message: 'You can only review your own bookings',
      });
    }
    if (booking.status !== BookingStatus.PAID) {
      throw new BadRequestException({
        code: 'REVIEW_NOT_ELIGIBLE',
        message: `Only PAID bookings can be reviewed (current: ${booking.status})`,
      });
    }

    try {
      const review = await this.prisma.review.create({
        data: {
          tourId: booking.tourId,
          userId: customerUserId,
          bookingId: booking.id,
          rating: body.rating,
          title: body.title,
          body: body.body,
        },
      });
      this.logger.log(
        `Customer ${customerUserId} created review ${review.id} for booking ${booking.code} (pending approval)`,
      );
      return review;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'REVIEW_ALREADY_EXISTS',
          message: `Booking "${body.bookingCode}" already has a review`,
        });
      }
      throw err;
    }
  }

  /**
   * Public list of approved reviews for one tour. Strips PII (booking
   * code, user id, email) and projects only the display name. Paginated
   * because a popular tour can accumulate hundreds of reviews; the FE
   * paginates the list view but caches the average rating from `meta`
   * for the tour card.
   *
   * Tour-not-found: we look up the slug here (not just `tourId`) so the
   * caller can hit `/tours/X/reviews` with an unknown slug and get a
   * clean 404 instead of "200 with empty array", which would hide bugs
   * in the FE routing.
   */
  async findApprovedForTour(
    slug: string,
    query: ListReviewsQueryDto,
  ): Promise<PaginatedPublicReviews> {
    const tour = await this.prisma.tour.findFirst({
      where: { slug, isPublished: true },
      select: { id: true },
    });
    if (!tour) {
      throw new NotFoundException({
        code: 'TOUR_NOT_FOUND',
        message: `Tour "${slug}" not found`,
      });
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const where = { tourId: tour.id, isApproved: true } as const;

    // Read-only list+count: use Promise.all (NOT $transaction) — the Supabase
    // transaction-mode pooler (connection_limit=1) can't start a batch transaction
    // under concurrency; pagination needs no cross-query snapshot consistency.
    const [rows, total, aggregate] = await Promise.all([
      this.prisma.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          rating: true,
          title: true,
          body: true,
          createdAt: true,
          user: { select: { fullName: true } },
        },
      }),
      this.prisma.review.count({ where }),
      this.prisma.review.aggregate({ where, _avg: { rating: true } }),
    ]);

    const data: PublicReview[] = rows.map((row) => ({
      id: row.id,
      rating: row.rating,
      title: row.title,
      body: row.body,
      createdAt: row.createdAt,
      reviewer: { fullName: row.user?.fullName ?? 'Anonymous' },
    }));

    return {
      data,
      meta: {
        total,
        page,
        limit,
        averageRating: aggregate._avg.rating ?? null,
      },
    };
  }

  /**
   * Admin moderation toggle. Idempotent — flipping a row to its current
   * value is a no-op write (Prisma still issues the UPDATE but Postgres
   * doesn't change the row contents). The boolean shape (vs. separate
   * approve/reject endpoints) lets the admin re-draft a review later
   * if it gets flagged after going public.
   *
   * @throws NotFoundException — `REVIEW_NOT_FOUND` for missing id.
   */
  async moderateById(reviewId: string, isApproved: boolean): Promise<Review> {
    const existing = await this.prisma.review.findUnique({
      where: { id: reviewId },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException({
        code: 'REVIEW_NOT_FOUND',
        message: `Review "${reviewId}" not found`,
      });
    }

    const updated = await this.prisma.review.update({
      where: { id: reviewId },
      data: { isApproved },
    });
    this.logger.log(
      `Admin moderated review ${reviewId} → isApproved=${isApproved}`,
    );
    return updated;
  }
}
