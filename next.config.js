/** @type {import('next').NextConfig} */
const path = require('path')

const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  // Keep @react-pdf/renderer external so webpack doesn't try to bundle it
  // (it has native Node.js deps). Sub-packages resolve automatically.
  serverExternalPackages: ['@react-pdf/renderer'],
  webpack: (config) => {
    config.resolve.alias['@'] = path.resolve(__dirname)
    return config
  },
}
module.exports = nextConfig
