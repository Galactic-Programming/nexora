import { registerAs } from '@nestjs/config';

/**
 * Strongly-typed shape of the `cloudinary.*` config namespace.
 *
 * Consumed by:
 * - `UploadsService` — `apiSecret` to sign direct-upload requests; `cloudName`
 *   + `apiKey` echoed to the FE so it can complete the signed upload.
 * - `MediaService` / `buildCloudinaryUrl` — `cloudName` to build delivery URLs.
 *
 * Part of the Supabase Storage → Cloudinary migration
 * (see docs/planning/cloudinary-media-migration.md).
 */
export type CloudinaryConfig = ReturnType<typeof cloudinaryConfig>;

/**
 * Cloudinary credentials + upload defaults.
 *
 * The non-null assertions (`!`) are safe: {@link envValidationSchema} marks
 * `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`
 * `.required()`, so by the time this factory runs the values exist.
 *
 * Security boundary:
 *  - `cloudName` / `apiKey` are PUBLIC — safe to send to the FE; the FE needs
 *    them to POST the signed upload to Cloudinary.
 *  - `apiSecret` is PRIVATE — used only to compute the upload signature
 *    server-side. It MUST never leave the backend.
 *
 * @returns Frozen-at-boot Cloudinary configuration.
 */
export const cloudinaryConfig = registerAs('cloudinary', () => ({
  cloudName: process.env.CLOUDINARY_CLOUD_NAME!,
  apiKey: process.env.CLOUDINARY_API_KEY!,
  apiSecret: process.env.CLOUDINARY_API_SECRET!,
  // Root folder for all uploads. Joi applies `'tourism'` when unset.
  uploadFolder: process.env.CLOUDINARY_UPLOAD_FOLDER ?? 'tourism',
}));
