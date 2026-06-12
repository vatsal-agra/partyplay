/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [
      'm.media-amazon.com',
      'cf.geekdo-images.com',
      'scribbl.io',
      'images.unsplash.com',
      'via.placeholder.com'
    ],
  },
  // Enable React strict mode
  reactStrictMode: true,
  // Enable TypeScript checking in development
  typescript: {
    ignoreBuildErrors: false,
  },
  // Enable ESLint checking in development
  eslint: {
    ignoreDuringBuilds: false,
  },
}

module.exports = nextConfig
