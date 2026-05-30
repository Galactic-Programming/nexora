import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

/**
 * Singleton Prisma client wired into the NestJS DI lifecycle.
 *
 * Why extend `PrismaClient` directly?
 * - One instance shared across all services via DI — no duplicate
 *   connection pools.
 * - Lifecycle hooks (`onModuleInit` / `onModuleDestroy`) wire `$connect` /
 *   `$disconnect` automatically; tests get clean teardown.
 *
 * Why a driver adapter (`PrismaPg`)?
 * - Prisma 7 dropped the schema-level `datasource.url` field. The runtime
 *   connection now comes from a driver adapter, which we construct here
 *   from `DATABASE_URL` (the Supavisor transaction pooler endpoint).
 * - `prisma migrate` ignores this — it reads `DIRECT_URL` from
 *   `prisma.config.ts` instead, since pooled connections can't run
 *   migration-style long transactions.
 *
 * Marked `@Injectable()` and re-exported via `PrismaModule` (which is
 * `@Global()`), so any feature module can inject it without re-importing.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  /**
   * Builds the underlying `PrismaClient` with our adapter + log policy.
   *
   * Log policy:
   * - `LOG_LEVEL=debug` → emit Prisma warnings AND errors to stdout.
   *   Useful during local feature dev when you want to see N+1 hints, etc.
   * - Otherwise (info/error/...) → only errors. Keeps prod logs quiet but
   *   never silent on real failures.
   *
   * @param config  Injected `ConfigService`. We read `DATABASE_URL`
   *                directly (not via the namespaced `app.*` config) because
   *                Prisma owns this URL semantically — it isn't shared with
   *                anything else.
   */
  constructor(config: ConfigService) {
    super({
      adapter: new PrismaPg({
        connectionString: config.getOrThrow<string>('DATABASE_URL'),
      }),
      log:
        config.get<string>('app.logLevel') === 'debug'
          ? ['warn', 'error']
          : ['error'],
      errorFormat: 'pretty',
    });
  }

  /**
   * NestJS lifecycle hook — opens the database connection during boot.
   *
   * We call `$connect()` eagerly (instead of letting Prisma lazy-connect on
   * the first query) so a misconfigured URL or unreachable database fails
   * the boot sequence loudly, not silently on the first user request.
   *
   * @throws  Whatever `$connect` throws — re-thrown so Nest aborts startup.
   */
  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('Connected to database');
    } catch (err) {
      this.logger.error('Failed to connect to database', err as Error);
      throw err;
    }
  }

  /**
   * NestJS lifecycle hook — closes the connection on shutdown.
   *
   * Prevents lingering pooler sessions during graceful shutdown (tests,
   * deployments, SIGTERM in production). Failing here is non-fatal so we
   * don't propagate the error.
   */
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
