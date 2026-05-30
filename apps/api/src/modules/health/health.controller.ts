import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Operational probes.
 *
 * - `/health` answers whether the process is running.
 * - `/health/ready` answers whether the process can serve traffic
 *   (i.e. the database is reachable).
 *
 * Both routes are `@Public()` — they bypass JWT auth so PaaS load balancers,
 * uptime monitors, and CI smoke tests can hit them without credentials.
 */
@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Liveness probe — returns 200 as long as the Node process is responsive.
   *
   * Why no DB hit? Liveness should NOT depend on external systems. If the
   * database is down but the process is otherwise fine, we want the orchestrator
   * to leave us alone (restarting won't help, and removing us from the LB
   * makes the outage worse). Use `/health/ready` for DB-aware checks.
   *
   * @returns Static payload with the process uptime (in seconds) and a
   *          server-side timestamp. Wrapped by `TransformInterceptor` into
   *          the standard envelope.
   */
  @Get()
  @Public()
  @ApiOperation({ summary: 'Liveness check — does not touch DB' })
  liveness() {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Readiness probe — runs a trivial `SELECT 1` to verify the connection
   * pool is healthy.
   *
   * Behaviour:
   * - DB up   → `{ status: 'ok',       checks: { database: 'up'   } }`
   * - DB down → `{ status: 'degraded', checks: { database: 'down' } }`
   *
   * The HTTP status is 200 in BOTH cases so caller scripts can inspect the
   * body and decide. (Returning 503 on a DB outage is also reasonable; we
   * just chose body-based reporting for simplicity.)
   *
   * Errors from the query are intentionally swallowed and converted to the
   * `down` state — we don't want this endpoint itself to throw.
   *
   * @returns Readiness payload (envelope-wrapped by the global interceptor).
   */
  @Get('ready')
  @Public()
  @ApiOperation({ summary: 'Readiness check — verifies DB connectivity' })
  async readiness() {
    let db: 'up' | 'down' = 'down';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      db = 'up';
    } catch {
      // Intentionally swallow — the response body itself reports the failure.
      db = 'down';
    }
    return {
      status: db === 'up' ? 'ok' : 'degraded',
      checks: { database: db },
      timestamp: new Date().toISOString(),
    };
  }
}
