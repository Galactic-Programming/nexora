import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import express from 'express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

/**
 * Application entry point.
 *
 * Responsibilities (in order of execution):
 *  1. Boot the Nest app with `bufferLogs: true` so early-startup logs are
 *     buffered until the pino logger is wired up — avoids losing messages
 *     to stdout's default formatter.
 *  2. Read runtime config (port, prefix, CORS origins, prod flag) — these
 *     are resolved through `ConfigService` so they go through Joi validation
 *     and the namespaced `app.*` factory.
 *  3. Mount express.raw() on the Stripe webhook path BEFORE Nest applies
 *     its global JSON parser. Stripe signature verification needs the
 *     untouched raw body bytes; running JSON.parse first would corrupt them.
 *  4. Apply security middleware (helmet) and CORS allowlist.
 *  5. Set the global URL prefix and a global ValidationPipe with whitelist
 *     mode (extra fields rejected) and implicit type conversion (so query
 *     strings auto-cast to numbers/booleans where DTOs expect them).
 *  6. In non-production: mount Swagger UI at `/api/docs` with a persistent
 *     bearer-auth slot so testers don't need to paste their token on every
 *     reload.
 *  7. Listen on `0.0.0.0` (binds all interfaces — required by Railway and
 *     similar PaaS) and log the friendly URLs.
 *
 * @returns Resolves once the HTTP server is accepting connections.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));

  const config = app.get(ConfigService);
  const apiPrefix = config.get<string>('app.apiPrefix') ?? 'api/v1';
  const port = config.get<number>('app.port') ?? 3000;
  const corsOrigins = config.get<string[]>('app.corsOrigins') ?? [];
  const isProduction = config.get<boolean>('app.isProduction') ?? false;

  // Stripe webhook needs the raw body for signature verification — must be
  // registered BEFORE the global JSON parser. The path matches the controller
  // route added in Sprint B3.
  app.use(
    `/${apiPrefix}/payments/webhook`,
    express.raw({ type: 'application/json' }),
  );

  app.use(helmet());
  // `origin: true` reflects the request origin, which is what we want when
  // no allowlist is configured (local dev). In prod the allowlist must be
  // populated via `CORS_ORIGINS`.
  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : true,
    credentials: true,
  });
  app.setGlobalPrefix(apiPrefix);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip properties not listed in the DTO
      forbidNonWhitelisted: true, // ...AND reject the request when extras appear
      transform: true, // hydrate plain objects into DTO classes
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  if (!isProduction) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Tourism API')
      .setDescription('Tourism booking platform — REST API')
      .setVersion('0.1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Supabase JWT (access_token from signInWithPassword)',
        },
        // Name MUST match the @ApiBearerAuth('supabase-jwt') decorator on
        // controllers — that's how Swagger links the auth scheme to routes.
        'supabase-jwt',
      )
      .addServer(`http://localhost:${port}`)
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  await app.listen(port, '0.0.0.0');
  const logger = app.get(Logger);
  logger.log(
    `🚀 Tourism API listening on http://localhost:${port}/${apiPrefix}`,
  );
  if (!isProduction) {
    logger.log(`📚 Swagger UI: http://localhost:${port}/api/docs`);
  }
}

void bootstrap();
