module.exports = {
  rootDir: __dirname,
  testEnvironment: 'node',
  testMatch: ['<rootDir>/t/**/*.test.js'],
  testTimeout: 30000, // allow shell-based tests to complete comfortably
};
