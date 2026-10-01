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
      'Stayora Hotel Booking & Reservation Platform — Core REST API Documentation',
    )
    .setVersion('1.0.0')
    .addTag('Health', 'System health and diagnostic endpoints')
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
