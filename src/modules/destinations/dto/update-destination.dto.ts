import { PartialType } from '@nestjs/swagger';
import { CreateDestinationDto } from './create-destination.dto';

/**
 * Request body for `PATCH /admin/destinations/:slug`.
 *
 * `PartialType` from `@nestjs/swagger` re-exposes every field of
 * {@link CreateDestinationDto} as optional, preserving the validators and
 * Swagger annotations. So `slug` regex still applies if the admin chooses
 * to rename a destination — but they don't HAVE to send it.
 *
 * Note: changing `slug` will break any external bookmark / SEO link that
 * pointed to the old slug. Consider redirects in production.
 */
export class UpdateDestinationDto extends PartialType(CreateDestinationDto) {}
