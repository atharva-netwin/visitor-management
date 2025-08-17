// Set test environment
process.env['NODE_ENV'] = 'test';

// Global test timeout
jest.setTimeout(10000);

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});