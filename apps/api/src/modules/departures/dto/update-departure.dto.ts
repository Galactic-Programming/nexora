import { PartialType } from '@nestjs/swagger';
import { CreateDepartureDto } from './create-departure.dto';

/**
 * Request body for `PATCH /admin/tours/:slug/departures/:id`.
 *
 * Every field optional. Service-layer guards:
 *  - Sending `startDate` and/or `endDate` re-validates the range.
 *  - Sending `seatsTotal` re-validates against the row's `seatsBooked`
 *    (capacity cannot shrink below seats already sold) → 400
 *    `SEATS_TOTAL_BELOW_BOOKED`.
 *  - `seatsBooked` is still NEVER accepted from clients — managed by
 *    the booking flow.
 */
export class UpdateDepartureDto extends PartialType(CreateDepartureDto) {}
