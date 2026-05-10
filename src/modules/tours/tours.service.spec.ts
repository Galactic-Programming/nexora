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
  heroImage: null,
  gallery: [],
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
    gallery: unknown[];
  };
};

function makePrisma(overrides: Partial<Record<string, jest.Mock>> = {}) {
  return {
    tour: {
      create: overrides.tourCreate ?? jest.fn(),
      update: overrides.tourUpdate ?? jest.fn(),
      delete: overrides.tourDelete ?? jest.fn(),
      findUnique: overrides.tourFindUnique ?? jest.fn(),
    },
    destination: {
      findUnique: overrides.destinationFindUnique ?? jest.fn(),
    },
  };
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
      const svc = new ToursService(prisma as never);

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
      const svc = new ToursService(prisma as never);

      await svc.create({ ...baseCreateDto, currency: 'usd' });

      const calls = tourCreate.mock.calls as unknown as TourCreateCall[][];
      const arg = calls[0][0];
      expect(arg.data.slug).toBe('hoi-an-walking');
      expect(arg.data.currency).toBe('USD'); // uppercased
      expect(arg.data.isPublished).toBe(false); // default draft
      expect(arg.data.isFeatured).toBe(false);
      expect(arg.data.gallery).toEqual([]);
    });

    it('translates Prisma P2002 into ConflictException TOUR_SLUG_EXISTS', async () => {
      const destFind = jest.fn().mockResolvedValue({ id: 'd-1' });
      const tourCreate = jest.fn().mockRejectedValue(p2002());
      const prisma = makePrisma({
        destinationFindUnique: destFind,
        tourCreate,
      });
      const svc = new ToursService(prisma as never);

      await expect(svc.create(baseCreateDto)).rejects.toBeInstanceOf(
        ConflictException,
      );
      await expect(svc.create(baseCreateDto)).rejects.toMatchObject({
        response: { code: 'TOUR_SLUG_EXISTS' },
      });
    });
  });

  describe('update', () => {
    it('throws NotFoundException when slug missing — never touches update', async () => {
      const tourFindUnique = jest.fn().mockResolvedValue(null);
      const tourUpdate = jest.fn();
      const prisma = makePrisma({ tourFindUnique, tourUpdate });
      const svc = new ToursService(prisma as never);

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
      const svc = new ToursService(prisma as never);

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
      const svc = new ToursService(prisma as never);

      await expect(svc.remove('hoi-an-walking')).rejects.toMatchObject({
        response: { code: 'TOUR_HAS_BOOKINGS' },
      });
    });
  });
});
