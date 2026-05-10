import { Module } from '@nestjs/common';
import { AdminToursController } from './admin-tours.controller';
import { ToursService } from './tours.service';

/**
 * Bundles the admin Tours controller and service.
 *
 * In B2.3 we'll add a public `ToursController` (`GET /tours`,
 * `GET /tours/:slug`) — at that point this module gains a second
 * controller. In B2.4 itinerary CRUD lands here too.
 *
 * `ToursService` is exported so future modules (Departures, Bookings,
 * Reviews) can resolve a tour by slug or id without going through HTTP.
 */
@Module({
  controllers: [AdminToursController],
  providers: [ToursService],
  exports: [ToursService],
})
export class ToursModule {}
