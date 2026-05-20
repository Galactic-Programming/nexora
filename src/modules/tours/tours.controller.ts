import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Tour } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { ListToursQueryDto } from './dto/list-tours-query.dto';
import { PaginatedToursDto } from './dto/paginated-tours.dto';
import { TourDetailDto } from './dto/tour.dto';
import { PaginatedTours, ToursService } from './tours.service';

/**
 * Public read-only surface for browsing the published tour catalog.
 *
 * Both endpoints are `@Public()` — no JWT required, since the marketing FE
 * serves anonymous traffic. The service layer pins `isPublished = true`
 * everywhere on this path so drafts never leak.
 */
@ApiTags('Tours (Public)')
@Controller('tours')
export class ToursController {
  constructor(private readonly toursService: ToursService) {}

  /**
   * `GET /tours` — paginated published catalog with filters.
   *
   * @param query  Validated filter/sort/pagination params.
   * @returns      Paginated tours envelope. `TransformInterceptor` lifts
   *               `meta` onto the response top level.
   */
  @Get()
  @Public()
  @ApiOperation({ summary: 'List published tours (paginated, filterable)' })
  @ApiOkResponse({ type: PaginatedToursDto, description: 'Paginated tours' })
  list(@Query() query: ListToursQueryDto): Promise<PaginatedTours> {
    return this.toursService.findPublishedList(query);
  }

  /**
   * `GET /tours/:slug` — single published tour by slug, with destination
   * joined for breadcrumbs.
   *
   * @throws 404 — slug missing OR unpublished (we conflate the two so
   *               draft slugs aren't probeable).
   */
  @Get(':slug')
  @Public()
  @ApiOperation({ summary: 'Get one published tour by slug' })
  @ApiOkResponse({
    type: TourDetailDto,
    description: 'Tour with destination + itinerary + stats',
  })
  @ApiResponse({ status: 404, description: 'Slug not found or unpublished' })
  detail(@Param('slug') slug: string): Promise<Tour> {
    return this.toursService.findPublishedBySlug(slug);
  }
}
