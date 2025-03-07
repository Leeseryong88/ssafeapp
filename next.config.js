/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: [
      'firebasestorage.googleapis.com',
      'storage.googleapis.com',
      'safetyapp-7e55d.firebasestorage.app'
    ],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.googleusercontent.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**.firebasestorage.app',
        port: '',
        pathname: '/**',
      }
    ]
  },
};

module.exports = nextConfig; 