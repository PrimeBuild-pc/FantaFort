/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/client/:path*',
        destination: '/dist/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
