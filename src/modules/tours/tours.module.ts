import { Module } from '@nestjs/common';
import { AdminItineraryController } from './admin-itinerary.controller';
import { AdminToursController } from './admin-tours.controller';
import { ItineraryService } from './itinerary.service';
import { ToursController } from './tours.controller';
import { ToursService } from './tours.service';

/**
 * Bundles the public + admin Tours controllers, the itinerary nested
 * surface, and the shared services.
 *
 * `ToursService` is exported so future modules (Departures, Bookings,
 * Reviews) can resolve a tour by slug or id without going through HTTP.
 */
@Module({
  controllers: [
    ToursController,
    AdminToursController,
    AdminItineraryController,
  ],
  providers: [ToursService, ItineraryService],
  exports: [ToursService],
})
export class ToursModule {}
