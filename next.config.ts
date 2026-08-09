import type { NextConfig } from "next";

const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
  : null;
const supabaseSocketOrigin = supabaseOrigin?.replace(/^http/, 'ws');
const connectSources = ["'self'", supabaseOrigin, supabaseSocketOrigin].filter(Boolean).join(' ');

const nextConfig: NextConfig = {
  turbopack: { root: process.cwd() },
  images: { remotePatterns: [{ protocol: 'https', hostname: 'cdn2.unrealengine.com' }] },
  redirects: async () => ['www.fantafort.com', 'fantafort.vercel.app'].map(host => ({
    source: '/:path*',
    has: [{ type: 'host' as const, value: host }],
    destination: 'https://fantafort.com/:path*',
    permanent: true,
  })),
  headers: async () => [
    ...['auth', 'dashboard/:path*', 'trading', 'wallet', 'leagues/:path*', 'leaderboard', 'friends', 'notifications', 'account', 'admin', 'tournaments', 'api/:path*'].map(source => ({
      source: `/${source}`,
      headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
    })),
    {
      source: '/api/admin/:path*',
      headers: [{ key: 'Cache-Control', value: 'private, no-store, max-age=0' }],
    },
    {
      source: '/(.*)',
      headers: [
        { key: 'Content-Security-Policy', value: `default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src ${connectSources}; worker-src 'self' blob:; upgrade-insecure-requests` },
        { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
      ],
    },
  ],
};

export default nextConfig;
