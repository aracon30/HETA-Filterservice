/** @type {import('next').NextConfig} */
const path = require('path')

// Keep @react-pdf packages as server-external so webpack doesn't try to bundle
// them (they have native Node.js dependencies). react/react-dom must NOT be
// external — webpack bundles them so the whole app uses one consistent instance.
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
  serverExternalPackages: reactPdfPackages,
  webpack: (config) => {
    config.resolve.alias['@'] = path.resolve(__dirname)
    return config
  },
}
module.exports = nextConfig
