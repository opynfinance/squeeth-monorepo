// eslint-disable-next-line @typescript-eslint/no-var-requires
// const nextJest = require('next/jest')

// const createJestConfig = nextJest({
//   // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
//   dir: './',
// })

const customJestConfig = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  modulePaths: ['<rootDir>/src'],
  testPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/node_modules/', '<rootDir>/cypress/'],
  moduleNameMapper: {
    '^src(.*)$': '<rootDir>/src$1',
    '^@utils(.*)$': '<rootDir>/src/utils$1',
    '^@hooks(.*)$': '<rootDir>/src/hooks$1',
    '^@constants(.*)$': '<rootDir>/src/constants$1',
    '^@context(.*)$': '<rootDir>/src/context$1',
    '^@queries(.*)$': '<rootDir>/src/queries$1',
  },
}

module.exports = customJestConfig
