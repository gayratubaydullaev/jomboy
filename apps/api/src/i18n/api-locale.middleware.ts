import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { parseAcceptLanguage, parseApiLocale } from './api-locale';
import { apiLocaleStorage } from './api-locale.context';

@Injectable()
export class ApiLocaleMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const header = req.headers['x-locale'];
    const fromHeader = typeof header === 'string' ? parseApiLocale(header) : null;
    const locale =
      fromHeader ??
      parseApiLocale(typeof req.cookies?.myshop_locale === 'string' ? req.cookies.myshop_locale : null) ??
      parseAcceptLanguage(typeof req.headers['accept-language'] === 'string' ? req.headers['accept-language'] : undefined);
    apiLocaleStorage.run(locale, () => next());
  }
}

export function getApiLocaleFromRequest(req: Request) {
  const header = req.headers['x-locale'];
  if (typeof header === 'string') return parseApiLocale(header);
  return parseAcceptLanguage(typeof req.headers['accept-language'] === 'string' ? req.headers['accept-language'] : undefined);
}
