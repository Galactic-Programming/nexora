import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { MediaOwnerType, Tour, Wishlist } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MediaService } from '../media/media.service';
import { MediaItemDto } from '../media/dto/media.dto';

/**
 * Customer wishlist surface (Sprint B4.4).
 *
 * Schema is a composite-PK join table `(userId, tourId)` — no surrogate
 * id. Add is implemented as an upsert (idempotent: re-adding the same
 * tour is a no-op, not 409). Remove is also idempotent — removing
 * something that's not there returns 204 without error.
 *
 * Hot path: `findMineWithTour` joins the tour row so the FE renders the
 * wishlist page without a second fetch per item. We pull only the
 * marketing-relevant fields (slug, titles, base price, currency, duration)
 * plus Cloudinary `media` — never the full row.
 */
@Injectable()
export class WishlistService {
  private readonly logger = new Logger(WishlistService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
  ) {}

  /**
   * Upserts the (userId, tourId) row. Validates the tour exists and is
   * published first — wishing for a draft or non-existent tour is a 404.
   */
  async add(customerUserId: string, tourId: string): Promise<Wishlist> {
    const tour = await this.prisma.tour.findFirst({
      where: { id: tourId, isPublished: true },
      select: { id: true },
    });
    if (!tour) {
      throw new NotFoundException({
        code: 'TOUR_NOT_FOUND',
        message: `Tour "${tourId}" not found`,
      });
    }
    const row = await this.prisma.wishlist.upsert({
      where: { userId_tourId: { userId: customerUserId, tourId } },
      update: {},
      create: { userId: customerUserId, tourId },
    });
    this.logger.log(`User ${customerUserId} wished tour ${tourId}`);
    return row;
  }

  /**
   * Idempotent delete. Prisma's `deleteMany` returns `{ count }` without
   * throwing on no-match, which is what we want — the FE can fire
   * DELETE without first checking existence.
   */
  async remove(customerUserId: string, tourId: string): Promise<void> {
    await this.prisma.wishlist.deleteMany({
      where: { userId: customerUserId, tourId },
    });
  }

  /**
   * Wishlist for the calling user, with the joined tour preview.
   * Newest-first; cap at 100 — anyone with more than 100 wishlisted
   * tours is an edge case we'll paginate later.
   */
  async findMineWithTour(
    customerUserId: string,
  ): Promise<
    Array<Wishlist & { tour: Partial<Tour> & { media: MediaItemDto[] } }>
  > {
    const rows = await this.prisma.wishlist.findMany({
      where: { userId: customerUserId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        tour: {
          select: {
            id: true,
            slug: true,
            titleEn: true,
            titleVi: true,
            summaryEn: true,
            summaryVi: true,
            basePrice: true,
            currency: true,
            durationDays: true,
            destinationId: true,
            isPublished: true,
          },
        },
      },
    });

    // Attach Cloudinary media so the wishlist preview can render the hero
    // image (replaces the dropped `tour.heroImage` column). One batched query.
    const tours = rows.map((r) => r.tour);
    const toursWithMedia = await this.media.attachToOwners(
      MediaOwnerType.TOUR,
      tours,
    );
    const mediaById = new Map(toursWithMedia.map((t) => [t.id, t.media]));

    return rows.map((r) => ({
      ...r,
      tour: { ...r.tour, media: mediaById.get(r.tour.id) ?? [] },
    }));
  }
}
