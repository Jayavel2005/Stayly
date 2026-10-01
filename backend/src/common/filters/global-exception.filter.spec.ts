import {
  HttpException,
  HttpStatus,
  BadRequestException,
  ArgumentsHost,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { GlobalExceptionFilter } from './global-exception.filter';
import { ApiErrorResponse } from '../types/api-response.type';

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let mockResponse: Partial<Response>;
  let mockRequest: Partial<Request>;
  let mockArgumentsHost: ArgumentsHost;
  let capturedStatus: number | undefined;
  let capturedJson: ApiErrorResponse | undefined;

  beforeEach(() => {
    filter = new GlobalExceptionFilter();
    capturedStatus = undefined;
    capturedJson = undefined;

    mockResponse = {
      status: jest.fn().mockImplementation((code: number) => {
        capturedStatus = code;
        return mockResponse as Response;
      }),
      json: jest.fn().mockImplementation((payload: ApiErrorResponse) => {
        capturedJson = payload;
        return mockResponse as Response;
      }),
    };

    mockRequest = {
      url: '/api/v1/test',
      method: 'GET',
    };

    mockArgumentsHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: () => mockResponse as Response,
        getRequest: () => mockRequest as Request,
      }),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
      getType: jest.fn(),
    };
  });

  it('should format standard HttpException with custom status and error code', () => {
    const exception = new HttpException(
      'Resource not found',
      HttpStatus.NOT_FOUND,
    );

    filter.catch(exception, mockArgumentsHost);

    expect(capturedStatus).toBe(HttpStatus.NOT_FOUND);
    expect(capturedJson).toEqual(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'NOT_FOUND',
          message: 'Resource not found',
        }),
        path: '/api/v1/test',
      }),
    );
  });

  it('should format validation errors with VALIDATION_ERROR code', () => {
    const exception = new BadRequestException({
      message: ['field is required', 'field must be a string'],
      error: 'Bad Request',
      statusCode: 400,
    });

    filter.catch(exception, mockArgumentsHost);

    expect(capturedStatus).toBe(HttpStatus.BAD_REQUEST);
    expect(capturedJson).toEqual(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: ['field is required', 'field must be a string'],
        }),
      }),
    );
  });

  it('should handle unhandled internal server errors without leaking stack traces', () => {
    const exception = new Error('Database password leak attempt');

    filter.catch(exception, mockArgumentsHost);

    expect(capturedStatus).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(capturedJson).toEqual(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected internal server error occurred',
        }),
      }),
    );
  });
});
