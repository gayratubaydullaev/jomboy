import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl, isAllowedProxyPath } from '@/lib/proxy-path';

const ACCESS_TOKEN_COOKIE = 'access_token';

const FORWARD_HEADERS = [
  'authorization',
  'content-type',
  'accept',
  'x-cart-session',
  'x-csrf-token',
  'x-locale',
  'cookie',
] as const;

function getBackendUrlFromEnv(): string {
  return getBackendUrl();
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  return proxy(request, params, 'GET');
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  return proxy(request, params, 'POST');
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  return proxy(request, params, 'PATCH');
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  return proxy(request, params, 'DELETE');
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  return proxy(request, params, 'PUT');
}

async function proxy(
  request: NextRequest,
  params: Promise<{ path?: string[] }>,
  method: string
): Promise<NextResponse> {
  const { path } = await params;
  const pathSegments = path ?? [];
  const pathStr = pathSegments.join('/');
  const headers = new Headers();
  for (const name of FORWARD_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (!headers.has('authorization')) {
    const accessCookie = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
    if (accessCookie) headers.set('authorization', `Bearer ${accessCookie}`);
  }
  if (!isAllowedProxyPath(pathStr, headers.has('authorization'))) {
    console.warn('[api/proxy] Blocked path:', pathStr);
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }
  const backendUrl = getBackendUrlFromEnv();
  const url = `${backendUrl}/${pathStr}${request.nextUrl.search}`;

  let body: string | ArrayBuffer | undefined;
  const requestContentType = request.headers.get('content-type') || '';
  try {
    if (requestContentType.includes('multipart/form-data')) {
      const buf = await request.arrayBuffer();
      if (buf.byteLength > 0) body = buf;
    } else {
      const text = await request.text();
      if (text) body = text;
    }
  } catch {
    // no body
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body ?? undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Backend unreachable';
    console.error('[api/proxy] Backend unreachable:', url, err);
    return NextResponse.json(
      { message: 'Backend unavailable', error: message },
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let resBody: string;
  try {
    resBody = await res.text();
  } catch (err) {
    console.error('[api/proxy] Invalid response body:', url, err);
    return NextResponse.json(
      { message: 'Invalid response from backend' },
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (res.status >= 500) {
    console.error('[api/proxy] Backend 5xx:', res.status, url, resBody.slice(0, 200));
  }
  const resHeaders = new Headers();
  const contentType = res.headers.get('content-type');
  if (contentType) resHeaders.set('content-type', contentType);
  const setCookies = res.headers.getSetCookie?.();
  if (Array.isArray(setCookies)) {
    for (const cookie of setCookies) resHeaders.append('set-cookie', cookie);
  } else {
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) resHeaders.set('set-cookie', setCookie);
  }

  return new NextResponse(resBody, {
    status: res.status,
    statusText: res.statusText,
    headers: resHeaders,
  });
}
