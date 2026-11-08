module.exports = {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/tests/components/**/*.test.tsx'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
  modulePathIgnorePatterns: ['<rootDir>/.verification/', '<rootDir>/dist/'],
  clearMocks: true,
};
