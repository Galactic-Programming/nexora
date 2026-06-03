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
import { UploadsService } from './uploads.service';
import type { SignedUploadParams } from './uploads.service';

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
   * `POST /admin/uploads/signed-url` — compute a Cloudinary upload signature.
   *
   * Returns 200 (instead of 201) because this endpoint creates a **pending**
   * upload slot, not a persisted resource — there's nothing to address with
   * `Location:` until the FE actually completes the upload to Cloudinary (and
   * later persists the resulting `publicId` via the resource's media payload).
   *
   * Response body shape (`SignedUploadParams`):
   *  - `signature`    — HMAC over the signed params
   *  - `timestamp`    — Unix seconds (signed); FE echoes verbatim
   *  - `apiKey` / `cloudName` — public Cloudinary identifiers
   *  - `folder` / `publicId`  — signed target location
   *  - `resourceType` — `image` | `video`
   *  - `uploadUrl`    — full Cloudinary upload endpoint to POST the file to
   *
   * Errors:
   *  - 400 — DTO validation, or `MEDIA_FORMAT_REJECTED` (format vs resource type)
   */
  @Post('signed-url')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Admin: compute a Cloudinary signed upload',
  })
  @ApiResponse({ status: 200, description: 'Signed upload params envelope' })
  @ApiResponse({ status: 400, description: 'Invalid request body or format' })
  createSignedUrl(@Body() body: CreateSignedUploadUrlDto): SignedUploadParams {
    return this.uploadsService.createSignedUploadParams(body);
  }
}
