import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Tour, UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateTourDto } from './dto/create-tour.dto';
import { UpdateTourDto } from './dto/update-tour.dto';
import { ToursService } from './tours.service';

/**
 * Admin-only CRUD surface mounted at `/admin/tours`.
 *
 * Public list/detail endpoints (`GET /tours`, `GET /tours/:slug`) ship in
 * Sprint B2.3. Itinerary nested routes ship in B2.4. This file is scoped
 * to plain admin CRUD on the Tour entity itself.
 *
 * Pipeline:
 *  1. `SupabaseJwtGuard` (global) verifies the JWT.
 *  2. `RolesGuard` (global) checks `@Roles(ADMIN)` against `req.currentUser.role`.
 *  3. Validation pipe applies the DTO rules.
 *  4. Handler delegates to {@link ToursService}.
 */
@ApiTags('Tours (Admin)')
@ApiBearerAuth('supabase-jwt')
@Roles(UserRole.ADMIN)
@Controller('admin/tours')
export class AdminToursController {
  constructor(private readonly toursService: ToursService) {}

  /**
   * `GET /admin/tours/:slug` — admin detail (no `is_published` filter).
   * Includes the parent destination so the admin UI can render the link
   * without a follow-up call.
   *
   * @throws NotFoundException — `TOUR_NOT_FOUND` when slug missing.
   */
  @Get(':slug')
  @ApiOperation({ summary: 'Admin: get one tour by slug (with destination)' })
  @ApiResponse({ status: 200, description: 'Tour' })
  @ApiResponse({ status: 404, description: 'Slug not found' })
  detail(@Param('slug') slug: string): Promise<Tour> {
    return this.toursService.findBySlug(slug);
  }

  /**
   * `POST /admin/tours` — create a tour.
   *
   * Status is the default 201. The interceptor wraps the response in
   * `{ data, error: null }`. Possible errors:
   *  - 400 `INVALID_DESTINATION` — destinationId not found
   *  - 409 `TOUR_SLUG_EXISTS`    — slug already taken
   */
  @Post()
  @ApiOperation({ summary: 'Admin: create a tour' })
  @ApiResponse({ status: 201, description: 'Created' })
  @ApiResponse({ status: 400, description: 'Invalid destinationId' })
  @ApiResponse({ status: 409, description: 'Slug already exists' })
  create(@Body() body: CreateTourDto): Promise<Tour> {
    return this.toursService.create(body);
  }

  /**
   * `PATCH /admin/tours/:slug` — partial update.
   *
   * Forces 200 (instead of 204) so the response carries the updated row
   * — admin UIs can re-render without an extra GET.
   */
  @Patch(':slug')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin: partial update a tour' })
  @ApiResponse({ status: 200, description: 'Updated' })
  @ApiResponse({ status: 400, description: 'Invalid destinationId' })
  @ApiResponse({ status: 404, description: 'Slug not found' })
  @ApiResponse({ status: 409, description: 'New slug already exists' })
  update(
    @Param('slug') slug: string,
    @Body() body: UpdateTourDto,
  ): Promise<Tour> {
    return this.toursService.update(slug, body);
  }

  /**
   * `DELETE /admin/tours/:slug` — hard delete.
   *
   * Returns 200 + echo of the deleted row (so admin UIs can confirm what
   * was removed). 409 `TOUR_HAS_BOOKINGS` when bookings still reference
   * the tour.
   */
  @Delete(':slug')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin: delete a tour' })
  @ApiResponse({ status: 200, description: 'Deleted (echo)' })
  @ApiResponse({ status: 404, description: 'Slug not found' })
  @ApiResponse({
    status: 409,
    description: 'Tour still has bookings referencing it',
  })
  remove(@Param('slug') slug: string): Promise<Tour> {
    return this.toursService.remove(slug);
  }
}
