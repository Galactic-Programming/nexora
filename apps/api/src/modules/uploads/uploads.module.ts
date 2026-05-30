import { Module } from '@nestjs/common';
import { AdminUploadsController } from './admin-uploads.controller';
import { UploadsService } from './uploads.service';

/**
 * Single-controller module — signed upload URLs are admin-only for now.
 *
 * `UploadsService` is exported so future modules (a seed script, an
 * automated voucher PDF generator) can mint signed URLs without going
 * through the HTTP layer.
 */
@Module({
  controllers: [AdminUploadsController],
  providers: [UploadsService],
  exports: [UploadsService],
})
export class UploadsModule {}
