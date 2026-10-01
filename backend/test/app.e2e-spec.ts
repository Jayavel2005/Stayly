import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  Controller,
  Post,
  Body,
} from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import request from 'supertest';
import { App } from 'supertest/types';
import { IsNotEmpty, IsString } from 'class-validator';
import { AppModule } from './../src/app.module';
import {
  GlobalExceptionFilter,
  TransformInterceptor,
  ApiSuccessResponse,
  ApiErrorResponse,
} from './../src/common';

class TestValidationDto {
  @IsString()
  @IsNotEmpty()
  title!: string;
}

@Controller('test-validation')
class TestValidationController {
  @Post()
  testValidate(@Body() body: TestValidationDto) {
    return { received: body.title };
  }
}

describe('Stayora API Foundation (e2e)', () => {
  let app: INestApplication;
  let server: App;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [TestValidationController],
    }).compile();

    app = moduleFixture.createNestApplication();

    app.setGlobalPrefix('api/v1');

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

    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());

    const swaggerConfig = new DocumentBuilder()
      .setTitle('Stayora API')
      .setDescription('Stayora Test API')
      .setVersion('1.0.0')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);

    await app.init();
    server = app.getHttpServer() as App;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Health Endpoint', () => {
    it('GET /api/v1/health should return 200 and standard success response', async () => {
      const response = await request(server).get('/api/v1/health').expect(200);

      const body = response.body as ApiSuccessResponse<{
        status: string;
        service: string;
        environment: string;
        timestamp: string;
      }>;

      expect(body).toEqual({
        success: true,
        data: expect.objectContaining({
          status: 'ok',
          service: 'stayora-api',
          environment: expect.any(String),
          timestamp: expect.any(String),
        }),
      });
    });
  });

  describe('Global Error Handling', () => {
    it('GET /api/v1/non-existent-route should return 404 with standardized error structure', async () => {
      const response = await request(server)
        .get('/api/v1/non-existent-route')
        .expect(404);

      const body = response.body as ApiErrorResponse;

      expect(body).toEqual({
        success: false,
        error: expect.objectContaining({
          code: 'NOT_FOUND',
          message: expect.stringContaining(
            'Cannot GET /api/v1/non-existent-route',
          ),
        }),
        timestamp: expect.any(String),
        path: '/api/v1/non-existent-route',
      });
    });
  });

  describe('Global ValidationPipe', () => {
    it('POST /api/v1/test-validation should accept valid payload', async () => {
      const response = await request(server)
        .post('/api/v1/test-validation')
        .send({ title: 'Deluxe Suite' })
        .expect(201);

      const body = response.body as ApiSuccessResponse<{ received: string }>;

      expect(body).toEqual({
        success: true,
        data: { received: 'Deluxe Suite' },
      });
    });

    it('POST /api/v1/test-validation should reject non-whitelisted unexpected fields with 400', async () => {
      const response = await request(server)
        .post('/api/v1/test-validation')
        .send({ title: 'Deluxe Suite', unexpectedProperty: 'malicious' })
        .expect(400);

      const body = response.body as ApiErrorResponse;

      expect(body).toEqual({
        success: false,
        error: expect.objectContaining({
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: expect.arrayContaining([
            expect.stringContaining(
              'property unexpectedProperty should not exist',
            ),
          ]),
        }),
        timestamp: expect.any(String),
        path: '/api/v1/test-validation',
      });
    });
  });

  describe('Swagger Documentation', () => {
    it('GET /api/docs should serve Swagger UI HTML', async () => {
      const response = await request(server).get('/api/docs/');
      expect(response.status).toBe(200);
      expect(response.text).toContain('Swagger UI');
    });
  });
});
