import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

/**
 * Bundles the auth controller + service.
 *
 * `AuthService` is exported because future modules may want to call
 * `syncCustomer` / `syncAdmin` programmatically (e.g. an admin tool that
 * provisions accounts). Controllers are not exported — they're consumed by
 * NestJS's HTTP layer only.
 */
@Module({
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
