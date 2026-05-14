import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, Prisma } from '@prisma/client';
import { ReviewsService } from './reviews.service';

beforeAll(() => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
});
afterAll(() => {
  jest.restoreAllMocks();
});

const baseDto = {
  bookingCode: 'BK-ABCDEFGH',
  rating: 5,
  title: 'Great',
  body: 'Loved the trip, guide was excellent.',
};

const paidBooking = {
  id: 'b-1',
  code: 'BK-ABCDEFGH',
  userId: 'u-customer',
  tourId: 't-1',
  status: BookingStatus.PAID,
};

function makePrisma(overrides: {
  bookingFindUnique?: jest.Mock;
  reviewCreate?: jest.Mock;
}) {
  return {
    booking: { findUnique: overrides.bookingFindUnique ?? jest.fn() },
    review: { create: overrides.reviewCreate ?? jest.fn() },
  };
}

describe('ReviewsService.createForCustomer', () => {
  it('throws BOOKING_NOT_FOUND when code missing', async () => {
    const svc = new ReviewsService(
      makePrisma({
        bookingFindUnique: jest.fn().mockResolvedValue(null),
      }) as never,
    );
    await expect(
      svc.createForCustomer('u-customer', baseDto),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws BOOKING_FORBIDDEN when caller is not the owner', async () => {
    const svc = new ReviewsService(
      makePrisma({
        bookingFindUnique: jest.fn().mockResolvedValue(paidBooking),
      }) as never,
    );
    await expect(
      svc.createForCustomer('u-someone-else', baseDto),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects REVIEW_NOT_ELIGIBLE for non-PAID bookings', async () => {
    const svc = new ReviewsService(
      makePrisma({
        bookingFindUnique: jest
          .fn()
          .mockResolvedValue({ ...paidBooking, status: BookingStatus.PENDING }),
      }) as never,
    );
    await expect(
      svc.createForCustomer('u-customer', baseDto),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates the review with isApproved unset (default false) on the happy path', async () => {
    const reviewCreate = jest
      .fn()
      .mockResolvedValue({ id: 'r-1', isApproved: false });
    const svc = new ReviewsService(
      makePrisma({
        bookingFindUnique: jest.fn().mockResolvedValue(paidBooking),
        reviewCreate,
      }) as never,
    );

    await svc.createForCustomer('u-customer', baseDto);

    type CreateCall = {
      data: { rating: number; tourId: string; bookingId: string };
    };
    const calls = reviewCreate.mock.calls as unknown as CreateCall[][];
    expect(calls[0][0].data.rating).toBe(5);
    expect(calls[0][0].data.tourId).toBe('t-1');
    expect(calls[0][0].data.bookingId).toBe('b-1');
  });

  it('translates P2002 (UNIQUE booking_id) into REVIEW_ALREADY_EXISTS', async () => {
    const reviewCreate = jest.fn().mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    const svc = new ReviewsService(
      makePrisma({
        bookingFindUnique: jest.fn().mockResolvedValue(paidBooking),
        reviewCreate,
      }) as never,
    );
    await expect(
      svc.createForCustomer('u-customer', baseDto),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
