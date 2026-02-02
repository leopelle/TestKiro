/**
 * Clipboard Manager Property-Based Tests
 * 
 * Property-based tests using fast-check to verify clipboard auto-deletion
 * functionality.
 * 
 * Feature: password-manager-app
 */

import * as fc from 'fast-check';
import { describe, test, expect } from '@jest/globals';
import { ClipboardManager, MockClipboardProvider } from './clipboard-manager';

/**
 * Helper to wait for a specific time
 */
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Arbitrary for generating clipboard data (passwords, usernames, etc.)
 */
const clipboardDataArbitrary = fc.oneof(
  // Simple passwords
  fc.string({ minLength: 8, maxLength: 32 }),
  
  // Passwords with special characters
  fc.string({ minLength: 8, maxLength: 32 }).map(s => `${s}!@#$%^&*()`),
  
  // Usernames/emails
  fc.emailAddress(),
  
  // Credit card numbers
  fc.string({ minLength: 16, maxLength: 16 }).filter(s => /^\d+$/.test(s)),
  
  // Unicode text
  fc.constantFrom(
    'пароль123',
    '密码🔒',
    'パスワード',
    'كلمة السر',
    'p@ssw0rd🔑'
  ),
  
  // Multi-line text
  fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 2, maxLength: 5 })
    .map(lines => lines.join('\n'))
);

/**
 * Arbitrary for generating wipe timeouts
 * Using shorter timeouts for faster testing
 * (Currently unused but kept for potential future use)
 */
// const wipeTimeoutArbitrary = fc.oneof(
//   fc.constant(30000), // Default 30 seconds
//   fc.integer({ min: 100, max: 1000 }), // Fast timeouts for testing
//   fc.integer({ min: 1000, max: 5000 }), // Medium timeouts
// );

