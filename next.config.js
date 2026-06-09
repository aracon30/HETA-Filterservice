/** @type {import('next').NextConfig} */
const path = require('path')

const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  // Next.js 14.1 uses experimental.serverComponentsExternalPackages (renamed
  // to serverExternalPackages in Next.js 14.2+). Keep @react-pdf external so
  // webpack doesn't try to bundle the ESM-only package.
  experimental: {
    serverComponentsExternalPackages: ['@react-pdf/renderer'],
  },
  webpack: (config) => {
    config.resolve.alias['@'] = path.resolve(__dirname)
    return config
  },
}
module.exports = nextConfig
