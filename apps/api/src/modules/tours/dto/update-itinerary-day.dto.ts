import { PartialType } from '@nestjs/swagger';
import { CreateItineraryDayDto } from './create-itinerary-day.dto';

/**
 * Request body for `PATCH /admin/tours/:slug/itinerary/:dayNumber`.
 *
 * Every field is optional. Sending `dayNumber` re-numbers the day —
 * subject to the same (tourId, dayNumber) unique constraint, so a
 * collision raises `409 ITINERARY_DAY_EXISTS`.
 */
export class UpdateItineraryDayDto extends PartialType(CreateItineraryDayDto) {}
