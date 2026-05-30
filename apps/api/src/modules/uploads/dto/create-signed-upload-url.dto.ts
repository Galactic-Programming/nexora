import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

/**
 * Catalog of allowed upload purposes. Maps 1:1 to a folder under the
 * Supabase Storage bucket so the bucket layout is predictable and
 * policies can be scoped per folder.
 *
 * Adding a new purpose means:
 *  1. Add the enum case here.
 *  2. Map it in `UploadsService.folderForPurpose`.
 *  3. Confirm Storage bucket policy allows writes under the new folder.
 */
export enum UploadPurpose {
  TOUR_HERO = 'TOUR_HERO',
  TOUR_GALLERY = 'TOUR_GALLERY',
  DESTINATION_HERO = 'DESTINATION_HERO',
  USER_AVATAR = 'USER_AVATAR',
}

/**
 * Request body for `POST /admin/uploads/signed-url`.
 *
 * The endpoint does NOT proxy the file. It returns a short-lived signed
 * URL that the FE uploads directly to Supabase Storage — this avoids
 * routing large multipart bodies through the Nest process and keeps
 * upload latency tied to the client's distance from Supabase's edge,
 * not the backend's region.
 *
 * The backend's job here is to:
 *  1. Validate purpose + filename
 *  2. Derive a safe storage path (sanitize filename, prepend folder)
 *  3. Mint the signed URL using the Supabase service role key
 *  4. Return `{ uploadUrl, path, token, expiresAt }` to the FE
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
