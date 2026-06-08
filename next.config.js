/** @type {import('next').NextConfig} */
const path = require('path')

const reactPdfPackages = [
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
]

const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  // Tell Next.js NOT to bundle these ESM-only packages — let Node.js load them natively
  serverExternalPackages: reactPdfPackages,
  webpack: (config) => {
    config.resolve.alias['@'] = path.resolve(__dirname)
    return config
  },
}
module.exports = nextConfig

