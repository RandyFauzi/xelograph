/** @type {import('next').NextConfig} */
const config = {
  poweredByHeader: false,
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `http://127.0.0.1:${process.env.API_PORT || 3002}/api/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/models/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }],
      },
    ];
  },
};
export default config;
