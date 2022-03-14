module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/node_modules/', '<rootDir>/cypress/'],
  moduleNameMapper: {
    '^@constants(.*)$': '<rootDir>/src/constants/$1',
    '^@utils(.*)$': '<rootDir>/src/utils/$1',
    '^@hooks(.*)$': '<rootDir>/src/hooks/$1',
  },
}
