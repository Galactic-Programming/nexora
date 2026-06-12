import {
  BadRequestException,
  ConflictException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Tour, TourCategory } from '@prisma/client';
import { CreateTourDto } from './dto/create-tour.dto';
import { ToursService } from './tours.service';

beforeAll(() => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
});
afterAll(() => {
  jest.restoreAllMocks();
});

const sampleTour: Tour = {
  id: 't-1',
  slug: 'hoi-an-walking',
  titleEn: 'Hoi An Walking',
  titleVi: 'Tour bộ Hội An',
  summaryEn: null,
  summaryVi: null,
  destinationId: 'd-1',
  durationDays: 1,
  maxGroupSize: 20,
  basePrice: new Prisma.Decimal('49.50'),
  currency: 'USD',
  category: TourCategory.DAY,
  difficulty: null,
  isPublished: false,
  isFeatured: false,
  included: [],
  excluded: [],
  meetingPoint: null,
  createdAt: new Date('2026-05-08T00:00:00Z'),
  updatedAt: new Date('2026-05-08T00:00:00Z'),
};

const baseCreateDto: CreateTourDto = {
  slug: 'hoi-an-walking',
  titleEn: 'Hoi An Walking',
  titleVi: 'Tour bộ Hội An',
  destinationId: 'd-1',
  durationDays: 1,
  basePrice: 49.5,
};

/** Shape of the `data` arg passed to `prisma.tour.create`. */
type TourCreateCall = {
  data: {
    slug: string;
    currency: string;
    isPublished: boolean;
    isFeatured: boolean;
  };
};

/**
 * Stub of `MediaService`. `attachToOwners`/`attachToOwner` return the rows
 * unchanged (with an empty `media` array) so read-path assertions still see
 * the original tour fields. `syncAssets`/`deleteForOwner` are spies.
 */
function makeMedia() {
  return {
    syncAssets: jest.fn().mockResolvedValue(undefined),
    deleteForOwner: jest.fn().mockResolvedValue(undefined),
    attachToOwners: jest.fn(
      (_t: unknown, items: Array<Record<string, unknown>>) =>
        Promise.resolve(items.map((i) => ({ ...i, media: [] }))),
    ),
    attachToOwner: jest.fn((_t: unknown, item: Record<string, unknown>) =>
      Promise.resolve({ ...item, media: [] }),
    ),
  };
}

function makePrisma(overrides: Partial<Record<string, jest.Mock>> = {}) {
  const client: Record<string, unknown> = {
    tour: {
      create: overrides.tourCreate ?? jest.fn(),
      update: overrides.tourUpdate ?? jest.fn(),
      delete: overrides.tourDelete ?? jest.fn(),
      findUnique: overrides.tourFindUnique ?? jest.fn(),
      findFirst: overrides.tourFindFirst ?? jest.fn(),
      findMany: overrides.tourFindMany ?? jest.fn(),
      count: overrides.tourCount ?? jest.fn(),
    },
    destination: {
      findUnique: overrides.destinationFindUnique ?? jest.fn(),
    },
    review: {
      // computeStats joins approved reviews onto every public Tour read.
      groupBy: overrides.reviewGroupBy ?? jest.fn().mockResolvedValue([]),
    },
    tourDeparture: {
      // computeStats sums seatsBooked across departures for `peopleGoing`.
      groupBy: overrides.departureGroupBy ?? jest.fn().mockResolvedValue([]),
    },
  };
  // `$transaction` supports BOTH forms: an array of Prisma promises (reads),
  // and an interactive callback `fn(tx)` (writes). The callback receives the
  // same mock client so `tx.tour.*` assertions still hold.
  client.$transaction =
    overrides.transaction ??
    jest.fn((arg: unknown) =>
      Promise.resolve(
        typeof arg === 'function'
          ? (arg as (tx: unknown) => unknown)(client)
          : Promise.all(arg as Promise<unknown>[]),
      ),
    );
  return client;
}

function p2002(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique', {
    code: 'P2002',
    clientVersion: 'test',
  });
}

function p2003(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('FK', {
    code: 'P2003',
    clientVersion: 'test',
  });
}

