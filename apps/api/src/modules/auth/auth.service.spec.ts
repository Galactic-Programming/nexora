import { ForbiddenException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Locale, User, UserRole } from '@prisma/client';
import { AuthService } from './auth.service';
import type { SupabaseAuthIdentity } from '../../common/types/authenticated-request';

// Silence the AuthService logger during tests. The mocked Prisma upsert
// returns partial fixtures (no email/supabaseId), so the real log line would
// print "Synced customer undefined (supabaseId=undefined)" — pure noise.
beforeAll(() => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
});
afterAll(() => {
  jest.restoreAllMocks();
});

type UpsertArgs = Parameters<AuthService['syncCustomer']>;
type UpsertCallArg = {
  where: { supabaseId: string };
  create: {
    email: string;
    role: UserRole;
    fullName: string | null;
    phone: string | null;
    locale: Locale;
  };
  update: Record<string, unknown>;
};

const baseIdentity: SupabaseAuthIdentity = {
  sub: '00000000-0000-0000-0000-000000000001',
  email: 'Customer@Example.com',
  emailVerified: true,
  raw: {},
};

function makePrisma(returns: Partial<User> | null) {
  const upsert = jest.fn<Promise<Partial<User> | null>, [UpsertCallArg]>(() =>
    Promise.resolve(returns),
  );
  return { user: { upsert } };
}

function makeConfig(adminEmails: string[]) {
  return {
    get: jest.fn((key: string) =>
      key === 'supabase.adminEmails' ? adminEmails : undefined,
    ),
  } as unknown as ConfigService;
}

describe('AuthService', () => {
  describe('syncCustomer', () => {
    it('upserts a CUSTOMER row keyed by Supabase sub with normalized email', async () => {
      const fakeUser = {
        id: 'u1',
        supabaseId: baseIdentity.sub,
        email: 'customer@example.com',
        role: UserRole.CUSTOMER,
        locale: Locale.en,
      };
      const prisma = makePrisma(fakeUser);
      const svc = new AuthService(prisma as never, makeConfig([]));

      const result = await svc.syncCustomer(baseIdentity, {
        fullName: ' Nguyen Van A ',
        locale: Locale.vi,
      });

      expect(result).toBe(fakeUser);
      const call: UpsertCallArg = prisma.user.upsert.mock.calls[0][0];
      expect(call.where).toEqual({ supabaseId: baseIdentity.sub });
      expect(call.create.email).toBe('customer@example.com');
      expect(call.create.role).toBe(UserRole.CUSTOMER);
      expect(call.create.fullName).toBe('Nguyen Van A');
      expect(call.create.locale).toBe(Locale.vi);
      // CUSTOMER sync must NOT downgrade an existing ADMIN row
      expect(call.update).not.toHaveProperty('role');
    });

    it('passes empty fullName/phone as null on create', async () => {
      const prisma = makePrisma({ id: 'u1', role: UserRole.CUSTOMER });
      const svc = new AuthService(prisma as never, makeConfig([]));

      await svc.syncCustomer(baseIdentity, {});

      const call: UpsertCallArg = prisma.user.upsert.mock.calls[0][0];
      expect(call.create.fullName).toBeNull();
      expect(call.create.phone).toBeNull();
      expect(call.create.locale).toBe(Locale.en);
    });
  });

  describe('syncAdmin', () => {
    it('throws ForbiddenException when email is not on allowlist', async () => {
      const prisma = makePrisma(null);
      const svc = new AuthService(
        prisma as never,
        makeConfig(['someone-else@example.com']),
      );

      await expect(svc.syncAdmin(baseIdentity, {})).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.user.upsert).not.toHaveBeenCalled();
    });

    it('upgrades the user to ADMIN when email matches allowlist (case-insensitive)', async () => {
      const fakeUser = {
        id: 'u1',
        email: 'customer@example.com',
        role: UserRole.ADMIN,
      };
      const prisma = makePrisma(fakeUser);
      const svc = new AuthService(
        prisma as never,
        makeConfig(['customer@example.com']),
      );

      const result = await svc.syncAdmin(baseIdentity, {});

      expect(result).toBe(fakeUser);
      const call: UpsertCallArg = prisma.user.upsert.mock.calls[0][0];
      expect(call.create.role).toBe(UserRole.ADMIN);
      expect(call.update.role).toBe(UserRole.ADMIN);
    });
  });

  it('matches the syncCustomer signature so refactors stay safe', () => {
    const expectedArgs: UpsertArgs = [baseIdentity, {}];
    expect(expectedArgs).toHaveLength(2);
  });
});
