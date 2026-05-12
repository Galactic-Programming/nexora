import {
  BadGatewayException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';

/**
 * Inferred client type from `createClient`. Using `ReturnType` avoids a
 * generic-arg mismatch with the bare `SupabaseClient` type — the SDK
 * exports a 5-arg generic whose defaults differ between the function
 * return and the type alias, which trips `@typescript-eslint/no-unsafe-assignment`.
 */
type SupabaseAdminClient = ReturnType<typeof createClient>;
import {
  CreateSignedUploadUrlDto,
  UploadPurpose,
} from './dto/create-signed-upload-url.dto';

/**
 * Response shape returned by `createSignedUploadUrl`. Mirrors the
 * envelope the FE needs to call `storage.from(bucket).uploadToSignedUrl`.
 */
export interface SignedUploadUrl {
  /** Pre-signed PUT URL. Short TTL (defaults to 2 h server-side). */
  uploadUrl: string;
  /** The token portion of the signed URL — Supabase SDK needs it. */
  token: string;
  /** Final object path within the bucket (`<folder>/<timestamp>-<slug>.<ext>`). */
  path: string;
  /** Bucket name, echoed for FE convenience. */
  bucket: string;
}

/**
 * Issues short-lived signed upload URLs for Supabase Storage.
 *
 * Why signed-URL upload instead of multipart-proxy:
 *  - Large files would block a Nest worker for the duration of the
 *    upload. Signed URLs let the FE PUT directly to Supabase's edge,
 *    bypassing our backend entirely on the data path.
 *  - Backend stays small, stateless, and easy to scale horizontally.
 *  - We retain control over WHO can upload (admin-only via the calling
 *    controller's `@Roles(ADMIN)` guard) and WHERE the file lands
 *    (folder is derived server-side from the purpose enum).
 *
 * Bucket must exist with the right RLS — see `docs/en/runbooks/uploads.md`.
 */
@Injectable()
export class UploadsService implements OnModuleInit {
  private readonly logger = new Logger(UploadsService.name);
  private supabase!: SupabaseAdminClient;
  private bucket!: string;

  constructor(private readonly config: ConfigService) {}

  /**
   * Lazy client init — we don't want to instantiate the Supabase client
   * at import time because it would side-effect during test collection.
   * `OnModuleInit` runs after config is loaded and validated.
   *
   * The client uses the **service role key**: required for
   * `createSignedUploadUrl` (anon key returns 401). Service role
   * bypasses RLS entirely, which is the whole point — we trust this
   * code path because the controller already gated on admin role.
   */
  onModuleInit(): void {
    const url = this.config.getOrThrow<string>('supabase.url');
    const serviceRoleKey = this.config.getOrThrow<string>(
      'supabase.serviceRoleKey',
    );
    this.bucket = this.config.getOrThrow<string>('supabase.storageBucket');

    this.supabase = createClient(url, serviceRoleKey, {
      auth: {
        // Server-to-server: no session persistence, no auto-refresh, no
        // event listeners — we just need the storage REST client.
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  /**
   * Mints a signed upload URL.
   *
   * Path derivation:
   *  - `<purpose-folder>/<unix-ms>-<sanitized-stem>.<ext>`
   *  - Unix milliseconds prefix guarantees uniqueness even when two
   *    admins upload the same filename within the same second.
   *  - Filename stem is lowercased + non-alphanumerics collapsed to `-`.
   *
   * @throws BadGatewayException — Supabase Storage returned an error.
   *         Wrapped at 502 so the FE distinguishes upstream failures
   *         from input-validation errors (which are 400 via the DTO).
   */
  async createSignedUploadUrl(
    body: CreateSignedUploadUrlDto,
  ): Promise<SignedUploadUrl> {
    const folder = this.folderForPurpose(body.purpose);
    const path = this.derivePath(folder, body.filename);

    const { data, error } = await this.supabase.storage
      .from(this.bucket)
      .createSignedUploadUrl(path);

    if (error || !data) {
      this.logger.error(
        `Failed to mint signed upload URL for ${path}: ${error?.message ?? 'no data'}`,
      );
      throw new BadGatewayException({
        code: 'STORAGE_SIGN_FAILED',
        message: 'Could not generate a signed upload URL. Try again.',
      });
    }

    this.logger.log(
      `Minted signed upload URL for ${this.bucket}/${path} (purpose=${body.purpose})`,
    );

    return {
      uploadUrl: data.signedUrl,
      token: data.token,
      path: data.path,
      bucket: this.bucket,
    };
  }

  /**
   * Maps each purpose to its storage folder. Centralising this keeps
   * the bucket layout explicit — one place to audit when changing it.
   */
  private folderForPurpose(purpose: UploadPurpose): string {
    switch (purpose) {
      case UploadPurpose.TOUR_HERO:
        return 'tours/hero';
      case UploadPurpose.TOUR_GALLERY:
        return 'tours/gallery';
      case UploadPurpose.DESTINATION_HERO:
        return 'destinations/hero';
      case UploadPurpose.USER_AVATAR:
        return 'users/avatars';
    }
  }

  /**
   * Sanitizes a client-supplied filename into a storage key.
   *
   * Defence-in-depth: the DTO regex already rejects path separators and
   * weird control bytes, but we still apply two more guards here in case
   * a future DTO change loosens the regex:
   *
   *  1. `basename` strips any directory prefix (belt-and-braces against
   *     path traversal).
   *  2. Stem is lowercased and non-alphanumerics collapsed to `-`, so the
   *     resulting key is URL-safe without further encoding.
   *
   * The extension is preserved as-is (lowercased) so Storage can serve
   * the right Content-Type when the FE requests a download.
   */
  private derivePath(folder: string, rawFilename: string): string {
    const base = rawFilename.split(/[\\/]/).pop() ?? rawFilename;
    const dotIndex = base.lastIndexOf('.');
    const stem = dotIndex > 0 ? base.slice(0, dotIndex) : base;
    const ext = dotIndex > 0 ? base.slice(dotIndex + 1) : '';

    const safeStem =
      stem
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'file';
    const safeExt = ext.toLowerCase().replace(/[^a-z0-9]+/g, '');

    const timestamp = Date.now();
    return safeExt
      ? `${folder}/${timestamp}-${safeStem}.${safeExt}`
      : `${folder}/${timestamp}-${safeStem}`;
  }
}
