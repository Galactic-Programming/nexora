import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Destination } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import {
  DestinationsService,
  PaginatedDestinations,
} from './destinations.service';
import { ListDestinationsQueryDto } from './dto/list-destinations-query.dto';

/**
 * Public read-only surface for browsing destinations.
 *
 * Both endpoints are `@Public()` — no auth required, since the marketing
 * site needs to render destination pages for anonymous visitors. The
 * service layer applies an `is_active = true` filter so drafts never leak.
 */
@ApiTags('Destinations (Public)')
@Controller('destinations')
export class DestinationsController {
  constructor(private readonly destinationsService: DestinationsService) {}

  /**
   * `GET /destinations` — paginated list of active destinations.
   *
   * @param query  Validated query string (page/pageSize/search/sort).
   * @returns      Paginated envelope. The `TransformInterceptor` lifts the
   *               `meta` field into the response top-level meta.
   */
  @Get()
  @Public()
  @ApiOperation({ summary: 'List active destinations (paginated)' })
  @ApiResponse({ status: 200, description: 'Paginated destinations' })
  list(
    @Query() query: ListDestinationsQueryDto,
  ): Promise<PaginatedDestinations> {
    return this.destinationsService.findPublicList(query);
  }

  /**
   * `GET /destinations/:slug` — single active destination by slug.
   *
   * @param slug  URL slug, kebab-case.
   * @returns     The destination row.
   * @throws NotFoundException — slug missing or inactive.
   */
  @Get(':slug')
  @Public()
  @ApiOperation({ summary: 'Get one active destination by slug' })
  @ApiResponse({ status: 200, description: 'Destination' })
  @ApiResponse({ status: 404, description: 'Slug not found or inactive' })
  detail(@Param('slug') slug: string): Promise<Destination> {
    return this.destinationsService.findPublicBySlug(slug);
  }
}
