import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import {
  CreateSignedUploadUrlDto,
  UploadPurpose,
} from './dto/create-signed-upload-url.dto';

/** Cloudinary asset class. Determines the upload endpoint + delivery URL. */
export type ResourceType = 'image' | 'video';

/**
 * Envelope returned by `createSignedUploadParams`. Carries everything the FE
 * needs to POST the file straight to Cloudinary's upload endpoint.
 *
 * Signed fields (must be sent to Cloudinary EXACTLY as given): `timestamp`,
 * `folder`, `publicId`. Unsigned-but-required: `apiKey`. Cloudinary derives
 * the rest (`cloudName`, `resourceType`) from the upload URL.
 */
export interface SignedUploadParams {
  /** HMAC signature over the signed params, computed with the api_secret. */
  signature: string;
  /** Unix SECONDS used in the signature. FE must echo this verbatim. */
  timestamp: number;
  /** Public Cloudinary API key — safe to expose to the FE. */
  apiKey: string;
  /** Cloud name — part of the upload + delivery URL. */
  cloudName: string;
  /** Target folder, e.g. `tourism/tours/hero`. Signed. */
  folder: string;
  /** Object public_id WITHOUT extension (Cloudinary appends format). Signed. */
  publicId: string;
  /** `image` or `video` — selects the Cloudinary upload endpoint. */
  resourceType: ResourceType;
  /** Convenience: full upload URL the FE POSTs the file to. */
  uploadUrl: string;
}

/**
 * Allowed file extensions per resource type. Defence beyond the bucket-only
 * MIME check we had with Supabase Storage: now the backend rejects an obvious
 * mismatch (e.g. a `.mp4` sent for an image purpose) at signing time.
 *
 * Hard size limits are enforced by the Cloudinary upload preset / account
 * settings — the backend can't see the bytes at signing time. See the uploads
 * runbook.
 */
const ALLOWED_EXTENSIONS: Record<ResourceType, ReadonlySet<string>> = {
  image: new Set(['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif']),
  video: new Set(['mp4', 'webm', 'mov', 'm4v']),
};

/**
 * Issues Cloudinary upload signatures for admin-initiated direct uploads.
 *
 * Why signed direct upload (not multipart-proxy):
 *  - Large files (especially video) would block a Nest worker for the whole
 *    upload. Signed direct upload lets the FE POST straight to Cloudinary,
 *    bypassing our backend on the data path.
 *  - Backend stays small, stateless, horizontally scalable.
 *  - We retain control over WHO can upload (admin-only via the calling
 *    controller's `@Roles(ADMIN)` guard) and WHERE the file lands (folder is
 *    derived server-side from the purpose enum).
 *
 * Part of the Supabase Storage → Cloudinary migration
 * (see docs/planning/cloudinary-media-migration.md).
 */
@Injectable()
export class UploadsService implements OnModuleInit {
  private readonly logger = new Logger(UploadsService.name);
  private cloudName!: string;
  private apiKey!: string;
  private apiSecret!: string;
  private rootFolder!: string;

  constructor(private readonly config: ConfigService) {}

  /**
   * Configures the Cloudinary SDK once at boot. `OnModuleInit` runs after
   * config is loaded + validated, so `getOrThrow` is guaranteed to resolve.
   * `secure: true` forces https delivery URLs.
   */
  onModuleInit(): void {
    this.cloudName = this.config.getOrThrow<string>('cloudinary.cloudName');
    this.apiKey = this.config.getOrThrow<string>('cloudinary.apiKey');
    this.apiSecret = this.config.getOrThrow<string>('cloudinary.apiSecret');
    this.rootFolder = this.config.getOrThrow<string>('cloudinary.uploadFolder');

    cloudinary.config({
      cloud_name: this.cloudName,
      api_key: this.apiKey,
      api_secret: this.apiSecret,
      secure: true,
    });
  }

