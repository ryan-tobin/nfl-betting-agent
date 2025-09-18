/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'a.espncdn.com',
        port: '',
        pathname: '/i/teamlogos/**',
      },
      {
        protocol: 'https',
        hostname: 'a.espncdn.com',
        port: '',
        pathname: '/combiner/i/**',
      },
      {
        protocol: 'https',
        hostname: 'assets.espn.go.com',
        port: '',
        pathname: '/**',
      }
    ],
  },
}

module.exports = nextConfig