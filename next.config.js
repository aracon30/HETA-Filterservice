/** @type {import('next').NextConfig} */
const path = require('path')

const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  transpilePackages: [
    '@react-pdf/renderer',
    '@react-pdf/fns',
    '@react-pdf/font',
    '@react-pdf/image',
    '@react-pdf/layout',
    '@react-pdf/pdfkit',
    '@react-pdf/primitives',
    '@react-pdf/reconciler',
    '@react-pdf/render',
    '@react-pdf/stylesheet',
    '@react-pdf/svg',
    '@react-pdf/textkit',
    '@react-pdf/types',
  ],
  webpack: (config) => {
    config.resolve.alias['@'] = path.resolve(__dirname)
    return config
  },
}
module.exports = nextConfig