describe('ToursService', () => {
  describe('create', () => {
    it('rejects with INVALID_DESTINATION when destinationId does not exist', async () => {
      const destFind = jest.fn().mockResolvedValue(null);
      const tourCreate = jest.fn();
      const prisma = makePrisma({
        destinationFindUnique: destFind,
        tourCreate,
      });
      const svc = new ToursService(prisma as never, makeMedia() as never);

      await expect(svc.create(baseCreateDto)).rejects.toMatchObject({
        response: { code: 'INVALID_DESTINATION' },
      });
      expect(tourCreate).not.toHaveBeenCalled();
    });

    it('persists with defaults applied when destination exists', async () => {
      const destFind = jest.fn().mockResolvedValue({ id: 'd-1' });
      const tourCreate = jest.fn().mockResolvedValue(sampleTour);
      const prisma = makePrisma({
        destinationFindUnique: destFind,
        tourCreate,
      });
      const svc = new ToursService(prisma as never, makeMedia() as never);

      await svc.create({ ...baseCreateDto, currency: 'usd' });

      const calls = tourCreate.mock.calls as unknown as TourCreateCall[][];
      const arg = calls[0][0];
      expect(arg.data.slug).toBe('hoi-an-walking');
      expect(arg.data.currency).toBe('USD'); // uppercased
      expect(arg.data.isPublished).toBe(false); // default draft
      expect(arg.data.isFeatured).toBe(false);
    });

    it('translates Prisma P2002 into ConflictException TOUR_SLUG_EXISTS', async () => {
      const destFind = jest.fn().mockResolvedValue({ id: 'd-1' });
      const tourCreate = jest.fn().mockRejectedValue(p2002());
      const prisma = makePrisma({
        destinationFindUnique: destFind,
        tourCreate,
      });
      const svc = new ToursService(prisma as never, makeMedia() as never);

      await expect(svc.create(baseCreateDto)).rejects.toBeInstanceOf(
        ConflictException,
      );
      await expect(svc.create(baseCreateDto)).rejects.toMatchObject({
        response: { code: 'TOUR_SLUG_EXISTS' },
      });
    });

    it('normalizes a messy provided slug to canonical kebab', async () => {
      const destFind = jest.fn().mockResolvedValue({ id: 'd-1' });
      const tourCreate = jest.fn().mockResolvedValue(sampleTour);
      const prisma = makePrisma({
        destinationFindUnique: destFind,
        tourCreate,
      });
      const svc = new ToursService(prisma as never, makeMedia() as never);

      await svc.create({ ...baseCreateDto, slug: 'TOUR Đặc Biệt (Hè 2026)' });

      const calls = tourCreate.mock.calls as unknown as TourCreateCall[][];
      expect(calls[0][0].data.slug).toBe('tour-dac-biet-he-2026');
    });

    it('generates the slug from titleEn when omitted', async () => {
      const destFind = jest.fn().mockResolvedValue({ id: 'd-1' });
      const tourCreate = jest.fn().mockResolvedValue(sampleTour);
      const prisma = makePrisma({
        destinationFindUnique: destFind,
        tourCreate,
      });
      const svc = new ToursService(prisma as never, makeMedia() as never);

      await svc.create({
        ...baseCreateDto,
        slug: undefined,
        titleEn: 'Sa Pa Trek & Homestay',
      });

      const calls = tourCreate.mock.calls as unknown as TourCreateCall[][];
      expect(calls[0][0].data.slug).toBe('sa-pa-trek-homestay');
    });
  });

  describe('update', () => {
    it('throws NotFoundException when slug missing — never touches update', async () => {
      const tourFindUnique = jest.fn().mockResolvedValue(null);
      const tourUpdate = jest.fn();
      const prisma = makePrisma({ tourFindUnique, tourUpdate });
      const svc = new ToursService(prisma as never, makeMedia() as never);

      await expect(
        svc.update('missing', { titleEn: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(tourUpdate).not.toHaveBeenCalled();
    });

    it('re-validates new destinationId when present in body', async () => {
      const tourFindUnique = jest.fn().mockResolvedValue(sampleTour);
      const destFind = jest.fn().mockResolvedValue(null);
      const tourUpdate = jest.fn();
      const prisma = makePrisma({
        tourFindUnique,
        destinationFindUnique: destFind,
        tourUpdate,
      });
      const svc = new ToursService(prisma as never, makeMedia() as never);

      await expect(
        svc.update('hoi-an-walking', { destinationId: 'd-bad' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(tourUpdate).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('translates FK violation (P2003) to ConflictException TOUR_HAS_BOOKINGS', async () => {
      const tourFindUnique = jest.fn().mockResolvedValue(sampleTour);
      const tourDelete = jest.fn().mockRejectedValue(p2003());
      const prisma = makePrisma({ tourFindUnique, tourDelete });
      const svc = new ToursService(prisma as never, makeMedia() as never);

      await expect(svc.remove('hoi-an-walking')).rejects.toMatchObject({
        response: { code: 'TOUR_HAS_BOOKINGS' },
      });
    });
  });

  describe('findPublishedList', () => {
    it('returns empty result when destination slug filter does not resolve', async () => {
      const destFind = jest.fn().mockResolvedValue(null);
      const tourFindMany = jest.fn();
      const tourCount = jest.fn();
      const prisma = makePrisma({
        destinationFindUnique: destFind,
        tourFindMany,
        tourCount,
      });
      const svc = new ToursService(prisma as never, makeMedia() as never);

      const result = await svc.findPublishedList({ destination: 'ghost' });

      expect(result.items).toEqual([]);
      expect(result.meta.total).toBe(0);
      // Short-circuit must avoid running the catalog query at all.
      expect(tourFindMany).not.toHaveBeenCalled();
      expect(tourCount).not.toHaveBeenCalled();
    });

    it('pins isPublished:true and merges all supplied filters', async () => {
      const destFind = jest.fn().mockResolvedValue({ id: 'd-1' });
      const tourFindMany = jest.fn().mockResolvedValue([sampleTour]);
      const tourCount = jest.fn().mockResolvedValue(1);
      const prisma = makePrisma({
        destinationFindUnique: destFind,
        tourFindMany,
        tourCount,
      });
      const svc = new ToursService(prisma as never, makeMedia() as never);

      await svc.findPublishedList({
        destination: 'hoi-an',
        category: TourCategory.DAY,
        minPrice: 30,
        maxPrice: 200,
        duration: 1,
        featured: true,
        q: 'lantern',
        page: 2,
        pageSize: 10,
        sortBy: 'basePrice',
        sortOrder: 'asc',
      });

      type FindManyArg = {
        where: Record<string, unknown>;
        skip: number;
        take: number;
        orderBy: Record<string, string>;
      };
      const findManyCalls = tourFindMany.mock
        .calls as unknown as FindManyArg[][];
      const findManyArg = findManyCalls[0][0];
      expect(findManyArg.where).toMatchObject({
        isPublished: true,
        destinationId: 'd-1',
        category: TourCategory.DAY,
        durationDays: 1,
        isFeatured: true,
        basePrice: { gte: 30, lte: 200 },
      });
      expect(findManyArg.where.OR).toBeDefined();
      expect(findManyArg.skip).toBe(10); // (page-1)*pageSize = 1*10
      expect(findManyArg.take).toBe(10);
      expect(findManyArg.orderBy).toEqual({ basePrice: 'asc' });
    });

    it('computes totalPages from total count', async () => {
      const tourFindMany = jest.fn().mockResolvedValue([sampleTour]);
      const tourCount = jest.fn().mockResolvedValue(45);
      const prisma = makePrisma({ tourFindMany, tourCount });
      const svc = new ToursService(prisma as never, makeMedia() as never);

      const result = await svc.findPublishedList({ pageSize: 20 });

      expect(result.meta.total).toBe(45);
      expect(result.meta.totalPages).toBe(3); // ceil(45/20)
    });

    it('joins TourStats (averageRating, reviewsCount, peopleGoing) per card', async () => {
      const tour1 = { ...sampleTour, id: 't-1' };
      const tour2 = { ...sampleTour, id: 't-2', slug: 'sa-pa-trek' };
      const tourFindMany = jest.fn().mockResolvedValue([tour1, tour2]);
      const tourCount = jest.fn().mockResolvedValue(2);
      // Only t-1 has approved reviews; only t-2 has departure seats sold.
      const reviewGroupBy = jest
        .fn()
        .mockResolvedValue([
          { tourId: 't-1', _avg: { rating: 4.5 }, _count: { _all: 3 } },
        ]);
      const departureGroupBy = jest
        .fn()
        .mockResolvedValue([{ tourId: 't-2', _sum: { seatsBooked: 17 } }]);
      const prisma = makePrisma({
        tourFindMany,
        tourCount,
        reviewGroupBy,
        departureGroupBy,
      });
      const svc = new ToursService(prisma as never, makeMedia() as never);

      const result = await svc.findPublishedList({});

      const byId = new Map(result.items.map((i) => [i.id, i]));
      expect(byId.get('t-1')).toMatchObject({
        averageRating: 4.5,
        reviewsCount: 3,
        peopleGoing: 0, // no departure seats
      });
      expect(byId.get('t-2')).toMatchObject({
        averageRating: null, // no approved reviews
        reviewsCount: 0,
        peopleGoing: 17,
      });
    });

    it('skips stats queries when the page is empty', async () => {
      const tourFindMany = jest.fn().mockResolvedValue([]);
      const tourCount = jest.fn().mockResolvedValue(0);
      const reviewGroupBy = jest.fn();
      const departureGroupBy = jest.fn();
      const prisma = makePrisma({
        tourFindMany,
        tourCount,
        reviewGroupBy,
        departureGroupBy,
      });
      const svc = new ToursService(prisma as never, makeMedia() as never);

      const result = await svc.findPublishedList({});

      expect(result.items).toEqual([]);
      // Avoid two no-op groupBy round-trips on an empty page.
      expect(reviewGroupBy).not.toHaveBeenCalled();
      expect(departureGroupBy).not.toHaveBeenCalled();
    });
  });

  describe('findPublishedBySlug', () => {
    it('returns the tour when published', async () => {
      const tourFindFirst = jest.fn().mockResolvedValue({
        ...sampleTour,
        isPublished: true,
      });
      const prisma = makePrisma({ tourFindFirst });
      const svc = new ToursService(prisma as never, makeMedia() as never);

      const result = await svc.findPublishedBySlug('hoi-an-walking');

      expect(result.slug).toBe('hoi-an-walking');
      // The published-only filter MUST be part of the where clause —
      // otherwise drafts leak via the public detail endpoint.
      type FindFirstArg = { where: Record<string, unknown> };
      const findFirstCalls = tourFindFirst.mock
        .calls as unknown as FindFirstArg[][];
      expect(findFirstCalls[0][0]).toMatchObject({
        where: { slug: 'hoi-an-walking', isPublished: true },
      });
    });

    it('throws TOUR_NOT_FOUND when slug missing or unpublished', async () => {
      const tourFindFirst = jest.fn().mockResolvedValue(null);
      const prisma = makePrisma({ tourFindFirst });
      const svc = new ToursService(prisma as never, makeMedia() as never);

      await expect(
        svc.findPublishedBySlug('draft-slug'),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(svc.findPublishedBySlug('draft-slug')).rejects.toMatchObject(
        { response: { code: 'TOUR_NOT_FOUND' } },
      );
    });

    it('returns TourWithStats so detail page can render the rating chip', async () => {
      const tour = { ...sampleTour, id: 't-1', isPublished: true };
      const tourFindFirst = jest.fn().mockResolvedValue(tour);
      const reviewGroupBy = jest
        .fn()
        .mockResolvedValue([
          { tourId: 't-1', _avg: { rating: 5 }, _count: { _all: 12 } },
        ]);
      const departureGroupBy = jest
        .fn()
        .mockResolvedValue([{ tourId: 't-1', _sum: { seatsBooked: 42 } }]);
      const prisma = makePrisma({
        tourFindFirst,
        reviewGroupBy,
        departureGroupBy,
      });
      const svc = new ToursService(prisma as never, makeMedia() as never);

      const result = await svc.findPublishedBySlug('hoi-an-walking');

      expect(result).toMatchObject({
        averageRating: 5,
        reviewsCount: 12,
        peopleGoing: 42,
      });
    });
  });
});
