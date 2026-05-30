import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateSignedUploadUrlDto } from './dto/create-signed-upload-url.dto';
import { SignedUploadUrl, UploadsService } from './uploads.service';

/**
 * Admin-only surface for issuing signed upload URLs.
 *
 * Mounted at `/admin/uploads`. Both Admin FE (tour gallery editor,
 * destination hero picker) and the seed script consume this.
 *
 * Pipeline: SupabaseJwtGuard → RolesGuard(ADMIN) → ValidationPipe →
 * handler → UploadsService.
 */
@ApiTags('Uploads (Admin)')
@ApiBearerAuth('supabase-jwt')
@Roles(UserRole.ADMIN)
@Controller('admin/uploads')
export class AdminUploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  /**
   * `POST /admin/uploads/signed-url` — mint a short-lived signed URL.
   *
   * Returns 200 (instead of 201) because this endpoint creates a
   * **pending** upload slot, not a persisted resource — there's nothing
   * to address with `Location:` until the FE actually completes the PUT.
   *
   * Response body shape (`SignedUploadUrl`):
   *  - `uploadUrl` — full signed PUT URL
   *  - `token`     — Supabase SDK requires this for `uploadToSignedUrl`
   *  - `path`      — final object path in the bucket
   *  - `bucket`    — bucket name for FE convenience
   *
   * Errors:
   *  - 400 — DTO validation (bad purpose / filename / contentType)
   *  - 502 `STORAGE_SIGN_FAILED` — Supabase Storage returned an error
   */
  @Post('signed-url')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Admin: mint a Supabase Storage signed upload URL',
  })
  @ApiResponse({ status: 200, description: 'Signed URL envelope' })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({
    status: 502,
    description: 'Supabase Storage upstream failure',
  })
  createSignedUrl(
    @Body() body: CreateSignedUploadUrlDto,
  ): Promise<SignedUploadUrl> {
    return this.uploadsService.createSignedUploadUrl(body);
  }
}
