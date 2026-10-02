import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { GlobalExceptionFilter, TransformInterceptor } from './common';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port', 4000);
  const env = configService.get<string>('env', 'development');
  const allowedOrigins = configService.get<string[]>('cors.origins', [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
  ]);

  // Graceful shutdown hooks for Prisma and HTTP server
  app.enableShutdownHooks();

  // Security hardening: Disable X-Powered-By header
  const httpAdapter = app.getHttpAdapter().getInstance();
  if (httpAdapter && typeof httpAdapter.disable === 'function') {
    httpAdapter.disable('x-powered-by');
  }

  // Configure CORS
  app.enableCors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-Request-ID',
      'Idempotency-Key',
      'idempotency-key',
      'Last-Event-ID',
    ],
  });

  // Global API Versioning Prefix
  app.setGlobalPrefix('api/v1');

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global Filters & Interceptors
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  // Swagger OpenAPI Documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Stayora API')
    .setDescription(
      'Stayora Hotel Booking & Reservation Platform — Core REST API Documentation.\n\n' +
        'Authoritative backend API serving Customer Web (:3000), Manager Web (:3001), and Admin Dashboard (:3002).\n\n' +
        'All endpoints adhere to `/api/v1` versioning, standard envelope responses, role-based authorization, and strict schema validation.',
    )
    .setVersion('1.0.0')
    .addTag('Health', 'System health and diagnostic endpoints')
    .addTag(
      'Auth',
      'Public customer registration, role-specific logins, and authentication tokens',
    )
    .addTag(
      'Hotels & Property Management',
      'Hotel property management, public discovery, and manager assignments',
    )
    .addTag(
      'Room Categories & Types',
      'Room categories, pricing models, occupancy rules, and amenities',
    )
    .addTag(
      'Room Physical Inventory',
      'Physical room inventory units and operational readiness',
    )
    .addTag(
      'Hotel Search & Discovery',
      'Real-time hotel availability search and rate queries',
    )
    .addTag(
      'Date-Range Inventory Availability',
      'Date-range room category availability queries',
    )
    .addTag(
      'Reservations & Booking Engine',
      'Reservation lifecycle, holding inventory, and state transitions',
    )
    .addTag(
      'Payments & Payment Attempts',
      'Idempotent payment processing and payment transaction ledgers',
    )
    .addTag(
      'Reviews & Ratings',
      'Verified guest reviews, hotel rating statistics, and moderation',
    )
    .addTag(
      'Notifications',
      'In-app notification delivery, read state tracking, and unread counts',
    )
    .addTag('Realtime / SSE', 'Server-Sent Events real-time event stream')
    .addTag(
      'Admin Operations & Platform Management',
      'Platform-wide administrative oversight, metrics, and audit logs',
    )
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter JWT bearer token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter JWT bearer token',
        in: 'header',
      },
      'bearer',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'Stayora API Documentation',
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  await app.listen(port);
  logger.log(`🚀 Stayora Backend API initialized in [${env}] mode`);
  logger.log(`📡 Listening on http://localhost:${port}/api/v1`);
  logger.log(
    `📖 Swagger API Docs available at http://localhost:${port}/api/docs`,
  );
  logger.log(
    `🩺 Health check accessible at http://localhost:${port}/api/v1/health`,
  );
}

bootstrap().catch((err: Error) => {
  const logger = new Logger('Bootstrap');
  logger.error(`Fatal application startup error: ${err.message}`, err.stack);
  process.exit(1);
});
