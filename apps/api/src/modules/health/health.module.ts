import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

/**
 * Wires the health probes into the application.
 *
 * No providers are declared because `HealthController` only depends on
 * `PrismaService`, which is already exported by the global `PrismaModule`.
 */
@Module({
  controllers: [HealthController],
})
export class HealthModule {}
