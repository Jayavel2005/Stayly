import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiSuccessResponse } from '../types/api-response.type';

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
        if (
          data &&
          typeof data === 'object' &&
          'success' in data &&
          (data as { success: unknown }).success === true
        ) {
          return data;
        }

        return {
          success: true,
          data,
        };
      }),
    );
  }
}
