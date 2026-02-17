module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/index.ts'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@core/(.*)$': '<rootDir>/src/core/$1',
    '^@agents/(.*)$': '<rootDir>/src/agents/$1',
    '^@parsers/(.*)$': '<rootDir>/src/parsers/$1',
    '^@generators/(.*)$': '<rootDir>/src/generators/$1',
    '^@llm/(.*)$': '<rootDir>/src/llm/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@wiki/(.*)$': '<rootDir>/src/wiki/$1',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
  },
  verbose: true,
};
