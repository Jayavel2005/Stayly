import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiSuccessResponse } from '../types/api-response.type';

// Enable global JSON.stringify serialization for BigInt values
if (typeof BigInt !== 'undefined' && !(BigInt.prototype as any).toJSON) {
  (BigInt.prototype as any).toJSON = function () {
    return this.toString();
  };
}

function serializeBigInt(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return value.map(serializeBigInt);
  }
  if (typeof value === 'object' && !(value instanceof Date)) {
    const copy: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      copy[key] = serializeBigInt(val);
    }
    return copy;
  }
  return value;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  ApiSuccessResponse<T> | T
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiSuccessResponse<T> | T> {
    return next.handle().pipe(
      map((data: T): ApiSuccessResponse<T> | T => {
        const serialized = serializeBigInt(data) as T;

        if (
          serialized &&
          typeof serialized === 'object' &&
          'success' in serialized &&
          (serialized as { success: unknown }).success === true
        ) {
          return serialized;
        }

        return {
          success: true,
          data: serialized,
        };
      }),
    );
  }
}
