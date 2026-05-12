import { ConflictException, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, TourItineraryDay } from '@prisma/client';
import { ItineraryService } from './itinerary.service';

beforeAll(() => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
});
afterAll(() => {
  jest.restoreAllMocks();
});

const sampleDay: TourItineraryDay = {
  id: 'day-1',
  tourId: 't-1',
  dayNumber: 1,
  titleEn: 'Arrival',
  titleVi: 'Đến nơi',
  descriptionEn: null,
  descriptionVi: null,
};

function makePrisma(overrides: Partial<Record<string, jest.Mock>> = {}) {
  return {
    tour: {
      findUnique: overrides.tourFindUnique ?? jest.fn(),
    },
    tourItineraryDay: {
      findMany: overrides.dayFindMany ?? jest.fn(),
      findUnique: overrides.dayFindUnique ?? jest.fn(),
      create: overrides.dayCreate ?? jest.fn(),
      update: overrides.dayUpdate ?? jest.fn(),
      delete: overrides.dayDelete ?? jest.fn(),
    },
  };
}

function p2002(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique', {
    code: 'P2002',
    clientVersion: 'test',
  });
}

describe('ItineraryService', () => {
  describe('listForTour', () => {
    it('throws TOUR_NOT_FOUND when slug missing — never touches itinerary table', async () => {
      const tourFindUnique = jest.fn().mockResolvedValue(null);
      const dayFindMany = jest.fn();
      const prisma = makePrisma({ tourFindUnique, dayFindMany });
      const svc = new ItineraryService(prisma as never);

      await expect(svc.listForTour('ghost')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(dayFindMany).not.toHaveBeenCalled();
    });

    it('returns days sorted by dayNumber ascending', async () => {
      const tourFindUnique = jest.fn().mockResolvedValue({ id: 't-1' });
      const dayFindMany = jest.fn().mockResolvedValue([sampleDay]);
      const prisma = makePrisma({ tourFindUnique, dayFindMany });
      const svc = new ItineraryService(prisma as never);

      await svc.listForTour('hoi-an-walking');

      type FindManyArg = {
        where: { tourId: string };
        orderBy: { dayNumber: 'asc' | 'desc' };
      };
      const calls = dayFindMany.mock.calls as unknown as FindManyArg[][];
      expect(calls[0][0].where).toEqual({ tourId: 't-1' });
      expect(calls[0][0].orderBy).toEqual({ dayNumber: 'asc' });
    });
  });

  describe('create', () => {
    it('throws TOUR_NOT_FOUND when slug missing — never inserts', async () => {
      const tourFindUnique = jest.fn().mockResolvedValue(null);
      const dayCreate = jest.fn();
      const prisma = makePrisma({ tourFindUnique, dayCreate });
      const svc = new ItineraryService(prisma as never);

      await expect(
        svc.create('ghost', {
          dayNumber: 1,
          titleEn: 'x',
          titleVi: 'y',
        }),
      ).rejects.toMatchObject({ response: { code: 'TOUR_NOT_FOUND' } });
      expect(dayCreate).not.toHaveBeenCalled();
    });

    it('translates Prisma P2002 into ConflictException ITINERARY_DAY_EXISTS', async () => {
      const tourFindUnique = jest.fn().mockResolvedValue({ id: 't-1' });
      const dayCreate = jest.fn().mockRejectedValue(p2002());
      const prisma = makePrisma({ tourFindUnique, dayCreate });
      const svc = new ItineraryService(prisma as never);

      await expect(
        svc.create('hoi-an-walking', {
          dayNumber: 1,
          titleEn: 'Arrival',
          titleVi: 'Đến nơi',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      await expect(
        svc.create('hoi-an-walking', {
          dayNumber: 1,
          titleEn: 'Arrival',
          titleVi: 'Đến nơi',
        }),
      ).rejects.toMatchObject({ response: { code: 'ITINERARY_DAY_EXISTS' } });
    });
  });

  describe('update', () => {
    it('throws ITINERARY_DAY_NOT_FOUND when (slug, day) missing', async () => {
      const tourFindUnique = jest.fn().mockResolvedValue({ id: 't-1' });
      const dayFindUnique = jest.fn().mockResolvedValue(null);
      const dayUpdate = jest.fn();
      const prisma = makePrisma({ tourFindUnique, dayFindUnique, dayUpdate });
      const svc = new ItineraryService(prisma as never);

      await expect(
        svc.update('hoi-an-walking', 99, { titleEn: 'x' }),
      ).rejects.toMatchObject({
        response: { code: 'ITINERARY_DAY_NOT_FOUND' },
      });
      expect(dayUpdate).not.toHaveBeenCalled();
    });

    it('translates renumber collision (P2002) into ITINERARY_DAY_EXISTS', async () => {
      const tourFindUnique = jest.fn().mockResolvedValue({ id: 't-1' });
      const dayFindUnique = jest.fn().mockResolvedValue(sampleDay);
      const dayUpdate = jest.fn().mockRejectedValue(p2002());
      const prisma = makePrisma({ tourFindUnique, dayFindUnique, dayUpdate });
      const svc = new ItineraryService(prisma as never);

      await expect(
        svc.update('hoi-an-walking', 1, { dayNumber: 2 }),
      ).rejects.toMatchObject({ response: { code: 'ITINERARY_DAY_EXISTS' } });
    });
  });

  describe('remove', () => {
    it('echoes the deleted row when (slug, day) exist', async () => {
      const tourFindUnique = jest.fn().mockResolvedValue({ id: 't-1' });
      const dayFindUnique = jest.fn().mockResolvedValue(sampleDay);
      const dayDelete = jest.fn().mockResolvedValue(sampleDay);
      const prisma = makePrisma({ tourFindUnique, dayFindUnique, dayDelete });
      const svc = new ItineraryService(prisma as never);

      const result = await svc.remove('hoi-an-walking', 1);

      expect(result).toBe(sampleDay);
      expect(dayDelete).toHaveBeenCalledTimes(1);
    });
  });
});
