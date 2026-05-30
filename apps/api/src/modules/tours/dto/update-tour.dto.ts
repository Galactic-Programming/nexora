import { PartialType } from '@nestjs/swagger';
import { CreateTourDto } from './create-tour.dto';

/**
 * Request body for `PATCH /admin/tours/:slug`.
 *
 * `PartialType` re-exposes every field of {@link CreateTourDto} as optional
 * while keeping all validators and Swagger annotations. So if an admin
 * sends `slug` here, the kebab-case regex still applies; if they omit it,
 * nothing changes.
 *
 * Caveats:
 * - Renaming `slug` will break external bookmarks / SEO. Front-end should
 *   warn the admin before allowing it.
 * - Changing `destinationId` is allowed but requires the new destination to
 *   exist (service validates that).
 */
export class UpdateTourDto extends PartialType(CreateTourDto) {}
