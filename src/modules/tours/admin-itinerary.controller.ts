import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { TourItineraryDay, UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateItineraryDayDto } from './dto/create-itinerary-day.dto';
import { ItineraryDayDto } from './dto/itinerary-day.dto';
import { UpdateItineraryDayDto } from './dto/update-itinerary-day.dto';
import { ItineraryService } from './itinerary.service';

/**
 * Admin-only nested CRUD surface for tour itinerary days.
 *
 * Routes are addressed by `(tourSlug, dayNumber)` rather than UUID because
 * URLs like `/admin/tours/hoi-an-walking/itinerary/3` read naturally in
 * Postman and admin UIs alike — and `(tourId, dayNumber)` is already
 * unique at the DB level.
 *
 * Pipeline (same as {@link AdminToursController}): SupabaseJwtGuard →
 * RolesGuard(ADMIN) → ValidationPipe → handler.
 */
@ApiTags('Tours (Admin) — Itinerary')
@ApiBearerAuth('supabase-jwt')
@Roles(UserRole.ADMIN)
@Controller('admin/tours/:slug/itinerary')
export class AdminItineraryController {
  constructor(private readonly itineraryService: ItineraryService) {}

  /**
   * `GET /admin/tours/:slug/itinerary` — list all days, sorted ascending.
   *
   * @throws 404 `TOUR_NOT_FOUND` — slug missing.
   */
  @Get()
  @ApiOperation({ summary: 'Admin: list itinerary days for a tour' })
  @ApiOkResponse({
    type: [ItineraryDayDto],
    description: 'Days ordered by dayNumber asc',
  })
  @ApiResponse({ status: 404, description: 'Tour slug not found' })
  list(@Param('slug') slug: string): Promise<TourItineraryDay[]> {
    return this.itineraryService.listForTour(slug);
  }

  /**
   * `POST /admin/tours/:slug/itinerary` — create one day.
   *
   * @throws 404 `TOUR_NOT_FOUND` — slug missing.
   * @throws 409 `ITINERARY_DAY_EXISTS` — `(tourId, dayNumber)` collision.
   */
  @Post()
  @ApiOperation({ summary: 'Admin: create an itinerary day' })
  @ApiCreatedResponse({ type: ItineraryDayDto, description: 'Created' })
  @ApiResponse({ status: 404, description: 'Tour slug not found' })
  @ApiResponse({
    status: 409,
    description: 'Day number already exists for this tour',
  })
  create(
    @Param('slug') slug: string,
    @Body() body: CreateItineraryDayDto,
  ): Promise<TourItineraryDay> {
    return this.itineraryService.create(slug, body);
  }

  /**
   * `PATCH /admin/tours/:slug/itinerary/:dayNumber` — partial update.
   *
   * Forces 200 so the response carries the updated row. Sending
   * `dayNumber` in the body renumbers the day.
   *
   * @throws 404 `TOUR_NOT_FOUND` | `ITINERARY_DAY_NOT_FOUND`.
   * @throws 409 `ITINERARY_DAY_EXISTS` — renumber collides.
   */
  @Patch(':dayNumber')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin: partial update an itinerary day' })
  @ApiOkResponse({ type: ItineraryDayDto, description: 'Updated' })
  @ApiResponse({ status: 404, description: 'Tour or day not found' })
  @ApiResponse({ status: 409, description: 'Renumber collision' })
  update(
    @Param('slug') slug: string,
    @Param('dayNumber', ParseIntPipe) dayNumber: number,
    @Body() body: UpdateItineraryDayDto,
  ): Promise<TourItineraryDay> {
    return this.itineraryService.update(slug, dayNumber, body);
  }

  /**
   * `DELETE /admin/tours/:slug/itinerary/:dayNumber` — remove one day.
   *
   * Returns 200 + echo of the deleted row.
   *
   * @throws 404 `TOUR_NOT_FOUND` | `ITINERARY_DAY_NOT_FOUND`.
   */
  @Delete(':dayNumber')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin: delete an itinerary day' })
  @ApiOkResponse({ type: ItineraryDayDto, description: 'Deleted (echo)' })
  @ApiResponse({ status: 404, description: 'Tour or day not found' })
  remove(
    @Param('slug') slug: string,
    @Param('dayNumber', ParseIntPipe) dayNumber: number,
  ): Promise<TourItineraryDay> {
    return this.itineraryService.remove(slug, dayNumber);
  }
}
