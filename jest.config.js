module.exports = {
  testEnvironment: 'jest-environment-jsdom',
  setupFiles: ['./tests/setup.js'],
  testPathIgnorePatterns: ['/node_modules/', '/tests/e2e/'],
  collectCoverageFrom: [
    'content/**/*.js',
    'popup/**/*.js',
    'background/**/*.js',
  ],
};
