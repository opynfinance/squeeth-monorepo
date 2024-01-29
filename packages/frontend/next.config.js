// eslint-disable-next-line @typescript-eslint/no-var-requires
const { withSentryConfig } = require('@sentry/nextjs')

const securityHeaders = [
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN',
  },
]

const moduleExports = {
  reactStrictMode: true,
  images: {
    domains: ['media.giphy.com'],
  },
  async rewrites() {
    return [
      {
        source: '/api/amplitude',
        destination: 'https://api.eu.amplitude.com/2/httpapi',
      },
    ]
  },
  async headers() {
    return [
      {
        // Apply these headers to all routes in your application.
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
  eslint: {
    dirs: ['pages', 'src'],
  },
}

const sentryWebpackPluginOptions = {
  org: 'opyn',
  project: 'squeeth',
  // authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
}

module.exports = withSentryConfig(moduleExports, sentryWebpackPluginOptions)
