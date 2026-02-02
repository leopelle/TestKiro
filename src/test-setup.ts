/**
 * Test setup configuration for Jest
 * 
 * This file is run before each test suite and sets up
 * global configurations for testing.
 */

// Extend Jest matchers if needed
declare global {
  namespace jest {
    interface Matchers<R> {
      // Custom matchers can be added here
    }
  }
}

// Global test configuration
beforeEach(() => {
  // Clear any timers or intervals that might affect tests
  jest.clearAllTimers();
});

afterEach(() => {
  // Clean up after each test
  jest.clearAllMocks();
});

// Configure property-based testing defaults
export const PROPERTY_TEST_CONFIG = {
  numRuns: 100, // Minimum iterations for property-based tests
  timeout: 30000, // 30 second timeout for property tests
  verbose: true,
};

// Mock crypto if not available in test environment
if (typeof crypto === 'undefined') {
  const { webcrypto } = require('crypto');
  global.crypto = webcrypto as Crypto;
}

export {};