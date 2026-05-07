import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Locale, User, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { SupabaseAuthIdentity } from '../../common/types/authenticated-request';
import { SyncUserDto } from './dto/sync-user.dto';

/**
 * Owns the "mirror Supabase Auth users into our local DB" workflow.
 *
 * Why mirror at all? Two reasons:
 *  1. Foreign keys: bookings, reviews, etc. reference a local `users.id`
 *     UUID. We can't make those FKs reference Supabase's auth schema
 *     directly (different database / different ownership).
 *  2. Profile data: our domain has fields Supabase doesn't (locale, phone,
 *     role). We need somewhere to store them.
 *
 * The sync is **idempotent** — every login can call it; existing rows are
 * refreshed in place. Only `/auth/admin/sync` performs an additional
 * allowlist check before promoting to ADMIN.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Upserts the JWT-bearing user into the local `users` table as a CUSTOMER.
   *
   * Behaviour:
   *  - First call → creates a new row with role `CUSTOMER`.
   *  - Subsequent calls → refreshes email / profile fields from the latest
   *    JWT + body, but does NOT touch the `role` column. This is the key
   *    safety property: if a user was previously promoted to ADMIN through
   *    `/auth/admin/sync`, calling `/auth/sync` from the customer FE will
   *    not silently demote them.
   *
   * @param identity  Verified Supabase JWT subset (`sub`, `email`, ...).
   *                  Provided by `SupabaseJwtGuard` via `@SupabaseIdentity()`.
   * @param body      Optional profile fields submitted by the FE.
   * @returns         The freshly upserted local `User` row.
   */
  async syncCustomer(
    identity: SupabaseAuthIdentity,
    body: SyncUserDto,
  ): Promise<User> {
    return this.upsert(identity, body, UserRole.CUSTOMER);
  }

  /**
   * Upserts the JWT-bearing user as an ADMIN.
   *
   * Behaviour:
   *  - Compares the JWT's email (lowercased) against the
   *    `supabase.adminEmails` allowlist read from the env.
   *  - If NOT on the allowlist → throws `ForbiddenException` with
   *    `code: 'NOT_ADMIN'`. We deliberately do NOT silently fall back to
   *    a CUSTOMER sync — that would be confusing UX (the admin FE would
   *    appear to log in successfully but then be denied everywhere).
   *  - If on the allowlist → upserts AND forces `role = ADMIN`. Re-running
   *    against an existing CUSTOMER row promotes them.
   *
   * @param identity  Verified Supabase JWT subset.
   * @param body      Optional profile fields.
   * @returns         The freshly upserted ADMIN `User` row.
   * @throws ForbiddenException — when the email is not on the allowlist.
   */
  async syncAdmin(
    identity: SupabaseAuthIdentity,
    body: SyncUserDto,
  ): Promise<User> {
    const allowlist = this.config.get<string[]>('supabase.adminEmails') ?? [];
    if (!allowlist.includes(identity.email.toLowerCase())) {
      throw new ForbiddenException({
        code: 'NOT_ADMIN',
        message: 'This email is not on the admin allowlist',
      });
    }
    return this.upsert(identity, body, UserRole.ADMIN);
  }

  /**
   * Internal upsert primitive shared by both sync methods.
   *
   * Normalisation rules:
   *  - `email` is lowercased before storing (DB column is unique; mixed
   *    case would defeat that).
   *  - `fullName` and `phone` are trimmed; empty strings become `null`
   *    (we treat blank == absent, makes downstream queries simpler).
   *  - `locale` defaults to `en` on create; on update we only touch it if
   *    the caller explicitly sent a value (so an empty body doesn't reset
   *    a user's preferred locale).
   *
   * Role logic:
   *  - On create, the row's role is exactly the `role` argument.
   *  - On update, ADMIN sync writes `role: ADMIN` (promotion); CUSTOMER
   *    sync omits the field, preserving any prior promotion.
   *
   * @param identity  Verified Supabase identity.
   * @param body      Profile fields to persist.
   * @param role      Target role for create + (conditional) update.
   * @returns         The persisted `User` row.
   */
  private async upsert(
    identity: SupabaseAuthIdentity,
    body: SyncUserDto,
    role: UserRole,
  ): Promise<User> {
    const fullName = body.fullName?.trim() || null;
    const phone = body.phone?.trim() || null;
    const locale = body.locale ?? Locale.en;
    const emailLower = identity.email.toLowerCase();

    // Conditional update: ADMIN sync upgrades; CUSTOMER sync leaves role alone.
    const updateRole = role === UserRole.ADMIN ? { role } : {};

    const user = await this.prisma.user.upsert({
      where: { supabaseId: identity.sub },
      create: {
        supabaseId: identity.sub,
        email: emailLower,
        fullName,
        phone,
        locale,
        role,
      },
      update: {
        email: emailLower,
        // Only overwrite mutable profile fields when the caller actually
        // provided them — otherwise re-syncing with an empty body would
        // wipe valid data.
        ...(fullName !== null ? { fullName } : {}),
        ...(phone !== null ? { phone } : {}),
        ...(body.locale ? { locale } : {}),
        ...updateRole,
      },
    });

    this.logger.log(
      `Synced ${user.role.toLowerCase()} ${user.email} (supabaseId=${user.supabaseId})`,
    );
    return user;
  }
}
