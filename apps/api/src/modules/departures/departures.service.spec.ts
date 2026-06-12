import {
  BadRequestException,
  ConflictException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DepartureStatus, Prisma, TourDeparture } from '@prisma/client';
import { DeparturesService } from './departures.service';

beforeAll(() => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
});
afterAll(() => {
  jest.restoreAllMocks();
});

const sampleDeparture: TourDeparture = {
  id: 'dep-1',
  tourId: 't-1',
  startDate: new Date('2026-08-15T00:00:00Z'),
  endDate: new Date('2026-08-15T00:00:00Z'),
  priceOverride: null,
  seatsTotal: 15,
  seatsBooked: 0,
  status: DepartureStatus.OPEN,
  createdAt: new Date('2026-05-08T00:00:00Z'),
  updatedAt: new Date('2026-05-08T00:00:00Z'),
};

function makePrisma(overrides: Partial<Record<string, jest.Mock>> = {}) {
  return {
    tour: {
      findUnique: overrides.tourFindUnique ?? jest.fn(),
      findFirst: overrides.tourFindFirst ?? jest.fn(),
    },
    tourDeparture: {
      findMany: overrides.depFindMany ?? jest.fn(),
      findFirst: overrides.depFindFirst ?? jest.fn(),
      create: overrides.depCreate ?? jest.fn(),
      update: overrides.depUpdate ?? jest.fn(),
      delete: overrides.depDelete ?? jest.fn(),
    },
  };
}

function p2003(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('FK', {
    code: 'P2003',
    clientVersion: 'test',
  });
}

