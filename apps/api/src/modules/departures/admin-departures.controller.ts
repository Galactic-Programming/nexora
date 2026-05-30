import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { TourDeparture, UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { DeparturesService } from './departures.service';
import { CreateDepartureDto } from './dto/create-departure.dto';
import { DepartureDto } from './dto/departure.dto';
import { ListDeparturesQueryDto } from './dto/list-departures-query.dto';
import { UpdateDepartureDto } from './dto/update-departure.dto';

/**
 * Admin-only nested CRUD for tour departures.
 *
 * Mounted at `/admin/tours/:slug/departures`. The collection-level
 * `/admin/*` matcher routes admin-flavoured Postman pre-request auth
 * here automatically.
 *
 * Pipeline (same as other admin controllers): SupabaseJwtGuard →
 * RolesGuard(ADMIN) → ValidationPipe → handler.
 */
@ApiTags('Tours (Admin) — Departures')
@ApiBearerAuth('supabase-jwt')
@Roles(UserRole.ADMIN)
@Controller('admin/tours/:slug/departures')
export class AdminDeparturesController {
  constructor(private readonly departuresService: DeparturesService) {}

  /**
   * `GET /admin/tours/:slug/departures` — full history including CLOSED
   * and CANCELLED rows. Filters: `from`, `to`, `status`.
   */
  @Get()
  @ApiOperation({ summary: 'Admin: list departures (full history)' })
  @ApiOkResponse({
    type: [DepartureDto],
    description: 'Departures ordered by startDate asc',
  })
  @ApiResponse({ status: 404, description: 'Tour slug not found' })
  list(
    @Param('slug') slug: string,
    @Query() query: ListDeparturesQueryDto,
  ): Promise<TourDeparture[]> {
    return this.departuresService.findAdminListForTour(slug, query);
  }

  /**
   * `POST /admin/tours/:slug/departures` — create one departure.
   *
   * @throws 404 `TOUR_NOT_FOUND` — slug missing.
   * @throws 400 `INVALID_DATE_RANGE` — endDate < startDate.
   */
  @Post()
  @ApiOperation({ summary: 'Admin: create a departure' })
  @ApiCreatedResponse({ type: DepartureDto, description: 'Created' })
  @ApiResponse({ status: 400, description: 'Invalid date range' })
  @ApiResponse({ status: 404, description: 'Tour slug not found' })
  create(
    @Param('slug') slug: string,
    @Body() body: CreateDepartureDto,
  ): Promise<TourDeparture> {
    return this.departuresService.create(slug, body);
  }

  /**
   * `PATCH /admin/tours/:slug/departures/:id` — partial update.
   *
   * Forces 200 so the response carries the updated row. Capacity guard:
   * `seatsTotal` cannot drop below the row's current `seatsBooked`.
   *
   * @throws 404 `TOUR_NOT_FOUND` | `DEPARTURE_NOT_FOUND`.
   * @throws 400 `INVALID_DATE_RANGE` | `SEATS_TOTAL_BELOW_BOOKED`.
   */
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin: partial update a departure' })
  @ApiOkResponse({ type: DepartureDto, description: 'Updated' })
  @ApiResponse({
    status: 400,
    description: 'Invalid date range or seatsTotal below seatsBooked',
  })
  @ApiResponse({ status: 404, description: 'Tour or departure not found' })
  update(
    @Param('slug') slug: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateDepartureDto,
  ): Promise<TourDeparture> {
    return this.departuresService.update(slug, id, body);
  }

  /**
   * `DELETE /admin/tours/:slug/departures/:id` — hard delete.
   *
   * Pre-checks `seatsBooked === 0` and refuses with 409 otherwise so
   * booking history is preserved (admins should mark CANCELLED instead).
   *
   * @throws 404 `TOUR_NOT_FOUND` | `DEPARTURE_NOT_FOUND`.
   * @throws 409 `DEPARTURE_HAS_BOOKINGS` — seats already sold.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin: delete a departure' })
  @ApiOkResponse({ type: DepartureDto, description: 'Deleted (echo)' })
  @ApiResponse({ status: 404, description: 'Tour or departure not found' })
  @ApiResponse({ status: 409, description: 'Departure has bookings' })
  remove(
    @Param('slug') slug: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TourDeparture> {
    return this.departuresService.remove(slug, id);
  }
}
