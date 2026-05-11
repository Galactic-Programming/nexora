import { Module } from '@nestjs/common';
import { AdminToursController } from './admin-tours.controller';
import { ToursController } from './tours.controller';
import { ToursService } from './tours.service';

/**
 * Bundles the public + admin Tours controllers and the shared service.
 *
 * Sprint B2.4 will add itinerary CRUD as a third controller under
 * `/admin/tours/:slug/itinerary`.
 *
 * `ToursService` is exported so future modules (Departures, Bookings,
 * Reviews) can resolve a tour by slug or id without going through HTTP.
 */
@Module({
  controllers: [ToursController, AdminToursController],
  providers: [ToursService],
  exports: [ToursService],
})
export class ToursModule {}
