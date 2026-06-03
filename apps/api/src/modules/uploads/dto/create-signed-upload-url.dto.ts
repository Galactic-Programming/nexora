import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

/**
 * Catalog of allowed upload purposes. Maps 1:1 to a Cloudinary folder so the
 * asset layout is predictable. Each purpose also implies a Cloudinary
 * `resource_type` (image vs video) — see `UploadsService.resourceTypeForPurpose`.
 *
 * Adding a new purpose means:
 *  1. Add the enum case here.
 *  2. Map it in `UploadsService.folderForPurpose`.
 *  3. Map its resource type in `UploadsService.resourceTypeForPurpose`.
 */
export enum UploadPurpose {
  TOUR_HERO = 'TOUR_HERO',
  TOUR_GALLERY = 'TOUR_GALLERY',
  TOUR_VIDEO = 'TOUR_VIDEO',
  DESTINATION_HERO = 'DESTINATION_HERO',
  DESTINATION_VIDEO = 'DESTINATION_VIDEO',
  USER_AVATAR = 'USER_AVATAR',
}

/**
 * Request body for `POST /admin/uploads/signed-url`.
 *
 * The endpoint does NOT proxy the file. It returns a Cloudinary upload
 * signature that the FE uses to POST the file directly to Cloudinary — this
 * avoids routing large multipart bodies (especially video) through the Nest
 * process and keeps upload latency tied to the client's distance from
 * Cloudinary's edge, not the backend's region.
 *
 * The backend's job here is to:
 *  1. Validate purpose + filename + format-vs-resource-type
 *  2. Derive a Cloudinary folder + public_id (sanitized, timestamped)
 *  3. Compute the upload signature using the Cloudinary api_secret
 *  4. Return the signed params envelope to the FE (see `SignedUploadParams`)
 */
export class CreateSignedUploadUrlDto {
  @ApiProperty({
    enum: UploadPurpose,
    description:
      'Upload classification — determines the storage folder + future RLS scope.',
  })
  @IsEnum(UploadPurpose)
  purpose!: UploadPurpose;

  /**
   * Original filename from the FE. We sanitize this aggressively in the
   * service layer: lowercase, slug-safe chars only, single extension.
   *
   * Validation here is the first line of defence against path traversal
   * (`../../../etc/passwd`) and pathological filenames. The regex below
   * rejects slashes, backslashes, null bytes and leading dots — the
   * service still re-sanitizes before persisting.
   */
  @ApiProperty({
    example: 'hero-shot.jpg',
    description:
      'Original filename (single extension). The backend sanitizes + timestamps it before persisting.',
    maxLength: 120,
  })
  @IsString()
  @MaxLength(120)
  @Matches(/^[A-Za-z0-9._-]+\.[A-Za-z0-9]{1,8}$/, {
    message:
      'filename must contain only letters, digits, hyphen, underscore, dot, and end with a 1-8 char extension',
  })
  filename!: string;

  /**
   * Optional content-type hint. Stored alongside the signed URL request
   * so Supabase Storage can echo it on download. The FE should still
   * verify on its end before uploading.
   */
  @ApiPropertyOptional({ example: 'image/jpeg', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(/^[A-Za-z0-9!#$&^_.+-]+\/[A-Za-z0-9!#$&^_.+-]+$/, {
    message: 'contentType must be a valid MIME type',
  })
  contentType?: string;
}
