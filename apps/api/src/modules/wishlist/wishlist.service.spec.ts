import { Logger, NotFoundException } from '@nestjs/common';
import { WishlistService } from './wishlist.service';

beforeAll(() => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
});
afterAll(() => {
  jest.restoreAllMocks();
});

function makePrisma(opts: {
  tourFindFirst?: jest.Mock;
  upsert?: jest.Mock;
  deleteMany?: jest.Mock;
  findMany?: jest.Mock;
}) {
  return {
    tour: { findFirst: opts.tourFindFirst ?? jest.fn() },
    wishlist: {
      upsert: opts.upsert ?? jest.fn(),
      deleteMany: opts.deleteMany ?? jest.fn().mockResolvedValue({ count: 0 }),
      findMany: opts.findMany ?? jest.fn().mockResolvedValue([]),
    },
  };
}

/** Stub of MediaService — attach passes tours through with empty media. */
function makeMedia() {
  return {
    attachToOwners: jest.fn(
      (_t: unknown, items: Array<Record<string, unknown>>) =>
        Promise.resolve(items.map((i) => ({ ...i, media: [] }))),
    ),
  };
}

describe('WishlistService.add', () => {
  it('throws TOUR_NOT_FOUND when tour is missing or unpublished', async () => {
    const svc = new WishlistService(
      makePrisma({ tourFindFirst: jest.fn().mockResolvedValue(null) }) as never,
      makeMedia() as never,
    );
    await expect(
      svc.add('u-1', '11111111-1111-1111-1111-111111111111'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('upserts on the (userId, tourId) composite — idempotent re-add', async () => {
    const upsert = jest
      .fn()
      .mockResolvedValue({ userId: 'u-1', tourId: 't-1' });
    const svc = new WishlistService(
      makePrisma({
        tourFindFirst: jest.fn().mockResolvedValue({ id: 't-1' }),
        upsert,
      }) as never,
      makeMedia() as never,
    );

    await svc.add('u-1', 't-1');

    type UpsertCall = {
      where: { userId_tourId: { userId: string; tourId: string } };
    };
    const calls = upsert.mock.calls as unknown as UpsertCall[][];
    expect(calls[0][0].where.userId_tourId).toEqual({
      userId: 'u-1',
      tourId: 't-1',
    });
  });
});

describe('WishlistService.remove', () => {
  it('uses deleteMany so missing rows do not throw (idempotent)', async () => {
    const deleteMany = jest.fn().mockResolvedValue({ count: 0 });
    const svc = new WishlistService(
      makePrisma({ deleteMany }) as never,
      makeMedia() as never,
    );
    await expect(svc.remove('u-1', 't-1')).resolves.toBeUndefined();
    type DelCall = { where: { userId: string; tourId: string } };
    const calls = deleteMany.mock.calls as unknown as DelCall[][];
    expect(calls[0][0].where).toEqual({ userId: 'u-1', tourId: 't-1' });
  });
});

describe('WishlistService.findMineWithTour', () => {
  it('returns newest-first rows with tour preview joined', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        userId: 'u-1',
        tourId: 't-1',
        createdAt: new Date('2026-05-14'),
        tour: { id: 't-1', slug: 'hoi-an', titleEn: 'Hoi An' },
      },
    ]);
    const svc = new WishlistService(
      makePrisma({ findMany }) as never,
      makeMedia() as never,
    );

    const result = await svc.findMineWithTour('u-1');

    expect(result).toHaveLength(1);
    expect(result[0].tour.slug).toBe('hoi-an');
    type FindCall = { orderBy: { createdAt: 'desc' | 'asc' } };
    const calls = findMany.mock.calls as unknown as FindCall[][];
    expect(calls[0][0].orderBy.createdAt).toBe('desc');
  });
});
