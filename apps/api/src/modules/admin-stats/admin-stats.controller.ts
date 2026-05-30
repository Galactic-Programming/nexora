import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminStatsResponse, AdminStatsService } from './admin-stats.service';

/**
 * Admin dashboard data aggregator. Single endpoint returning a wide
 * object — the FE renders revenue cards, status pie, top-N tables, and
 * a 6-month trend chart from one request.
 */
@ApiTags('Admin / Stats')
@ApiBearerAuth('supabase-jwt')
@Controller('admin/stats')
export class AdminStatsController {
  constructor(private readonly statsService: AdminStatsService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Dashboard aggregates (revenue, top tours, trend)' })
  @ApiResponse({ status: 200, description: 'Aggregated stats payload' })
  @ApiResponse({ status: 401, description: 'Missing/invalid token' })
  @ApiResponse({ status: 403, description: 'Caller is not an admin' })
  get(): Promise<AdminStatsResponse> {
    return this.statsService.getDashboard();
  }
}