describe('Clipboard Manager - Property-Based Tests', () => {
  /**
   * Property 18: Auto-cancellazione Appunti
   * 
   * **Validates: Requirements 6.4**
   * 
   * For any data copied to the clipboard by the system, it should be
   * automatically deleted after exactly 30 seconds (or the configured timeout).
   * 
   * This property verifies that:
   * 1. Any data copied with autoWipe enabled is cleared after the timeout
   * 2. The timeout is exactly as specified (30 seconds by default)
   * 3. The clipboard is only wiped if it still contains the original data
   * 4. Multiple copies with different timeouts are handled correctly
   * 5. The wipe operation works for any type of data (passwords, unicode, etc.)
   * 6. Data copied without autoWipe is never automatically deleted
   * 7. The wipeAt timestamp is accurate
   */
  describe('Property 18: Clipboard Auto-Deletion', () => {
    test('any data copied with autoWipe should be cleared after timeout', async () => {
      await fc.assert(
        fc.asyncProperty(
          clipboardDataArbitrary,
          fc.integer({ min: 100, max: 500 }), // Use shorter timeouts for testing
          async (data, timeout) => {
            const provider = new MockClipboardProvider();
            const manager = new ClipboardManager(provider);

            try {
              // Copy data with auto-wipe enabled
              const result = await manager.copyToClipboard(data, {
                autoWipe: true,
                wipeTimeout: timeout,
              });

              // Property 1: Copy should succeed
              expect(result.success).toBe(true);

              // Property 2: Data should be in clipboard immediately
              expect(provider.getContent()).toBe(data);

              // Property 3: wipeAt timestamp should be set correctly
              expect(result.wipeAt).toBeDefined();
              const expectedWipeTime = Date.now() + timeout;
              expect(result.wipeAt).toBeGreaterThanOrEqual(expectedWipeTime - 50);
              expect(result.wipeAt).toBeLessThanOrEqual(expectedWipeTime + 50);

              // Wait for the timeout plus a small buffer
              await wait(timeout + 100);

              // Property 4: Data should be cleared after timeout
              expect(provider.getContent()).toBe('');

              // Property 5: No pending timers should remain
              expect(manager.getPendingWipeCount()).toBe(0);
            } finally {
              manager.destroy();
            }
          }
        ),
        { numRuns: 10 }
      );
    }, 30000); // Increase test timeout

    test('clipboard should only be wiped if it still contains original data', async () => {
      await fc.assert(
        fc.asyncProperty(
          clipboardDataArbitrary,
          clipboardDataArbitrary,
          fc.integer({ min: 100, max: 300 }),
          async (originalData, newData, timeout) => {
            // Skip if data is the same
            fc.pre(originalData !== newData);

            const provider = new MockClipboardProvider();
            const manager = new ClipboardManager(provider);

            try {
              // Copy original data with auto-wipe
              await manager.copyToClipboard(originalData, {
                autoWipe: true,
                wipeTimeout: timeout,
              });

              expect(provider.getContent()).toBe(originalData);

              // User copies something else before timeout
              await provider.writeText(newData);
              expect(provider.getContent()).toBe(newData);

              // Wait for the timeout
              await wait(timeout + 100);

              // Property: Clipboard should NOT be wiped because content changed
              expect(provider.getContent()).toBe(newData);
            } finally {
              manager.destroy();
            }
          }
        ),
        { numRuns: 10 }
      );
    }, 30000);

    test('data copied without autoWipe should never be automatically deleted', async () => {
      await fc.assert(
        fc.asyncProperty(
          clipboardDataArbitrary,
          fc.integer({ min: 100, max: 300 }),
          async (data, waitTime) => {
            const provider = new MockClipboardProvider();
            const manager = new ClipboardManager(provider);

            try {
              // Copy data WITHOUT auto-wipe
              const result = await manager.copyToClipboard(data, {
                autoWipe: false,
              });

              // Property 1: Copy should succeed
              expect(result.success).toBe(true);

              // Property 2: wipeAt should NOT be set
              expect(result.wipeAt).toBeUndefined();

              // Property 3: Data should be in clipboard
              expect(provider.getContent()).toBe(data);

              // Wait for some time
              await wait(waitTime);

              // Property 4: Data should STILL be in clipboard
              expect(provider.getContent()).toBe(data);

              // Property 5: No timers should be pending
              expect(manager.getPendingWipeCount()).toBe(0);
            } finally {
              manager.destroy();
            }
          }
        ),
        { numRuns: 10 }
      );
    }, 30000);

    test('default timeout should be exactly 30 seconds', async () => {
      await fc.assert(
        fc.asyncProperty(
          clipboardDataArbitrary,
          async (data) => {
            const provider = new MockClipboardProvider();
            const manager = new ClipboardManager(provider);

            try {
              const beforeCopy = Date.now();

              // Copy with default settings (should use 30 seconds)
              const result = await manager.copyToClipboard(data, {
                autoWipe: true,
                // No wipeTimeout specified - should default to 30000ms
              });

              const afterCopy = Date.now();

              // Property: wipeAt should be approximately 30 seconds from now
              expect(result.wipeAt).toBeDefined();
              const expectedWipeTime = beforeCopy + 30000;
              expect(result.wipeAt).toBeGreaterThanOrEqual(expectedWipeTime - 100);
              expect(result.wipeAt).toBeLessThanOrEqual(afterCopy + 30000 + 100);

              // Property: The timeout should be exactly 30000ms
              const actualTimeout = result.wipeAt! - beforeCopy;
              expect(actualTimeout).toBeGreaterThanOrEqual(29900);
              expect(actualTimeout).toBeLessThanOrEqual(30100);
            } finally {
              manager.destroy();
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    test('multiple copies with different timeouts should all be wiped correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              data: clipboardDataArbitrary,
              timeout: fc.integer({ min: 100, max: 500 }),
            }),
            { minLength: 2, maxLength: 5 }
          ),
          async (copies) => {
            const provider = new MockClipboardProvider();
            const manager = new ClipboardManager(provider);

            try {
              // Copy all data items
              for (const { data, timeout } of copies) {
                await manager.copyToClipboard(data, {
                  autoWipe: true,
                  wipeTimeout: timeout,
                });
              }

              // Property: All timers should be tracked
              expect(manager.getPendingWipeCount()).toBe(copies.length);

              // Find the maximum timeout
              const maxTimeout = Math.max(...copies.map(c => c.timeout));

              // Wait for all timeouts to expire
              await wait(maxTimeout + 200);

              // Property: All timers should have expired
              expect(manager.getPendingWipeCount()).toBe(0);

              // Property: Clipboard should be cleared
              // (it will contain the last copied item, which should be wiped)
              if (copies.length > 0) {
                const lastCopy = copies[copies.length - 1];
                if (lastCopy) {
                  const currentContent = provider.getContent();
                  
                  // Either the clipboard is empty (wiped) or contains something else
                  // (if user copied something in between)
                  if (currentContent === lastCopy.data) {
                    // This shouldn't happen as the timer should have fired
                    expect(currentContent).toBe('');
                  }
                }
              }
            } finally {
              manager.destroy();
            }
          }
        ),
        { numRuns: 10 }
      );
    }, 30000);

    test('auto-wipe should work correctly for any type of data', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            // Empty-ish strings (should be rejected)
            fc.constant(''),
            fc.constant('   '),
            
            // Normal strings
            fc.string({ minLength: 1, maxLength: 100 }),
            
            // Special characters
            fc.string({ minLength: 1, maxLength: 50 }).map(s => `!@#$%^&*()${s}`),
            
            // Unicode
            fc.constantFrom('🔒🔑', '密码', 'пароль', 'パスワード'),
            
            // Very long strings
            fc.string({ minLength: 1000, maxLength: 5000 }),
            
            // Strings with newlines
            fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 10 })
              .map(lines => lines.join('\n')),
          ),
          fc.integer({ min: 100, max: 300 }),
          async (data, timeout) => {
            const provider = new MockClipboardProvider();
            const manager = new ClipboardManager(provider);

            try {
              const result = await manager.copyToClipboard(data, {
                autoWipe: true,
                wipeTimeout: timeout,
              });

              if (result.success) {
                // Property 1: Data should be in clipboard
                expect(provider.getContent()).toBe(data);

                // Property 2: Should have wipeAt timestamp
                expect(result.wipeAt).toBeDefined();

                // Wait for timeout
                await wait(timeout + 100);

                // Property 3: Data should be cleared
                expect(provider.getContent()).toBe('');
              } else {
                // Property 4: Empty/whitespace-only strings should fail
                expect(data.trim().length).toBe(0);
              }
            } finally {
              manager.destroy();
            }
          }
        ),
        { numRuns: 10 }
      );
    }, 30000);

    test('wipeAt timestamp should be accurate within reasonable margin', async () => {
      await fc.assert(
        fc.asyncProperty(
          clipboardDataArbitrary,
          fc.integer({ min: 100, max: 1000 }),
          async (data, timeout) => {
            const provider = new MockClipboardProvider();
            const manager = new ClipboardManager(provider);

            try {
              const beforeCopy = Date.now();
              
              const result = await manager.copyToClipboard(data, {
                autoWipe: true,
                wipeTimeout: timeout,
              });

              const afterCopy = Date.now();

              // Property: wipeAt should be accurate
              expect(result.wipeAt).toBeDefined();
              
              // Should be at least timeout milliseconds from now
              expect(result.wipeAt).toBeGreaterThanOrEqual(beforeCopy + timeout);
              
              // Should not be more than timeout + execution time
              expect(result.wipeAt).toBeLessThanOrEqual(afterCopy + timeout);

              // Margin of error should be small (< 100ms)
              const margin = result.wipeAt! - (beforeCopy + timeout);
              expect(margin).toBeLessThan(100);
            } finally {
              manager.destroy();
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    test('clipboard should be wiped at the exact timeout moment', async () => {
      await fc.assert(
        fc.asyncProperty(
          clipboardDataArbitrary,
          fc.integer({ min: 200, max: 500 }),
          async (data, timeout) => {
            const provider = new MockClipboardProvider();
            const manager = new ClipboardManager(provider);

            try {
              await manager.copyToClipboard(data, {
                autoWipe: true,
                wipeTimeout: timeout,
              });

              // Property 1: Data should be present before timeout
              await wait(timeout - 50);
              expect(provider.getContent()).toBe(data);

              // Property 2: Data should be cleared after timeout
              await wait(100);
              expect(provider.getContent()).toBe('');
            } finally {
              manager.destroy();
            }
          }
        ),
        { numRuns: 10 }
      );
    }, 30000);

    test('cancelling a timer should prevent auto-wipe', async () => {
      await fc.assert(
        fc.asyncProperty(
          clipboardDataArbitrary,
          fc.integer({ min: 200, max: 500 }),
          async (data, timeout) => {
            const provider = new MockClipboardProvider();
            const manager = new ClipboardManager(provider);

            try {
              await manager.copyToClipboard(data, {
                autoWipe: true,
                wipeTimeout: timeout,
              });

              expect(manager.getPendingWipeCount()).toBe(1);

              // Destroy manager (cancels all timers)
              manager.destroy();

              // Property: Timer should be cancelled
              expect(manager.getPendingWipeCount()).toBe(0);

              // Wait for what would have been the timeout
              await wait(timeout + 100);

              // Property: Data should NOT be wiped
              expect(provider.getContent()).toBe(data);
            } finally {
              // Already destroyed
            }
          }
        ),
        { numRuns: 10 }
      );
    }, 30000);

    test('manual wipeNow should clear clipboard immediately regardless of timeout', async () => {
      await fc.assert(
        fc.asyncProperty(
          clipboardDataArbitrary,
          fc.integer({ min: 500, max: 2000 }),
          async (data, timeout) => {
            const provider = new MockClipboardProvider();
            const manager = new ClipboardManager(provider);

            try {
              await manager.copyToClipboard(data, {
                autoWipe: true,
                wipeTimeout: timeout,
              });

              expect(provider.getContent()).toBe(data);

              // Manually wipe before timeout
              const wipeResult = await manager.wipeNow();

              // Property 1: Wipe should succeed
              expect(wipeResult.success).toBe(true);

              // Property 2: Clipboard should be cleared immediately
              expect(provider.getContent()).toBe('');

              // Property 3: All timers should be cancelled
              expect(manager.getPendingWipeCount()).toBe(0);

              // Wait for original timeout
              await wait(timeout + 100);

              // Property 4: Clipboard should still be empty
              expect(provider.getContent()).toBe('');
            } finally {
              manager.destroy();
            }
          }
        ),
        { numRuns: 10 }
      );
    }, 30000);

    test('copying same data multiple times should reset the timer', async () => {
      await fc.assert(
        fc.asyncProperty(
          clipboardDataArbitrary,
          fc.integer({ min: 200, max: 400 }),
          async (data, timeout) => {
            const provider = new MockClipboardProvider();
            const manager = new ClipboardManager(provider);

            try {
              // First copy
              await manager.copyToClipboard(data, {
                autoWipe: true,
                wipeTimeout: timeout,
              });

              // Wait for half the timeout
              await wait(timeout / 2);

              // Copy same data again (should reset timer)
              await manager.copyToClipboard(data, {
                autoWipe: true,
                wipeTimeout: timeout,
              });

              // Property: Should still have only 1 timer (old one cancelled)
              expect(manager.getPendingWipeCount()).toBe(1);

              // Wait for the original timeout (from first copy)
              await wait(timeout / 2 + 50);

              // Property: Data should STILL be present (timer was reset)
              expect(provider.getContent()).toBe(data);

              // Wait for the new timeout to expire
              await wait(timeout / 2 + 50);

              // Property: Now data should be cleared
              expect(provider.getContent()).toBe('');
            } finally {
              manager.destroy();
            }
          }
        ),
        { numRuns: 10 }
      );
    }, 30000);
  });
});
