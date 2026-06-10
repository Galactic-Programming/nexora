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

describe('ReviewsService.findApprovedForTour', () => {
  function makeListPrisma(opts: {
    tour?: { id: string } | null;
    rows?: Array<{
      id: string;
      rating: number;
      title: string | null;
      body: string;
      createdAt: Date;
      user: { fullName: string } | null;
    }>;
    total?: number;
    avg?: number | null;
  }) {
    return {
      tour: {
        findFirst: jest
          .fn()
          .mockResolvedValue(
            opts.tour === undefined ? { id: 't-1' } : opts.tour,
          ),
      },
      review: {
        findMany: jest.fn().mockResolvedValue(opts.rows ?? []),
        count: jest.fn().mockResolvedValue(opts.total ?? 0),
        aggregate: jest
          .fn()
          .mockResolvedValue({ _avg: { rating: opts.avg ?? null } }),
      },
    };
  }

  it('throws TOUR_NOT_FOUND when slug is missing or unpublished', async () => {
    const svc = new ReviewsService(makeListPrisma({ tour: null }) as never);
    await expect(svc.findApprovedForTour('ghost', {})).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('returns paginated approved reviews + average rating', async () => {
    const prisma = makeListPrisma({
      rows: [
        {
          id: 'r-1',
          rating: 5,
          title: 'Good',
          body: 'great',
          createdAt: new Date('2026-05-01'),
          user: { fullName: 'Alice' },
        },
      ],
      total: 1,
      avg: 4.5,
    });
    const svc = new ReviewsService(prisma as never);

    const result = await svc.findApprovedForTour('hoi-an-walking-tour', {});

    expect(result.data).toHaveLength(1);
    expect(result.data[0].reviewer.fullName).toBe('Alice');
    expect(result.meta.total).toBe(1);
    expect(result.meta.averageRating).toBe(4.5);
    type WhereCall = { where: { isApproved: boolean } };
    const calls = prisma.review.findMany.mock.calls as unknown as WhereCall[][];
    expect(calls[0][0].where.isApproved).toBe(true);
  });

  it('returns empty data + null average when nothing is approved yet', async () => {
    const svc = new ReviewsService(
      makeListPrisma({ rows: [], total: 0, avg: null }) as never,
    );

    const result = await svc.findApprovedForTour('hoi-an-walking-tour', {});

    expect(result.data).toEqual([]);
    expect(result.meta.averageRating).toBeNull();
  });
});

describe('ReviewsService.moderateById', () => {
  it('throws REVIEW_NOT_FOUND when id missing', async () => {
    const update = jest.fn();
    const prisma = {
      review: {
        findUnique: jest.fn().mockResolvedValue(null),
        update,
      },
    };
    const svc = new ReviewsService(prisma as never);
    await expect(svc.moderateById('missing', true)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(update).not.toHaveBeenCalled();
  });

  it('flips isApproved on the row when approving', async () => {
    const update = jest.fn().mockResolvedValue({ id: 'r-1', isApproved: true });
    const prisma = {
      review: {
        findUnique: jest.fn().mockResolvedValue({ id: 'r-1' }),
        update,
      },
    };
    const svc = new ReviewsService(prisma as never);

    await svc.moderateById('r-1', true);

    type UpdCall = { where: { id: string }; data: { isApproved: boolean } };
    const calls = update.mock.calls as unknown as UpdCall[][];
    expect(calls[0][0].where.id).toBe('r-1');
    expect(calls[0][0].data.isApproved).toBe(true);
  });

  it('can re-draft an approved review (isApproved=false)', async () => {
    const update = jest
      .fn()
      .mockResolvedValue({ id: 'r-1', isApproved: false });
    const prisma = {
      review: {
        findUnique: jest.fn().mockResolvedValue({ id: 'r-1' }),
        update,
      },
    };
    const svc = new ReviewsService(prisma as never);

    await svc.moderateById('r-1', false);

    type UpdCall = { data: { isApproved: boolean } };
    const calls = update.mock.calls as unknown as UpdCall[][];
    expect(calls[0][0].data.isApproved).toBe(false);
  });
});
