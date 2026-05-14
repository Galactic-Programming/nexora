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
}