describe('DeparturesService', () => {
  describe('findPublicListForTour', () => {
    it('throws TOUR_NOT_FOUND when slug missing or unpublished', async () => {
      const tourFindFirst = jest.fn().mockResolvedValue(null);
      const depFindMany = jest.fn();
      const prisma = makePrisma({ tourFindFirst, depFindMany });
      const svc = new DeparturesService(prisma as never);

      await expect(
        svc.findPublicListForTour('draft', {}),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(depFindMany).not.toHaveBeenCalled();
    });

    it('defaults status=OPEN and from=today when not supplied', async () => {
      const tourFindFirst = jest.fn().mockResolvedValue({ id: 't-1' });
      const depFindMany = jest.fn().mockResolvedValue([sampleDeparture]);
      const prisma = makePrisma({ tourFindFirst, depFindMany });
      const svc = new DeparturesService(prisma as never);

      await svc.findPublicListForTour('hoi-an-walking', {});

      type FindManyArg = {
        where: {
          tourId: string;
          status: DepartureStatus;
          startDate: { gte?: Date; lte?: Date };
        };
      };
      const calls = depFindMany.mock.calls as unknown as FindManyArg[][];
      const arg = calls[0][0];
      expect(arg.where.status).toBe(DepartureStatus.OPEN);
      expect(arg.where.startDate.gte).toBeInstanceOf(Date);
      // No `to` supplied → no upper bound.
      expect(arg.where.startDate.lte).toBeUndefined();
    });
  });

  describe('findAdminListForTour', () => {
    it('omits implicit defaults — admin sees full history when no filters supplied', async () => {
      const tourFindUnique = jest.fn().mockResolvedValue({ id: 't-1' });
      const depFindMany = jest.fn().mockResolvedValue([]);
      const prisma = makePrisma({ tourFindUnique, depFindMany });
      const svc = new DeparturesService(prisma as never);

      await svc.findAdminListForTour('hoi-an-walking', {});

      type FindManyArg = {
        where: { tourId: string; status?: DepartureStatus; startDate?: object };
      };
      const calls = depFindMany.mock.calls as unknown as FindManyArg[][];
      const arg = calls[0][0];
      expect(arg.where.status).toBeUndefined();
      expect(arg.where.startDate).toBeUndefined();
    });
  });

  describe('create', () => {
    it('rejects INVALID_DATE_RANGE when endDate < startDate', async () => {
      const tourFindUnique = jest.fn().mockResolvedValue({ id: 't-1' });
      const depCreate = jest.fn();
      const prisma = makePrisma({ tourFindUnique, depCreate });
      const svc = new DeparturesService(prisma as never);

      await expect(
        svc.create('hoi-an-walking', {
          startDate: '2026-08-20',
          endDate: '2026-08-15',
          seatsTotal: 10,
        }),
      ).rejects.toMatchObject({ response: { code: 'INVALID_DATE_RANGE' } });
      expect(depCreate).not.toHaveBeenCalled();
    });

    it('rejects DEPARTURE_IN_PAST when startDate is before today (UTC)', async () => {
      const tourFindUnique = jest.fn().mockResolvedValue({ id: 't-1' });
      const depCreate = jest.fn();
      const prisma = makePrisma({ tourFindUnique, depCreate });
      const svc = new DeparturesService(prisma as never);

      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);

      await expect(
        svc.create('hoi-an-walking', {
          startDate: yesterday,
          endDate: yesterday,
          seatsTotal: 10,
        }),
      ).rejects.toMatchObject({ response: { code: 'DEPARTURE_IN_PAST' } });
      expect(depCreate).not.toHaveBeenCalled();
    });

    it('allows a departure starting TODAY (same-day, UTC)', async () => {
      const tourFindUnique = jest.fn().mockResolvedValue({ id: 't-1' });
      const depCreate = jest.fn().mockResolvedValue(sampleDeparture);
      const prisma = makePrisma({ tourFindUnique, depCreate });
      const svc = new DeparturesService(prisma as never);

      const today = new Date().toISOString().slice(0, 10);
      await svc.create('hoi-an-walking', {
        startDate: today,
        endDate: today,
        seatsTotal: 10,
      });
      expect(depCreate).toHaveBeenCalled();
    });

    it('persists with seatsBooked=0 and default status=OPEN when status omitted', async () => {
      const tourFindUnique = jest.fn().mockResolvedValue({ id: 't-1' });
      const depCreate = jest.fn().mockResolvedValue(sampleDeparture);
      const prisma = makePrisma({ tourFindUnique, depCreate });
      const svc = new DeparturesService(prisma as never);

      await svc.create('hoi-an-walking', {
        startDate: '2026-08-15',
        endDate: '2026-08-15',
        seatsTotal: 15,
      });

      type CreateArg = {
        data: {
          status: DepartureStatus;
          priceOverride: Prisma.Decimal | null;
          startDate: Date;
        };
      };
      const calls = depCreate.mock.calls as unknown as CreateArg[][];
      const arg = calls[0][0];
      expect(arg.data.status).toBe(DepartureStatus.OPEN);
      expect(arg.data.priceOverride).toBeNull();
      expect(arg.data.startDate).toBeInstanceOf(Date);
    });
  });

  describe('update', () => {
    it('refuses SEATS_TOTAL_BELOW_BOOKED when shrinking capacity below sold seats', async () => {
      const tourFindUnique = jest.fn().mockResolvedValue({ id: 't-1' });
      const depFindFirst = jest
        .fn()
        .mockResolvedValue({ ...sampleDeparture, seatsBooked: 8 });
      const depUpdate = jest.fn();
      const prisma = makePrisma({ tourFindUnique, depFindFirst, depUpdate });
      const svc = new DeparturesService(prisma as never);

      await expect(
        svc.update('hoi-an-walking', 'dep-1', { seatsTotal: 5 }),
      ).rejects.toMatchObject({
        response: { code: 'SEATS_TOTAL_BELOW_BOOKED' },
      });
      expect(depUpdate).not.toHaveBeenCalled();
    });

    it('re-validates date range when only one date is patched', async () => {
      const tourFindUnique = jest.fn().mockResolvedValue({ id: 't-1' });
      const depFindFirst = jest.fn().mockResolvedValue(sampleDeparture);
      const depUpdate = jest.fn();
      const prisma = makePrisma({ tourFindUnique, depFindFirst, depUpdate });
      const svc = new DeparturesService(prisma as never);

      // Existing startDate is 2026-08-15; new endDate before it → invalid.
      await expect(
        svc.update('hoi-an-walking', 'dep-1', { endDate: '2026-07-01' }),
      ).rejects.toMatchObject({ response: { code: 'INVALID_DATE_RANGE' } });
      expect(depUpdate).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('refuses delete with 409 DEPARTURE_HAS_BOOKINGS when seatsBooked > 0', async () => {
      const tourFindUnique = jest.fn().mockResolvedValue({ id: 't-1' });
      const depFindFirst = jest
        .fn()
        .mockResolvedValue({ ...sampleDeparture, seatsBooked: 1 });
      const depDelete = jest.fn();
      const prisma = makePrisma({ tourFindUnique, depFindFirst, depDelete });
      const svc = new DeparturesService(prisma as never);

      await expect(
        svc.remove('hoi-an-walking', 'dep-1'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(depDelete).not.toHaveBeenCalled();
    });

    it('translates P2003 race-condition FK failure to DEPARTURE_HAS_BOOKINGS', async () => {
      const tourFindUnique = jest.fn().mockResolvedValue({ id: 't-1' });
      const depFindFirst = jest.fn().mockResolvedValue(sampleDeparture);
      const depDelete = jest.fn().mockRejectedValue(p2003());
      const prisma = makePrisma({ tourFindUnique, depFindFirst, depDelete });
      const svc = new DeparturesService(prisma as never);

      await expect(svc.remove('hoi-an-walking', 'dep-1')).rejects.toMatchObject(
        { response: { code: 'DEPARTURE_HAS_BOOKINGS' } },
      );
    });

    it('echoes the deleted row when seats are zero', async () => {
      const tourFindUnique = jest.fn().mockResolvedValue({ id: 't-1' });
      const depFindFirst = jest.fn().mockResolvedValue(sampleDeparture);
      const depDelete = jest.fn().mockResolvedValue(sampleDeparture);
      const prisma = makePrisma({ tourFindUnique, depFindFirst, depDelete });
      const svc = new DeparturesService(prisma as never);

      const result = await svc.remove('hoi-an-walking', 'dep-1');

      expect(result).toBe(sampleDeparture);
      // Sanity: must not raise BadRequest about validation order.
      expect(result).not.toBeInstanceOf(BadRequestException);
    });
  });

  describe('findDepartureOrThrow', () => {
    it('throws DEPARTURE_NOT_FOUND when departure id missing under the parent tour', async () => {
      const tourFindUnique = jest.fn().mockResolvedValue({ id: 't-1' });
      const depFindFirst = jest.fn().mockResolvedValue(null);
      const depUpdate = jest.fn();
      const prisma = makePrisma({ tourFindUnique, depFindFirst, depUpdate });
      const svc = new DeparturesService(prisma as never);

      await expect(
        svc.update('hoi-an-walking', 'ghost-id', { seatsTotal: 5 }),
      ).rejects.toMatchObject({ response: { code: 'DEPARTURE_NOT_FOUND' } });
    });
  });
});
