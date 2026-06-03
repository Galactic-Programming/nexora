import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MediaOwnerType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { buildCloudinaryUrl } from '../../lib/cloudinary-url';
import { MediaInputDto, MediaItemDto } from './dto/media.dto';

/** Row carrying an `id` we can attach media to. */
interface HasId {
  id: string;
}

/**
 * Single owner of `MediaAsset` access. Tours, destinations, and users all go
 * through here so the Cloudinary detail + polymorphic `(ownerType, ownerId)`
 * convention live in exactly one place.
 *
 * Writes (`syncAssets`, `deleteForOwner`) accept a `Prisma.TransactionClient`
 * so the caller runs them inside the same transaction that mutates the owner
 * row — keeping media + owner atomic and avoiding orphaned assets.
 *
 * Reads (`attachToOwners`) build delivery URLs from `publicId` at read time.
 *
 * See docs/planning/cloudinary-media-migration.md.
 */
@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Replace-all sync of an owner's media set. The `assets` array is the FULL
   * desired set for that owner — existing rows are deleted and recreated, so
   * removing an item from the FE payload removes it from the DB.
   *
   * Runs entirely on the supplied `tx` so it commits/rolls back with the
   * owner mutation.
   */
  async syncAssets(
    tx: Prisma.TransactionClient,
    ownerType: MediaOwnerType,
    ownerId: string,
    assets: MediaInputDto[],
  ): Promise<void> {
    await tx.mediaAsset.deleteMany({ where: { ownerType, ownerId } });

    if (assets.length === 0) return;

    await tx.mediaAsset.createMany({
      data: assets.map((a, index) => ({
        publicId: a.publicId,
        type: a.type,
        ownerType,
        ownerId,
        role: a.role,
        format: a.format ?? null,
        width: a.width ?? null,
        height: a.height ?? null,
        durationSec: a.durationSec ?? null,
        posterId: a.posterId ?? null,
        // Fall back to array index so callers can rely on stable ordering
        // even when the FE omits explicit sortOrder.
        sortOrder: a.sortOrder ?? index,
      })),
    });
  }

  /**
   * Deletes every media asset for an owner. Used on owner hard-delete (since
   * there's no DB-level FK cascade for the polymorphic relation).
   */
  async deleteForOwner(
    tx: Prisma.TransactionClient,
    ownerType: MediaOwnerType,
    ownerId: string,
  ): Promise<void> {
    await tx.mediaAsset.deleteMany({ where: { ownerType, ownerId } });
  }

  /**
   * Attaches a `media` array (with built delivery URLs) to each owner row.
   * One query for the whole batch — no N+1. Returns NEW objects so callers'
   * inputs aren't mutated.
   */
  async attachToOwners<T extends HasId>(
    ownerType: MediaOwnerType,
    owners: T[],
  ): Promise<Array<T & { media: MediaItemDto[] }>> {
    if (owners.length === 0) return [];

    const cloudName = this.config.getOrThrow<string>('cloudinary.cloudName');
    const ownerIds = owners.map((o) => o.id);

    const assets = await this.prisma.mediaAsset.findMany({
      where: { ownerType, ownerId: { in: ownerIds } },
      orderBy: { sortOrder: 'asc' },
    });

    const byOwner = new Map<string, MediaItemDto[]>();
    for (const asset of assets) {
      const urls = buildCloudinaryUrl(cloudName, {
        type: asset.type,
        publicId: asset.publicId,
        posterId: asset.posterId,
      });
      const item: MediaItemDto = {
        url: urls.url,
        type: asset.type,
        role: asset.role,
        posterUrl: urls.posterUrl,
        width: asset.width,
        height: asset.height,
        durationSec: asset.durationSec,
        sortOrder: asset.sortOrder,
      };
      const list = byOwner.get(asset.ownerId);
      if (list) list.push(item);
      else byOwner.set(asset.ownerId, [item]);
    }

    return owners.map((o) => ({ ...o, media: byOwner.get(o.id) ?? [] }));
  }

  /** Single-owner convenience wrapper around {@link attachToOwners}. */
  async attachToOwner<T extends HasId>(
    ownerType: MediaOwnerType,
    owner: T,
  ): Promise<T & { media: MediaItemDto[] }> {
    const [withMedia] = await this.attachToOwners(ownerType, [owner]);
    return withMedia;
  }
}
