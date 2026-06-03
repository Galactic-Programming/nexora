import { ConfigService } from '@nestjs/config';
import { MediaOwnerType, MediaType } from '@prisma/client';
import { MediaService } from './media.service';
import { MediaInputDto } from './dto/media.dto';

function makeConfig(): ConfigService {
  return {
    getOrThrow: jest.fn((key: string) => {
      if (key === 'cloudinary.cloudName') return 'demo-cloud';
      throw new Error(`missing config: ${key}`);
    }),
  } as unknown as ConfigService;
}

function makePrisma(
  overrides: Partial<{
    deleteMany: jest.Mock;
    createMany: jest.Mock;
    findMany: jest.Mock;
  }> = {},
) {
  return {
    mediaAsset: {
      deleteMany: overrides.deleteMany ?? jest.fn().mockResolvedValue({}),
      createMany: overrides.createMany ?? jest.fn().mockResolvedValue({}),
      findMany: overrides.findMany ?? jest.fn().mockResolvedValue([]),
    },
  };
}

describe('MediaService', () => {
  describe('syncAssets', () => {
    it('deletes existing assets then bulk-creates the new set (replace-all)', async () => {
      const deleteMany = jest.fn().mockResolvedValue({});
      const createMany = jest.fn().mockResolvedValue({});
      const prisma = makePrisma({ deleteMany, createMany });
      const svc = new MediaService(prisma as never, makeConfig());

      const assets: MediaInputDto[] = [
        { publicId: 'p/hero', type: MediaType.IMAGE, role: 'hero' },
        { publicId: 'p/g1', type: MediaType.IMAGE, role: 'gallery' },
      ];

      await svc.syncAssets(prisma as never, MediaOwnerType.TOUR, 't-1', assets);

      expect(deleteMany).toHaveBeenCalledWith({
        where: { ownerType: 'TOUR', ownerId: 't-1' },
      });
      const createCalls = createMany.mock.calls as unknown as Array<
        [{ data: Array<{ sortOrder: number; ownerId: string; role: string }> }]
      >;
      const createArg = createCalls[0][0];
      expect(createArg.data).toHaveLength(2);
      // Falls back to array index for sortOrder when omitted.
      expect(createArg.data[0].sortOrder).toBe(0);
      expect(createArg.data[1].sortOrder).toBe(1);
      expect(createArg.data[0].ownerId).toBe('t-1');
    });

    it('deletes but does not create when the set is empty', async () => {
      const deleteMany = jest.fn().mockResolvedValue({});
      const createMany = jest.fn();
      const prisma = makePrisma({ deleteMany, createMany });
      const svc = new MediaService(prisma as never, makeConfig());

      await svc.syncAssets(prisma as never, MediaOwnerType.TOUR, 't-1', []);

      expect(deleteMany).toHaveBeenCalled();
      expect(createMany).not.toHaveBeenCalled();
    });
  });

  describe('attachToOwners', () => {
    it('returns empty array for no owners without querying', async () => {
      const findMany = jest.fn();
      const prisma = makePrisma({ findMany });
      const svc = new MediaService(prisma as never, makeConfig());

      const result = await svc.attachToOwners(MediaOwnerType.TOUR, []);

      expect(result).toEqual([]);
      expect(findMany).not.toHaveBeenCalled();
    });

    it('groups assets per owner and builds delivery URLs', async () => {
      const findMany = jest.fn().mockResolvedValue([
        {
          ownerId: 't-1',
          publicId: 'p/hero',
          type: MediaType.IMAGE,
          role: 'hero',
          posterId: null,
          width: 1920,
          height: 1080,
          durationSec: null,
          sortOrder: 0,
        },
        {
          ownerId: 't-2',
          publicId: 'p/clip',
          type: MediaType.VIDEO,
          role: 'gallery',
          posterId: null,
          width: null,
          height: null,
          durationSec: 12,
          sortOrder: 0,
        },
      ]);
      const prisma = makePrisma({ findMany });
      const svc = new MediaService(prisma as never, makeConfig());

      const result = await svc.attachToOwners(MediaOwnerType.TOUR, [
        { id: 't-1' },
        { id: 't-2' },
        { id: 't-3' },
      ]);

      const byId = new Map(result.map((r) => [r.id, r]));
      expect(byId.get('t-1')?.media[0].url).toContain(
        '/image/upload/f_auto,q_auto/p/hero',
      );
      expect(byId.get('t-2')?.media[0].type).toBe(MediaType.VIDEO);
      expect(byId.get('t-2')?.media[0].posterUrl).toContain('/so_0/');
      // Owner with no assets gets an empty media array.
      expect(byId.get('t-3')?.media).toEqual([]);
    });
  });
});
