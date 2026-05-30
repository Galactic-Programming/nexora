import { Module } from '@nestjs/common';
import { AdminDeparturesController } from './admin-departures.controller';
import { DeparturesController } from './departures.controller';
import { DeparturesService } from './departures.service';

/**
 * Bundles the public + admin departure surfaces under one service.
 *
 * `DeparturesService` is exported so the Bookings module (Sprint B3) can
 * resolve and lock departure rows when creating bookings — the booking
 * flow needs to read `seatsTotal`/`seatsBooked` and increment under
 * transaction.
 */
@Module({
  controllers: [DeparturesController, AdminDeparturesController],
  providers: [DeparturesService],
  exports: [DeparturesService],
})
export class DeparturesModule {}
