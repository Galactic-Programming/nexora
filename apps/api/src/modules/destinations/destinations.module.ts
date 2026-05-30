import { Module } from '@nestjs/common';
import { AdminDestinationsController } from './admin-destinations.controller';
import { DestinationsController } from './destinations.controller';
import { DestinationsService } from './destinations.service';

/**
 * Bundles the public + admin Destinations controllers and their shared
 * service.
 *
 * `DestinationsService` is exported so future modules (Tours) can join on
 * `Destination` rows without going back through HTTP. Controllers stay
 * internal — they're consumed by Nest's HTTP layer only.
 */
@Module({
  controllers: [DestinationsController, AdminDestinationsController],
  providers: [DestinationsService],
  exports: [DestinationsService],
})
export class DestinationsModule {}
