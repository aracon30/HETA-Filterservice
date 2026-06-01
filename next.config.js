/** @type {import('next').NextConfig} */
const path = require('path')

const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  webpack: (config) => {
    // Expliziter @/ Alias – überschreibt tsconfig-Pfadauflösung falls diese fehlschlägt
    config.resolve.alias['@'] = path.resolve(__dirname)
    return config
  },
}
module.exports = nextConfig
