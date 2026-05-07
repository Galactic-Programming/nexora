import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

/**
 * Bundles the users controller + service.
 *
 * `UsersService` is exported because future feature modules (bookings,
 * reviews) will need to look up users without going through HTTP.
 */
@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
