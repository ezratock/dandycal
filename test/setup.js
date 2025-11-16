import { jest } from '@jest/globals';

// Setup performance API for tests
if (typeof global.performance === 'undefined') {
  global.performance = {
    now: () => Date.now(),
  };
}

// Setup fetch mock placeholder (will be overridden in tests)
if (typeof global.fetch === 'undefined') {
  global.fetch = jest.fn();
}

