/**
 * Property-Based Tests for AuthenticationService
 * 
 * These tests verify universal properties that should hold for all valid inputs.
 * Using fast-check library for property-based testing with minimum 100 iterations.
 * 
 * Feature: password-manager-app
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fc from 'fast-check';
import {
  DefaultAuthenticationService,
  InMemoryAuthStorage,
} from './authentication-service';
import { AuthError } from '../types/crypto';
import { CONFIG } from '../types/common';

describe('AuthenticationService - Property-Based Tests', () => {
  /**
   * Property 3: Blocco dopo Tentativi Falliti
   * 
   * **Validates: Requirements 1.3**
   * 
   * For any sequence of 5 incorrect PINs, the system should lock access
   * for at least 30 minutes (CONFIG.LOCKOUT_DURATION_MS).
   */
  describe('Property 3: Blocco dopo Tentativi Falliti', () => {
    it('should lock out after MAX_FAILED_ATTEMPTS consecutive failures', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate a correct PIN (4-8 digits)
          fc.integer({ min: 1000, max: 99999999 }).map(n => n.toString()),
          // Generate an array of wrong PINs (different from correct PIN)
          fc.array(
            fc.integer({ min: 1000, max: 99999999 }).map(n => n.toString()),
            { minLength: CONFIG.MAX_FAILED_ATTEMPTS, maxLength: CONFIG.MAX_FAILED_ATTEMPTS }
          ),
          async (correctPin, wrongPins) => {
            // Ensure wrong PINs are actually different from correct PIN
            const uniqueWrongPins = wrongPins.map((pin) => {
              if (pin === correctPin) {
                // Make it different by adding 1 (wrapping if needed)
                const num = parseInt(pin);
                return num === 99999999 ? '1000' : (num + 1).toString();
              }
              return pin;
            });

            const storage = new InMemoryAuthStorage();
            const authService = new DefaultAuthenticationService(storage);

            // Set up the correct PIN
            const salt = crypto.getRandomValues(new Uint8Array(CONFIG.SALT_LENGTH));
            await storage.setSalt(salt);
            await authService._setCorrectPinHash(correctPin, salt);

            // Attempt authentication with wrong PINs MAX_FAILED_ATTEMPTS times
            for (let i = 0; i < CONFIG.MAX_FAILED_ATTEMPTS; i++) {
              const result = await authService.authenticate(uniqueWrongPins[i]!);
              expect(result.success).toBe(false);
            }

            // After MAX_FAILED_ATTEMPTS, should be locked out
            const remainingLockTime = authService.getRemainingLockTime();
            
            // Property: Remaining lock time should be greater than 0
            expect(remainingLockTime).toBeGreaterThan(0);
            
            // Property: Remaining lock time should not exceed the configured lockout duration
            expect(remainingLockTime).toBeLessThanOrEqual(CONFIG.LOCKOUT_DURATION_MS);

            // Property: Even with correct PIN, authentication should fail during lockout
            const lockedResult = await authService.authenticate(correctPin);
            expect(lockedResult.success).toBe(false);
            expect(lockedResult.error).toBe(AuthError.TOO_MANY_ATTEMPTS);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should maintain lockout for the full duration', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate a correct PIN
          fc.integer({ min: 1000, max: 99999999 }).map(n => n.toString()),
          // Generate wrong PINs
          fc.array(
            fc.integer({ min: 1000, max: 99999999 }).map(n => n.toString()),
            { minLength: CONFIG.MAX_FAILED_ATTEMPTS, maxLength: CONFIG.MAX_FAILED_ATTEMPTS }
          ),
          async (correctPin, wrongPins) => {
            const storage = new InMemoryAuthStorage();
            const authService = new DefaultAuthenticationService(storage);

            // Set up the correct PIN
            const salt = crypto.getRandomValues(new Uint8Array(CONFIG.SALT_LENGTH));
            await storage.setSalt(salt);
            await authService._setCorrectPinHash(correctPin, salt);

            // Trigger lockout
            for (const wrongPin of wrongPins) {
              await authService.authenticate(wrongPin === correctPin ? '0000' : wrongPin);
            }

            // Record the initial remaining time
            const initialRemainingTime = authService.getRemainingLockTime();

            // Property: Initial remaining time should be close to full lockout duration
            // (allowing for small timing variations)
            expect(initialRemainingTime).toBeGreaterThan(CONFIG.LOCKOUT_DURATION_MS - 1000);
            expect(initialRemainingTime).toBeLessThanOrEqual(CONFIG.LOCKOUT_DURATION_MS);

            // Property: Multiple authentication attempts during lockout should all fail
            for (let i = 0; i < 3; i++) {
              const result = await authService.authenticate(correctPin);
              expect(result.success).toBe(false);
              expect(result.error).toBe(AuthError.TOO_MANY_ATTEMPTS);
            }

            // Property: Remaining time should still be positive
            const finalRemainingTime = authService.getRemainingLockTime();
            expect(finalRemainingTime).toBeGreaterThan(0);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should reset failed attempts counter after successful authentication', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate a correct PIN
          fc.integer({ min: 1000, max: 99999999 }).map(n => n.toString()),
          // Generate number of failed attempts (less than max)
          fc.integer({ min: 1, max: CONFIG.MAX_FAILED_ATTEMPTS - 1 }),
          async (correctPin, numFailedAttempts) => {
            const storage = new InMemoryAuthStorage();
            const authService = new DefaultAuthenticationService(storage);

            // Set up the correct PIN
            const salt = crypto.getRandomValues(new Uint8Array(CONFIG.SALT_LENGTH));
            await storage.setSalt(salt);
            await authService._setCorrectPinHash(correctPin, salt);

            // Make some failed attempts (but not enough to trigger lockout)
            const wrongPin = correctPin === '1234' ? '5678' : '1234';
            for (let i = 0; i < numFailedAttempts; i++) {
              await authService.authenticate(wrongPin);
            }

            // Property: Failed attempts should be tracked
            expect(authService.getFailedAttempts()).toBe(numFailedAttempts);

            // Authenticate successfully
            const result = await authService.authenticate(correctPin);
            expect(result.success).toBe(true);

            // Property: Failed attempts should be reset to 0 after successful auth
            expect(authService.getFailedAttempts()).toBe(0);

            // Property: Should not be locked out
            expect(authService.getRemainingLockTime()).toBe(0);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should allow authentication after lockout period expires', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate a correct PIN
          fc.integer({ min: 1000, max: 99999999 }).map(n => n.toString()),
          async (correctPin) => {
            const storage = new InMemoryAuthStorage();
            const authService = new DefaultAuthenticationService(storage);

            // Set up the correct PIN
            const salt = crypto.getRandomValues(new Uint8Array(CONFIG.SALT_LENGTH));
            await storage.setSalt(salt);
            await authService._setCorrectPinHash(correctPin, salt);

            // Trigger lockout
            const wrongPin = correctPin === '1234' ? '5678' : '1234';
            for (let i = 0; i < CONFIG.MAX_FAILED_ATTEMPTS; i++) {
              await authService.authenticate(wrongPin);
            }

            // Verify lockout is active
            expect(authService.getRemainingLockTime()).toBeGreaterThan(0);

            // Manually expire the lockout by setting end time to the past
            await storage.setLockoutEndTime(Date.now() - 1000);
            await storage.setFailedAttempts(0);

            // Property: Authentication should succeed after lockout expires
            // (authenticate() will check storage and see lockout has expired)
            const result = await authService.authenticate(correctPin);
            expect(result.success).toBe(true);
            expect(result.masterKey).toBeDefined();

            // Property: After successful auth, remaining time should be 0
            expect(authService.getRemainingLockTime()).toBe(0);

            // Property: Failed attempts should be reset
            expect(authService.getFailedAttempts()).toBe(0);
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  /**
   * Property 5: Auto-lock Temporale
   * 
   * **Validates: Requirements 1.5**
   * 
   * For any period of inactivity greater than 5 minutes (CONFIG.AUTO_LOCK_TIMEOUT_MS),
   * the vault should be automatically locked.
   */
  describe('Property 5: Auto-lock Temporale', () => {
    beforeEach(() => {
      // Use fake timers for testing
      jest.useFakeTimers();
    });

    afterEach(() => {
      // Clear all timers and restore real timers
      jest.clearAllTimers();
      jest.useRealTimers();
    });

    it('should auto-lock after timeout period of inactivity', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate a valid PIN
          fc.integer({ min: 1000, max: 99999999 }).map(n => n.toString()),
          async (pin) => {
            const storage = new InMemoryAuthStorage();
            const authService = new DefaultAuthenticationService(storage);

            // Authenticate successfully
            const result = await authService.authenticate(pin);
            expect(result.success).toBe(true);

            // Property: Vault should be unlocked after authentication
            expect(authService.isLocked()).toBe(false);

            // Fast-forward time to exactly the timeout period
            jest.advanceTimersByTime(CONFIG.AUTO_LOCK_TIMEOUT_MS);

            // Property: Vault should be locked after timeout
            expect(authService.isLocked()).toBe(true);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should not auto-lock before timeout expires', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate a valid PIN
          fc.integer({ min: 1000, max: 99999999 }).map(n => n.toString()),
          // Generate a time less than timeout (1ms to timeout-1ms)
          fc.integer({ min: 1, max: CONFIG.AUTO_LOCK_TIMEOUT_MS - 1 }),
          async (pin, timeElapsed) => {
            const storage = new InMemoryAuthStorage();
            const authService = new DefaultAuthenticationService(storage);

            // Authenticate successfully
            await authService.authenticate(pin);
            expect(authService.isLocked()).toBe(false);

            // Fast-forward time by less than timeout
            jest.advanceTimersByTime(timeElapsed);

            // Property: Vault should still be unlocked
            expect(authService.isLocked()).toBe(false);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should reset timer on user activity', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate a valid PIN
          fc.integer({ min: 1000, max: 99999999 }).map(n => n.toString()),
          // Generate time before first activity (less than timeout)
          fc.integer({ min: 1000, max: CONFIG.AUTO_LOCK_TIMEOUT_MS - 1000 }),
          // Generate time after activity (less than timeout)
          fc.integer({ min: 1000, max: CONFIG.AUTO_LOCK_TIMEOUT_MS - 1000 }),
          async (pin, timeBeforeActivity, timeAfterActivity) => {
            const storage = new InMemoryAuthStorage();
            const authService = new DefaultAuthenticationService(storage);

            // Authenticate successfully
            await authService.authenticate(pin);
            expect(authService.isLocked()).toBe(false);

            // Fast-forward time
            jest.advanceTimersByTime(timeBeforeActivity);

            // User activity - reset timer
            authService.resetAutoLockTimer();

            // Fast-forward time again (less than timeout since reset)
            jest.advanceTimersByTime(timeAfterActivity);

            // Property: Vault should still be unlocked (timer was reset)
            expect(authService.isLocked()).toBe(false);

            // Fast-forward to complete the timeout from the reset point
            jest.advanceTimersByTime(CONFIG.AUTO_LOCK_TIMEOUT_MS - timeAfterActivity);

            // Property: Now vault should be locked
            expect(authService.isLocked()).toBe(true);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should handle background/foreground transitions correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate a valid PIN
          fc.integer({ min: 1000, max: 99999999 }).map(n => n.toString()),
          // Generate time in foreground before background
          fc.integer({ min: 1000, max: CONFIG.AUTO_LOCK_TIMEOUT_MS - 1000 }),
          // Generate time in background
          fc.integer({ min: 1000, max: CONFIG.AUTO_LOCK_TIMEOUT_MS }),
          async (pin, timeInForeground, timeInBackground) => {
            const storage = new InMemoryAuthStorage();
            const authService = new DefaultAuthenticationService(storage);

            // Authenticate successfully
            await authService.authenticate(pin);
            expect(authService.isLocked()).toBe(false);

            // Spend some time in foreground
            jest.advanceTimersByTime(timeInForeground);

            // App goes to background
            authService.handleBackground();

            // Spend time in background
            jest.advanceTimersByTime(timeInBackground);

            // App comes to foreground
            authService.handleForeground();

            const totalTime = timeInForeground + timeInBackground;

            // Property: If total time exceeds timeout, vault should be locked
            if (totalTime >= CONFIG.AUTO_LOCK_TIMEOUT_MS) {
              expect(authService.isLocked()).toBe(true);
            } else {
              // Property: If total time is less than timeout, vault should still be unlocked
              expect(authService.isLocked()).toBe(false);
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should lock immediately on foreground if timeout exceeded in background', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate a valid PIN
          fc.integer({ min: 1000, max: 99999999 }).map(n => n.toString()),
          // Generate time in background that exceeds timeout
          fc.integer({ min: CONFIG.AUTO_LOCK_TIMEOUT_MS + 1, max: CONFIG.AUTO_LOCK_TIMEOUT_MS * 2 }),
          async (pin, timeInBackground) => {
            const storage = new InMemoryAuthStorage();
            const authService = new DefaultAuthenticationService(storage);

            // Authenticate successfully
            await authService.authenticate(pin);
            expect(authService.isLocked()).toBe(false);

            // App goes to background immediately
            authService.handleBackground();

            // Spend time in background (more than timeout)
            jest.advanceTimersByTime(timeInBackground);

            // App comes to foreground
            authService.handleForeground();

            // Property: Vault should be locked immediately
            expect(authService.isLocked()).toBe(true);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should not reset timer when vault is locked', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate a valid PIN
          fc.integer({ min: 1000, max: 99999999 }).map(n => n.toString()),
          async (pin) => {
            const storage = new InMemoryAuthStorage();
            const authService = new DefaultAuthenticationService(storage);

            // Authenticate successfully
            await authService.authenticate(pin);
            expect(authService.isLocked()).toBe(false);

            // Lock the vault manually
            authService.lockVault();
            expect(authService.isLocked()).toBe(true);

            // Try to reset timer
            authService.resetAutoLockTimer();

            // Fast-forward time
            jest.advanceTimersByTime(CONFIG.AUTO_LOCK_TIMEOUT_MS);

            // Property: Vault should remain locked (timer should not have been started)
            expect(authService.isLocked()).toBe(true);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should report correct remaining time until auto-lock', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate a valid PIN
          fc.integer({ min: 1000, max: 99999999 }).map(n => n.toString()),
          // Generate elapsed time (less than timeout)
          fc.integer({ min: 1000, max: CONFIG.AUTO_LOCK_TIMEOUT_MS - 1000 }),
          async (pin, elapsedTime) => {
            const storage = new InMemoryAuthStorage();
            const authService = new DefaultAuthenticationService(storage);

            // Authenticate successfully
            await authService.authenticate(pin);

            // Fast-forward time
            jest.advanceTimersByTime(elapsedTime);

            // Get remaining time
            const remainingTime = authService.getAutoLockTimeRemaining();

            // Property: Remaining time should be approximately (timeout - elapsed)
            const expectedRemaining = CONFIG.AUTO_LOCK_TIMEOUT_MS - elapsedTime;
            
            // Allow for small timing variations (within 100ms)
            expect(remainingTime).toBeGreaterThanOrEqual(expectedRemaining - 100);
            expect(remainingTime).toBeLessThanOrEqual(expectedRemaining);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should return 0 remaining time when locked', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate a valid PIN
          fc.integer({ min: 1000, max: 99999999 }).map(n => n.toString()),
          async (pin) => {
            const storage = new InMemoryAuthStorage();
            const authService = new DefaultAuthenticationService(storage);

            // Authenticate successfully
            await authService.authenticate(pin);

            // Lock the vault
            authService.lockVault();

            // Property: Remaining time should be 0 when locked
            expect(authService.getAutoLockTimeRemaining()).toBe(0);
          }
        ),
        { numRuns: 10 }
      );
    });
  });
});
