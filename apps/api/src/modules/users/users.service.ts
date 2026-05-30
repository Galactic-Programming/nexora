import { Injectable, NotFoundException } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateMeDto } from './dto/update-me.dto';

/**
 * Read + self-update operations on the local `users` table.
 *
 * Scope is intentionally narrow: anything that a user can do TO THEMSELVES.
 * Admin operations on other users belong in a future `AdminUsersService`.
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fetches a single `User` row by primary key.
   *
   * The 404 here is a defensive race-condition fallback. In normal flow,
   * the controller has already verified `req.currentUser` exists (so this
   * lookup will succeed); this throw only fires when the row was deleted
   * between the guard and this query — extremely rare, but fail clearly
   * if it happens.
   *
   * @param userId  Local primary key (`User.id`), NOT the Supabase `sub`.
   * @returns       The full `User` row.
   * @throws NotFoundException — when the row no longer exists.
   */
  async getMe(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User not found — call POST /auth/sync first',
      });
    }
    return user;
  }

  /**
   * Partial update of mutable profile fields.
   *
   * Spread-conditional pattern: each field is only included in the Prisma
   * `data` object when the caller explicitly sent it. This means:
   *  - `body.fullName === undefined`  → keep existing value
   *  - `body.fullName === ''`         → set to `null` (we treat blank as
   *    "clear this field")
   *  - any non-empty string           → trim + store
   *
   * Locale follows the same logic but never gets normalized to null —
   * either the user picked a `Locale` enum value or they didn't.
   *
   * @param userId  Local primary key (`User.id`).
   * @param body    Validated `UpdateMeDto` from the request.
   * @returns       The updated `User` row.
   */
  async updateMe(userId: string, body: UpdateMeDto): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(body.fullName !== undefined
          ? { fullName: body.fullName.trim() || null }
          : {}),
        ...(body.phone !== undefined
          ? { phone: body.phone.trim() || null }
          : {}),
        ...(body.locale !== undefined ? { locale: body.locale } : {}),
      },
    });
  }
}
