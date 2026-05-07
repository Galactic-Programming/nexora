import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Global module that exposes a single {@link PrismaService} instance to the
 * entire app.
 *
 * Why `@Global()`?
 * - Every feature module touches the database. Without `@Global()` we'd
 *   need to add `imports: [PrismaModule]` to every module — pure noise
 *   that adds nothing.
 * - The single-instance contract is preserved: NestJS `@Global()` doesn't
 *   change provider scope, only its visibility.
 *
 * Imported once in `AppModule`. Do NOT re-import elsewhere — it's a no-op
 * but easily mistaken for a fresh instance.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
