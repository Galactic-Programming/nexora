import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Tour, Wishlist } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

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
 * marketing-relevant fields (slug, titles, hero, base price, currency,
 * duration) — never the full row.
 */
@Injectable()
export class WishlistService {
  private readonly logger = new Logger(WishlistService.name);

  constructor(private readonly prisma: PrismaService) {}

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
  ): Promise<Array<Wishlist & { tour: Partial<Tour> }>> {
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
            heroImage: true,
            basePrice: true,
            currency: true,
            durationDays: true,
            destinationId: true,
            isPublished: true,
          },
        },
      },
    });
    return rows;
  }
}
