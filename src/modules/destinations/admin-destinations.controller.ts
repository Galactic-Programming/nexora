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
import { Destination, UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  DestinationsService,
  PaginatedDestinations,
} from './destinations.service';
import { CreateDestinationDto } from './dto/create-destination.dto';
import { DestinationDto } from './dto/destination.dto';
import { ListDestinationsQueryDto } from './dto/list-destinations-query.dto';
import { PaginatedDestinationsDto } from './dto/paginated-destinations.dto';
import { UpdateDestinationDto } from './dto/update-destination.dto';

/**
 * Admin-only CRUD surface mounted at `/admin/destinations`.
 *
 * Every method is gated by `@Roles(ADMIN)`; the global `RolesGuard` enforces
 * it. The auth guard runs first to populate `req.currentUser`, so by the
 * time `RolesGuard` checks the role, we already know who's calling.
 *
 * Why a separate controller instead of conditional logic in the public one?
 *  - Cleaner Swagger output: admin paths group under their own tag.
 *  - URL prefix `/admin/*` is visible in logs and access control rules.
 *  - No risk of accidentally exposing an admin handler as public via a
 *    missing decorator — they live in different files.
 */
@ApiTags('Destinations (Admin)')
@ApiBearerAuth('supabase-jwt')
@Roles(UserRole.ADMIN)
@Controller('admin/destinations')
export class AdminDestinationsController {
  constructor(private readonly destinationsService: DestinationsService) {}

  /**
   * `GET /admin/destinations` — admin list, sees drafts and inactive rows.
   */
  @Get()
  @ApiOperation({ summary: 'Admin: list all destinations (incl. drafts)' })
  @ApiOkResponse({
    type: PaginatedDestinationsDto,
    description: 'Paginated destinations',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT' })
  @ApiResponse({ status: 403, description: 'Not an ADMIN' })
  list(
    @Query() query: ListDestinationsQueryDto,
  ): Promise<PaginatedDestinations> {
    return this.destinationsService.findAll(query);
  }

  /**
   * `GET /admin/destinations/:slug` — admin detail (no `is_active` filter).
   */
  @Get(':slug')
  @ApiOperation({ summary: 'Admin: get one destination by slug' })
  @ApiOkResponse({ type: DestinationDto, description: 'Destination' })
  @ApiResponse({ status: 404, description: 'Slug not found' })
  detail(@Param('slug') slug: string): Promise<Destination> {
    return this.destinationsService.findBySlug(slug);
  }

  /**
   * `POST /admin/destinations` — create.
   *
   * Returns 201 (Nest default for `@Post`), envelope-wrapped by the
   * interceptor.
   */
  @Post()
  @ApiOperation({ summary: 'Admin: create a destination' })
  @ApiCreatedResponse({ type: DestinationDto, description: 'Created' })
  @ApiResponse({ status: 409, description: 'Slug already exists' })
  create(@Body() body: CreateDestinationDto): Promise<Destination> {
    return this.destinationsService.create(body);
  }

  /**
   * `PATCH /admin/destinations/:slug` — partial update.
   *
   * Forces 200 (instead of 204) so the response carries the updated row,
   * which is convenient for admin UIs that need to render the result
   * without a follow-up `GET`.
   */
  @Patch(':slug')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin: partial update a destination' })
  @ApiOkResponse({ type: DestinationDto, description: 'Updated' })
  @ApiResponse({ status: 404, description: 'Slug not found' })
  @ApiResponse({ status: 409, description: 'New slug already exists' })
  update(
    @Param('slug') slug: string,
    @Body() body: UpdateDestinationDto,
  ): Promise<Destination> {
    return this.destinationsService.update(slug, body);
  }

  /**
   * `DELETE /admin/destinations/:slug` — hard delete.
   *
   * 200 + echo of the deleted row so admin UIs can confirm what was
   * removed. 409 if any tour still references this destination.
   */
  @Delete(':slug')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin: delete a destination' })
  @ApiOkResponse({ type: DestinationDto, description: 'Deleted (echo)' })
  @ApiResponse({ status: 404, description: 'Slug not found' })
  @ApiResponse({
    status: 409,
    description: 'Destination still has tours referencing it',
  })
  remove(@Param('slug') slug: string): Promise<Destination> {
    return this.destinationsService.remove(slug);
  }
}