  /**
   * Computes a Cloudinary upload signature for a direct browser upload.
   *
   * The signature covers `{ folder, public_id, timestamp }`; Cloudinary's
   * `api_sign_request` sorts + joins them and appends the api_secret before
   * hashing. The FE MUST send those three params (plus `api_key`, `signature`,
   * and `file`) unchanged, or Cloudinary returns 401.
   *
   * @throws BadRequestException — file extension/contentType doesn't match the
   *         purpose's resource type (`MEDIA_FORMAT_REJECTED`, mapped to 400).
   */
  createSignedUploadParams(body: CreateSignedUploadUrlDto): SignedUploadParams {
    const resourceType = this.resourceTypeForPurpose(body.purpose);
    this.assertFormatAllowed(resourceType, body.filename, body.contentType);

    const folder = this.folderForPurpose(body.purpose);
    const publicId = this.derivePublicId(body.filename);
    const timestamp = Math.floor(Date.now() / 1000);

    const signature = cloudinary.utils.api_sign_request(
      { folder, public_id: publicId, timestamp },
      this.apiSecret,
    );

    this.logger.log(
      `Signed Cloudinary upload for ${folder}/${publicId} (purpose=${body.purpose}, type=${resourceType})`,
    );

    return {
      signature,
      timestamp,
      apiKey: this.apiKey,
      cloudName: this.cloudName,
      folder,
      publicId,
      resourceType,
      uploadUrl: `https://api.cloudinary.com/v1_1/${this.cloudName}/${resourceType}/upload`,
    };
  }

  /**
   * Maps each purpose to its Cloudinary asset class. Video purposes upload to
   * the `/video/upload` endpoint and get video delivery URLs.
   */
  private resourceTypeForPurpose(purpose: UploadPurpose): ResourceType {
    switch (purpose) {
      case UploadPurpose.TOUR_VIDEO:
      case UploadPurpose.DESTINATION_VIDEO:
        return 'video';
      case UploadPurpose.TOUR_HERO:
      case UploadPurpose.TOUR_GALLERY:
      case UploadPurpose.DESTINATION_HERO:
      case UploadPurpose.USER_AVATAR:
        return 'image';
    }
  }

  /**
   * Maps each purpose to its Cloudinary folder (under the root upload folder).
   * Centralising this keeps the asset layout explicit — one place to audit.
   */
  private folderForPurpose(purpose: UploadPurpose): string {
    switch (purpose) {
      case UploadPurpose.TOUR_HERO:
        return `${this.rootFolder}/tours/hero`;
      case UploadPurpose.TOUR_GALLERY:
        return `${this.rootFolder}/tours/gallery`;
      case UploadPurpose.TOUR_VIDEO:
        return `${this.rootFolder}/tours/video`;
      case UploadPurpose.DESTINATION_HERO:
        return `${this.rootFolder}/destinations/hero`;
      case UploadPurpose.DESTINATION_VIDEO:
        return `${this.rootFolder}/destinations/video`;
      case UploadPurpose.USER_AVATAR:
        return `${this.rootFolder}/users/avatars`;
    }
  }

  /**
   * Rejects a filename whose extension doesn't match the expected resource
   * type, and (when provided) a contentType whose major type disagrees.
   *
   * This is the validation the old Supabase flow delegated entirely to the
   * bucket's MIME allowlist — now enforced server-side, per purpose.
   */
  private assertFormatAllowed(
    resourceType: ResourceType,
    filename: string,
    contentType?: string,
  ): void {
    const ext = this.extensionOf(filename);
    if (!ext || !ALLOWED_EXTENSIONS[resourceType].has(ext)) {
      throw new BadRequestException({
        code: 'MEDIA_FORMAT_REJECTED',
        message: `File type ".${ext}" is not allowed for a ${resourceType} upload.`,
      });
    }

    if (contentType) {
      const major = contentType.split('/')[0]?.toLowerCase();
      if (major !== resourceType) {
        throw new BadRequestException({
          code: 'MEDIA_FORMAT_REJECTED',
          message: `contentType "${contentType}" does not match a ${resourceType} upload.`,
        });
      }
    }
  }

  /** Lowercased extension without the dot, or `''` if none. */
  private extensionOf(filename: string): string {
    const base = filename.split(/[\\/]/).pop() ?? filename;
    const dotIndex = base.lastIndexOf('.');
    return dotIndex > 0 ? base.slice(dotIndex + 1).toLowerCase() : '';
  }

  /**
   * Derives a Cloudinary public_id from the client filename.
   *
   * Cloudinary appends the format automatically, so the public_id carries NO
   * extension. Defence-in-depth (the DTO regex already rejects separators):
   *  1. `basename` strips any directory prefix (anti path-traversal).
   *  2. Stem is lowercased + non-alphanumerics collapsed to `-`.
   *  3. Prefixed with `Date.now()` (ms) to guarantee uniqueness.
   */
  private derivePublicId(rawFilename: string): string {
    const base = rawFilename.split(/[\\/]/).pop() ?? rawFilename;
    const dotIndex = base.lastIndexOf('.');
    const stem = dotIndex > 0 ? base.slice(0, dotIndex) : base;

    const safeStem =
      stem
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'file';

    return `${Date.now()}-${safeStem}`;
  }
}
