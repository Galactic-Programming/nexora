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
  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : true,
    credentials: true,
  });
  app.setGlobalPrefix(apiPrefix);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
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
