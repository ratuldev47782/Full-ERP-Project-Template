/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    security: {
      allowedUNCHosts: ['192.169.11.171'],
    },
  },
};

module.exports = nextConfig;