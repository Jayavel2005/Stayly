import { HttpException, HttpStatus } from '@nestjs/common';

export class DomainException extends HttpException {
  public readonly code: string;
  public readonly details?: unknown;

  constructor(
    code: string,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    details?: unknown,
  ) {
    super({ code, message, details }, status);
    this.code = code;
    this.details = details;
  }
}
