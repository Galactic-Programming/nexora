import { Logger } from '@nestjs/common';
import { BookingStatus, Prisma } from '@prisma/client';
import { AdminStatsService } from './admin-stats.service';

beforeAll(() => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
});
afterAll(() => {
  jest.restoreAllMocks();
});

function makePrisma(opts: {
  statusGroups?: Array<{ status: BookingStatus; _count: { _all: number } }>;
  paidSum?: Prisma.Decimal | null;
  paidCount?: number;
  topRevenue?: Array<{
    tourId: string;
    _sum: { totalAmount: Prisma.Decimal | null };
    _count: { _all: number };
  }>;
  topRating?: Array<{
    tourId: string;
    _avg: { rating: number | null };
    _count: { _all: number };
  }>;
  topWishlist?: Array<{ tourId: string; _count: { _all: number } }>;
  monthlyRows?: Array<{
    month: Date;
    bookings: bigint;
    revenue: Prisma.Decimal | null;
  }>;
  tours?: Array<{ id: string; slug: string; titleEn: string }>;
}) {
  return {
    booking: {
      groupBy: jest
        .fn()
        .mockResolvedValueOnce(opts.statusGroups ?? [])
        .mockResolvedValueOnce(opts.topRevenue ?? []),
      aggregate: jest.fn().mockResolvedValue({
        _sum: { totalAmount: opts.paidSum ?? new Prisma.Decimal(0) },
        _count: { _all: opts.paidCount ?? 0 },
      }),
    },
    review: {
      groupBy: jest.fn().mockResolvedValue(opts.topRating ?? []),
    },
    wishlist: {
      groupBy: jest.fn().mockResolvedValue(opts.topWishlist ?? []),
    },
    tour: {
      findMany: jest.fn().mockResolvedValue(opts.tours ?? []),
    },
    $queryRaw: jest.fn().mockResolvedValue(opts.monthlyRows ?? []),
  };
}

describe('AdminStatsService.getDashboard', () => {
  it('returns zeroed overview when there are no bookings', async () => {
    const svc = new AdminStatsService(makePrisma({}) as never);
    const result = await svc.getDashboard();
    expect(result.overview.totalBookings).toBe(0);
    expect(result.overview.paidBookings).toBe(0);
    expect(result.overview.conversionRate).toBe(0);
    expect(result.overview.monthOverMonthGrowth).toBeNull();
    expect(result.bookingsByStatus).toEqual({
      PENDING: 0,
      PAID: 0,
      CANCELLED: 0,
      REFUNDED: 0,
    });
  });

  it('computes conversion rate, status counts, and joins tour metadata', async () => {
    const svc = new AdminStatsService(
      makePrisma({
        statusGroups: [
          { status: BookingStatus.PAID, _count: { _all: 3 } },
          { status: BookingStatus.PENDING, _count: { _all: 2 } },
        ],
        paidSum: new Prisma.Decimal('450'),
        paidCount: 3,
        topRevenue: [
          {
            tourId: 't-1',
            _sum: { totalAmount: new Prisma.Decimal('450') },
            _count: { _all: 3 },
          },
        ],
        tours: [{ id: 't-1', slug: 'hoi-an', titleEn: 'Hoi An' }],
      }) as never,
    );

    const result = await svc.getDashboard();

    expect(result.overview.totalBookings).toBe(5);
    expect(result.overview.paidBookings).toBe(3);
    expect(result.overview.conversionRate).toBeCloseTo(0.6);
    expect(result.overview.totalRevenue).toBe('450');
    expect(result.bookingsByStatus.PAID).toBe(3);
    expect(result.topToursByRevenue[0]).toMatchObject({
      tourId: 't-1',
      slug: 'hoi-an',
      titleEn: 'Hoi An',
      bookingsCount: 3,
    });
  });

  it('computes monthly trend + MoM growth when 2+ months exist', async () => {
    const svc = new AdminStatsService(
      makePrisma({
        monthlyRows: [
          {
            month: new Date('2026-04-01T00:00:00Z'),
            bookings: 2n,
            revenue: new Prisma.Decimal('100'),
          },
          {
            month: new Date('2026-05-01T00:00:00Z'),
            bookings: 4n,
            revenue: new Prisma.Decimal('150'),
          },
        ],
      }) as never,
    );

    const result = await svc.getDashboard();

    expect(result.monthlyTrend).toHaveLength(2);
    expect(result.monthlyTrend[0]).toMatchObject({
      month: '2026-04',
      bookings: 2,
      revenue: '100',
    });
    // 150/100 - 1 = 0.5
    expect(result.overview.monthOverMonthGrowth).toBeCloseTo(0.5);
  });
});
