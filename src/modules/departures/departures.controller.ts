import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TourDeparture } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { DeparturesService } from './departures.service';
import { ListDeparturesQueryDto } from './dto/list-departures-query.dto';

/**
 * Public read-only surface for browsing a tour's available departures.
 *
 * Mounted at `/tours/:slug/departures`. The service defaults `from =
 * today` and `status = OPEN` for public callers so end users never see
 * past dates or cancelled rows unless they pass the filters explicitly.
 *
 * 404 if the parent tour is missing OR unpublished — same conflation
 * rule as `GET /tours/:slug` so draft slugs aren't probeable.
 */
@ApiTags('Tours (Public) — Departures')
@Controller('tours/:slug/departures')
export class DeparturesController {
  constructor(private readonly departuresService: DeparturesService) {}

  /**
   * `GET /tours/:slug/departures` — upcoming open departures.
   *
   * Sorted by `startDate` ascending. Filters: `from`, `to`, `status`.
   */
  @Get()
  @Public()
  @ApiOperation({ summary: 'List upcoming departures for a tour' })
  @ApiResponse({
    status: 200,
    description: 'Departures ordered by startDate asc',
  })
  @ApiResponse({
    status: 404,
    description: 'Tour slug not found or unpublished',
  })
  list(
    @Param('slug') slug: string,
    @Query() query: ListDeparturesQueryDto,
  ): Promise<TourDeparture[]> {
    return this.departuresService.findPublicListForTour(slug, query);
  }
}
