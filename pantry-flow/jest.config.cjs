module.exports = {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/tests/components/**/*.test.tsx'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
  modulePathIgnorePatterns: ['<rootDir>/.verification/', '<rootDir>/dist/'],
  // A cold transform cache on a fresh checkout took 10-12 s for the first
  // component test against the 5 s default (observed 2026-11-12).
  testTimeout: 30000,
  clearMocks: true,
};
