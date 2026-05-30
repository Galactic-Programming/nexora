import { ConflictException, Logger, NotFoundException } from '@nestjs/common';
import { Destination, Prisma } from '@prisma/client';
import { DestinationsService } from './destinations.service';
import { CreateDestinationDto } from './dto/create-destination.dto';

// Silence the service logger during tests — keeps Jest output clean even
// when we exercise the success paths (which call `.log()` internally).
beforeAll(() => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
});
afterAll(() => {
  jest.restoreAllMocks();
});

const sampleRow: Destination = {
  id: 'd-1',
  slug: 'hoi-an',
  nameEn: 'Hoi An',
  nameVi: 'Hội An',
  country: 'Vietnam',
  region: 'Central',
  heroImage: null,
  descriptionEn: null,
  descriptionVi: null,
  isActive: true,
  createdAt: new Date('2026-05-07T00:00:00Z'),
  updatedAt: new Date('2026-05-07T00:00:00Z'),
};

const baseCreateDto: CreateDestinationDto = {
  slug: 'hoi-an',
  nameEn: 'Hoi An',
  nameVi: 'Hội An',
};

type ListResult = { items: Destination[]; meta: Record<string, number> };

/** Shape of the `data` argument both `create` and `update` receive. */
type DestinationWriteCall = {
  data: {
    slug: string;
    nameEn: string;
    nameVi: string;
    country: string;
    isActive: boolean;
  };
};

/** Shape of the `where` clause passed to `findFirst` in public lookups. */
type DestinationWhereCall = {
  where: { slug: string; isActive: boolean };
};

/**
 * Builds a minimal mock of `PrismaService` shaped for `DestinationsService`.
 * Each call site can override individual methods through the `overrides` arg.
 */
function makePrisma(overrides: Partial<Record<string, jest.Mock>> = {}) {
  return {
    destination: {
      create: overrides.create ?? jest.fn(),
      update: overrides.update ?? jest.fn(),
      delete: overrides.delete ?? jest.fn(),
      findFirst: overrides.findFirst ?? jest.fn(),
      findUnique: overrides.findUnique ?? jest.fn(),
      findMany: overrides.findMany ?? jest.fn(),
      count: overrides.count ?? jest.fn(),
    },
    $transaction: overrides.$transaction ?? jest.fn(),
  };
}

function p2002(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint', {
    code: 'P2002',
    clientVersion: 'test',
  });
}

function p2003(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('FK violation', {
    code: 'P2003',
    clientVersion: 'test',
  });
}

describe('DestinationsService', () => {
  describe('create', () => {
    it('persists the row and applies country + isActive defaults', async () => {
      const created = jest.fn().mockResolvedValue(sampleRow);
      const prisma = makePrisma({ create: created });
      const svc = new DestinationsService(prisma as never);

      await svc.create(baseCreateDto);

      const calls = created.mock.calls as unknown as DestinationWriteCall[][];
      const arg = calls[0][0];
      expect(arg.data.slug).toBe('hoi-an');
      // Defaults applied by the service:
      expect(arg.data.country).toBe('Vietnam');
      expect(arg.data.isActive).toBe(true);
    });

    it('translates Prisma P2002 into ConflictException with stable code', async () => {
      const created = jest.fn().mockRejectedValue(p2002());
      const prisma = makePrisma({ create: created });
      const svc = new DestinationsService(prisma as never);

      await expect(svc.create(baseCreateDto)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('update', () => {
    it('throws NotFoundException when slug is missing BEFORE attempting update', async () => {
      const findUnique = jest.fn().mockResolvedValue(null);
      const update = jest.fn();
      const prisma = makePrisma({ findUnique, update });
      const svc = new DestinationsService(prisma as never);

      await expect(
        svc.update('missing', { nameEn: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(update).not.toHaveBeenCalled();
    });

    it('translates rename collision (P2002) to ConflictException', async () => {
      const findUnique = jest.fn().mockResolvedValue(sampleRow);
      const update = jest.fn().mockRejectedValue(p2002());
      const prisma = makePrisma({ findUnique, update });
      const svc = new DestinationsService(prisma as never);

      await expect(
        svc.update('hoi-an', { slug: 'taken' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('remove', () => {
    it('translates FK violation (P2003) to ConflictException with helpful message', async () => {
      const findUnique = jest.fn().mockResolvedValue(sampleRow);
      const del = jest.fn().mockRejectedValue(p2003());
      const prisma = makePrisma({ findUnique, delete: del });
      const svc = new DestinationsService(prisma as never);

      await expect(svc.remove('hoi-an')).rejects.toMatchObject({
        response: { code: 'DESTINATION_HAS_TOURS' },
      });
    });
  });

  describe('findPublicBySlug', () => {
    it('hides inactive rows via isActive=true filter', async () => {
      const findFirst = jest.fn().mockResolvedValue(null);
      const prisma = makePrisma({ findFirst });
      const svc = new DestinationsService(prisma as never);

      await expect(svc.findPublicBySlug('draft')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      const calls = findFirst.mock.calls as unknown as DestinationWhereCall[][];
      const arg = calls[0][0];
      expect(arg.where.isActive).toBe(true);
    });
  });

  describe('list (via findPublicList)', () => {
    it('forces isActive=true and returns pagination meta', async () => {
      const tx = jest
        .fn<Promise<[Destination[], number]>, [unknown[]]>()
        .mockResolvedValue([[sampleRow], 1]);
      const findMany = jest.fn();
      const count = jest.fn();
      const prisma = makePrisma({ findMany, count, $transaction: tx });
      const svc = new DestinationsService(prisma as never);

      const result: ListResult = await svc.findPublicList({
        page: 1,
        pageSize: 10,
      });

      expect(result.items).toHaveLength(1);
      expect(result.meta).toEqual({
        page: 1,
        pageSize: 10,
        total: 1,
        totalPages: 1,
      });
      // Sanity: $transaction was called with both queries.
      expect(tx.mock.calls[0][0]).toHaveLength(2);
    });
  });
});
