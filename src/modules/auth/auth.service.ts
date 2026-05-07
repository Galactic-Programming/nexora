import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Locale, User, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { SupabaseAuthIdentity } from '../../common/types/authenticated-request';
import { SyncUserDto } from './dto/sync-user.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Idempotent: upsert by Supabase auth ID. New rows default to CUSTOMER.
   * Existing rows have their email refreshed (in case the user changed it
   * in Supabase) but their role is NEVER downgraded here.
   */
  async syncCustomer(
    identity: SupabaseAuthIdentity,
    body: SyncUserDto,
  ): Promise<User> {
    return this.upsert(identity, body, UserRole.CUSTOMER);
  }

  /**
   * Same as syncCustomer but promotes the user to ADMIN if their email is in
   * the ADMIN_EMAILS allowlist. Calling this with a non-allowlisted email
   * returns 403 — it does not silently fall back to CUSTOMER.
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

  private async upsert(
    identity: SupabaseAuthIdentity,
    body: SyncUserDto,
    role: UserRole,
  ): Promise<User> {
    const fullName = body.fullName?.trim() || null;
    const phone = body.phone?.trim() || null;
    const locale = body.locale ?? Locale.en;
    const emailLower = identity.email.toLowerCase();

    // For admins: always upgrade role on sync. For customers: don't overwrite
    // a role that was previously promoted to ADMIN.
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
