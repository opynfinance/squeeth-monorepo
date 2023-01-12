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
  silent: true,
  // authToken: process.env.NEXT_PUBLIC_SENTRY_AUTH_TOKEN,
}

module.exports = withSentryConfig(moduleExports, sentryWebpackPluginOptions)
