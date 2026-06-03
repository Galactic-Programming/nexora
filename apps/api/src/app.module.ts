import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import {
  appConfig,
  cloudinaryConfig,
  emailConfig,
  envValidationSchema,
  stripeConfig,
  supabaseConfig,
  throttlerConfig,
} from './config';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { SupabaseJwtGuard } from './common/guards/supabase-jwt.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { PrismaModule } from './prisma/prisma.module';
import { AdminStatsModule } from './modules/admin-stats/admin-stats.module';
import { AuthModule } from './modules/auth/auth.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { DeparturesModule } from './modules/departures/departures.module';
import { DestinationsModule } from './modules/destinations/destinations.module';
import { EmailModule } from './modules/email/email.module';
import { HealthModule } from './modules/health/health.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { ToursModule } from './modules/tours/tours.module';
import { WishlistModule } from './modules/wishlist/wishlist.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { UsersModule } from './modules/users/users.module';

/**
 * Root composition module wiring every cross-cutting concern + feature
 * module into one DI container.
 *
 * Layers, in registration order:
 *
 *  - **ConfigModule** — global, loads + caches the namespaced configs
 *    (`appConfig`, `supabaseConfig`, ...) and validates `process.env`
 *    against `envValidationSchema`. `abortEarly: false` so operators see
 *    EVERY missing env var at once, not the first one only.
 *  - **LoggerModule** (`nestjs-pino`) — structured JSON in prod, colorized
 *    pretty-printed lines in dev. Auth + cookie headers are redacted.
 *  - **ThrottlerModule** — global rate limit driven by `throttler.*` config.
 *    `ttl` here is in milliseconds, but our config exposes seconds, hence
 *    the `* 1000` conversion.
 *  - **PrismaModule** — global database access (see prisma/prisma.module.ts).
 *  - **Health/Auth/Users modules** — feature modules (will grow over sprints).
 *
 * Global providers (registered via `APP_*` tokens):
 *
 *  1. `HttpExceptionFilter` — uniform error envelope.
 *  2. `TransformInterceptor` — uniform success envelope.
 *  3. `ThrottlerGuard` — runs first to short-circuit floods.
 *  4. `SupabaseJwtGuard` — verifies JWT, attaches `req.supabaseUser` /
 *     `req.currentUser`.
 *  5. `RolesGuard` — enforces `@Roles(...)` against `req.currentUser.role`.
 *
 * Guard order matters: ThrottlerGuard must precede the auth guards (don't
 * waste CPU on JWT verification for clients we already plan to throttle),
 * and SupabaseJwtGuard must precede RolesGuard (RolesGuard reads what
 * SupabaseJwtGuard attaches).
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [
        appConfig,
        supabaseConfig,
        cloudinaryConfig,
        stripeConfig,
        emailConfig,
        throttlerConfig,
      ],
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: false },
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: config.get<string>('app.logLevel') ?? 'info',
          // pino-pretty is a dev convenience — production stays as JSON
          // so log aggregators (Datadog/Loki/...) can parse it.
          transport: config.get<boolean>('app.isProduction')
            ? undefined
            : {
                target: 'pino-pretty',
                options: { singleLine: true, colorize: true },
              },
          redact: {
            paths: ['req.headers.authorization', 'req.headers.cookie'],
            censor: '[REDACTED]',
          },
          customProps: () => ({ service: 'tourism-be-api' }),
        },
      }),
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: (config.get<number>('throttler.ttlSeconds') ?? 60) * 1000,
          limit: config.get<number>('throttler.limit') ?? 100,
        },
      ],
    }),
    PrismaModule,
    EmailModule,
    HealthModule,
    AuthModule,
    UsersModule,
    DestinationsModule,
    ToursModule,
    DeparturesModule,
    UploadsModule,
    PaymentsModule,
    BookingsModule,
    ReviewsModule,
    WishlistModule,
    AdminStatsModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: SupabaseJwtGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
