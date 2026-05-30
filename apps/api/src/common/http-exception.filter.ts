import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { getApiLocaleFromRequest } from '../i18n/api-locale.middleware';
import { apiT, translateApiMessage, translateExceptionPayload } from '../i18n/api-i18n';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const isProd = process.env.NODE_ENV === 'production';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    const loc = getApiLocaleFromRequest(req);
    let message: string | object = apiT(loc, 'errors.internal');
    let body: Record<string, unknown> = {
      statusCode: status,
      message,
      error: 'Internal Server Error',
    };

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const payload = exception.getResponse();
      const rawMessage =
        typeof payload === 'object' && payload !== null && 'message' in payload
          ? (payload as { message: string | string[] }).message
          : String(payload);
      if (typeof payload === 'object' && payload !== null && !Array.isArray(payload) && 'message' in payload) {
        const translated = translateExceptionPayload(payload as object, loc) as Record<string, unknown>;
        message = translated.message as string | string[];
        body = {
          statusCode: status,
          ...translated,
          error: exception.name,
        };
      } else {
        message = translateApiMessage(rawMessage, loc);
        body = {
          statusCode: status,
          message,
          error: exception.name,
        };
      }
    } else if (exception instanceof Error) {
      this.logger.error(
        `${req.method} ${req.url} ${exception.message}`,
        exception.stack,
      );
      if (!isProd) {
        body.message = exception.message;
        body.stack = exception.stack;
      }
    }

    res.status(status).json(body);
  }
}
