import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { isCsrfExcluded } from '@myshopuz/shared';

const CSRF_COOKIE = 'csrfToken';
const CSRF_HEADER = 'x-csrf-token';

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const method = req.method.toUpperCase();

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      if (isCsrfExcluded(req.path, method)) return next();
      const headerToken = req.headers[CSRF_HEADER] as string;
      const cookieToken = req.cookies?.[CSRF_COOKIE];
      if (!headerToken || headerToken !== cookieToken) {
        return res.status(403).json({ message: 'Invalid CSRF token' });
      }
    }
    next();
  }
}
