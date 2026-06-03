import { Global, Module } from '@nestjs/common';
import { MediaService } from './media.service';

/**
 * Provides the shared `MediaService`. Marked `@Global` so Tours, Destinations,
 * and (later) Users can inject it without importing this module everywhere.
 *
 * Relies on the global `PrismaModule` + `ConfigModule` for its dependencies.
 */
@Global()
@Module({
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule {}
