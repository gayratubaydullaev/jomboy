/** @type {import('next').NextConfig} */
const path = require('path');
if (process.env.NODE_ENV === 'production') {
  const sessionSecret = process.env.SESSION_COOKIE_SECRET?.trim();
  if (!sessionSecret || sessionSecret.length < 32) {
    throw new Error(
      'SESSION_COOKIE_SECRET is required in production (min 32 chars). Set it in .env before build/start.',
    );
  }
  const jwtSecret = process.env.JWT_SECRET?.trim();
  if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error('JWT_SECRET is required in production (min 32 chars) for session route JWT verification.');
  }
}

const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
let apiServerUrl = rawApiUrl.includes(',') ? rawApiUrl.split(',')[0].trim() : rawApiUrl;
if (apiServerUrl && !/^https?:\/\//i.test(apiServerUrl)) apiServerUrl = 'https://' + apiServerUrl;
const isDockerBuild = process.env.DOCKER_BUILD === '1';
const nextConfig = {
  reactStrictMode: true,
  ...(isDockerBuild
    ? { output: 'standalone', outputFileTracingRoot: path.join(__dirname, '../..') }
    : {}),
  // BUILD_ID: set in CI so all instances share same build (avoids "Failed to find Server Action" / workers undefined).
  // NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: set at BUILD TIME in production (base64, 32 bytes). Generate: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
  generateBuildId: async () => {
    if (process.env.BUILD_ID) return process.env.BUILD_ID;
    // CI: use commit SHA so same commit = same build ID across deploys
    const sha = process.env.GITHUB_SHA || process.env.CI_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA;
    if (sha) return sha;
    return `build-${Date.now()}`;
  },
  async rewrites() {
    return [{ source: '/api-proxy/:path*', destination: `${apiServerUrl}/:path*` }];
  },
  async redirects() {
    return [{ source: '/favicon.ico', destination: '/favicon.svg', permanent: false }];
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com', pathname: '/**' },
      { protocol: 'https', hostname: 'images.unsplash.com', pathname: '/**' },
    ],
    // In dev, image optimizer can 500 on some external URLs; skip optimization to avoid
    unoptimized: process.env.NODE_ENV === 'development',
  },
  async headers() {
    const isProd = process.env.NODE_ENV === 'production';
    const apiConnect = apiServerUrl.replace(/\/$/, '');
    const securityHeaders = [
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      {
        key: 'Content-Security-Policy',
        value: [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline'",
          "style-src 'self' 'unsafe-inline'",
          `connect-src 'self' ${apiConnect}`,
          "img-src 'self' data: blob: https://res.cloudinary.com https://images.unsplash.com",
          "font-src 'self' data:",
          "frame-ancestors 'none'",
        ].join('; '),
      },
    ];
    if (isProd) {
      securityHeaders.push({
        key: 'Strict-Transport-Security',
        value: 'max-age=31536000; includeSubDomains; preload',
      });
    }
    return [
      { source: '/(.*)', headers: securityHeaders },
      // Telegram Web App: allow opening in Telegram client (no X-Frame-Options for this path)
      {
        source: '/telegram-app/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'self' https://web.telegram.org https://telegram.org;" },
        ],
      },
    ];
  },
};

const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

module.exports = withBundleAnalyzer(nextConfig);
