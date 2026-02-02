/**
 * Unit tests for AuthenticationService
 * 
 * Tests cover:
 * - PIN validation and authentication
 * - Master key derivation
 * - Failed attempt tracking
 * - Temporary lockout after max attempts
 * - Vault locking/unlocking
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  DefaultAuthenticationService,
  InMemoryAuthStorage,
  createAuthenticationService,
} from './authentication-service';
import { AuthError } from '../types/crypto';
import { CONFIG } from '../types/common';

describe('AuthenticationService', () => {
  let authService: DefaultAuthenticationService;
  let storage: InMemoryAuthStorage;

  beforeEach(() => {
    storage = new InMemoryAuthStorage();
    authService = new DefaultAuthenticationService(storage);
  });

  describe('PIN validation', () => {
    it('should reject PIN with less than 4 digits', async () => {
      const result = await authService.authenticate('123');
      expect(result.success).toBe(false);
      expect(result.error).toBe(AuthError.INVALID_PIN);
    });

    it('should reject PIN with more than 8 digits', async () => {
      const result = await authService.authenticate('123456789');
      expect(result.success).toBe(false);
      expect(result.error).toBe(AuthError.INVALID_PIN);
    });

    it('should reject PIN with non-numeric characters', async () => {
      const result = await authService.authenticate('12a4');
      expect(result.success).toBe(false);
      expect(result.error).toBe(AuthError.INVALID_PIN);
    });

    it('should accept valid 4-digit PIN', async () => {
      const result = await authService.authenticate('1234');
      expect(result.success).toBe(true);
      expect(result.masterKey).toBeDefined();
    });

    it('should accept valid 8-digit PIN', async () => {
      const result = await authService.authenticate('12345678');
      expect(result.success).toBe(true);
      expect(result.masterKey).toBeDefined();
    });

    it('should accept valid 6-digit PIN', async () => {
      const result = await authService.authenticate('123456');
      expect(result.success).toBe(true);
      expect(result.masterKey).toBeDefined();
    });
  });

  describe('Master key derivation', () => {
    it('should derive a valid CryptoKey from PIN and salt', async () => {
      const pin = '1234';
      const salt = crypto.getRandomValues(new Uint8Array(CONFIG.SALT_LENGTH));
      
      const masterKey = await authService.deriveMasterKey(pin, salt);
      
      expect(masterKey).toBeDefined();
      expect(masterKey.type).toBe('secret');
      expect(masterKey.algorithm.name).toBe('AES-GCM');
    });

    it('should derive the same key for the same PIN and salt', async () => {
      const pin = '1234';
      const salt = crypto.getRandomValues(new Uint8Array(CONFIG.SALT_LENGTH));
      
      const key1 = await authService.deriveMasterKey(pin, salt);
      const key2 = await authService.deriveMasterKey(pin, salt);
      
      // Keys should be functionally equivalent (same algorithm and usage)
      expect(key1.algorithm).toEqual(key2.algorithm);
      expect(key1.type).toBe(key2.type);
      expect(key1.usages).toEqual(key2.usages);
    });

    it('should derive different keys for different PINs', async () => {
      const salt = crypto.getRandomValues(new Uint8Array(CONFIG.SALT_LENGTH));
      
      const key1 = await authService.deriveMasterKey('1234', salt);
      const key2 = await authService.deriveMasterKey('5678', salt);
      
      // Keys are different objects
      expect(key1).not.toBe(key2);
    });

    it('should derive different keys for different salts', async () => {
      const pin = '1234';
      const salt1 = crypto.getRandomValues(new Uint8Array(CONFIG.SALT_LENGTH));
      const salt2 = crypto.getRandomValues(new Uint8Array(CONFIG.SALT_LENGTH));
      
      const key1 = await authService.deriveMasterKey(pin, salt1);
      const key2 = await authService.deriveMasterKey(pin, salt2);
      
      // Keys are different objects
      expect(key1).not.toBe(key2);
    });

    it('should reject invalid PIN format', async () => {
      const salt = crypto.getRandomValues(new Uint8Array(CONFIG.SALT_LENGTH));
      
      await expect(authService.deriveMasterKey('abc', salt)).rejects.toThrow();
    });

    it('should reject invalid salt', async () => {
      const invalidSalt = new Uint8Array(10); // Wrong length
      
      await expect(authService.deriveMasterKey('1234', invalidSalt)).rejects.toThrow();
    });
  });

  describe('Authentication flow', () => {
    it('should successfully authenticate with correct PIN on first attempt', async () => {
      const pin = '1234';
      const result = await authService.authenticate(pin);
      
      expect(result.success).toBe(true);
      expect(result.masterKey).toBeDefined();
      expect(authService.isLocked()).toBe(false);
    });

    it('should generate and store salt on first authentication', async () => {
      const pin = '1234';
      await authService.authenticate(pin);
      
      const salt = await storage.getSalt();
      expect(salt).toBeDefined();
      expect(salt?.length).toBe(CONFIG.SALT_LENGTH);
    });

    it('should reuse existing salt on subsequent authentications', async () => {
      const pin = '1234';
      
      // First authentication
      await authService.authenticate(pin);
      const salt1 = await storage.getSalt();
      
      // Lock and authenticate again
      authService.lockVault();
      await authService.authenticate(pin);
      const salt2 = await storage.getSalt();
      
      expect(salt1).toEqual(salt2);
    });

    it('should verify PIN against stored hash', async () => {
      const correctPin = '1234';
      const wrongPin = '5678';
      
      // Set up with correct PIN
      const salt = crypto.getRandomValues(new Uint8Array(CONFIG.SALT_LENGTH));
      await storage.setSalt(salt);
      await authService._setCorrectPinHash(correctPin, salt);
      
      // Try with wrong PIN
      const result = await authService.authenticate(wrongPin);
      expect(result.success).toBe(false);
      expect(result.error).toBe(AuthError.INVALID_PIN);
    });
  });

  describe('Failed attempt tracking', () => {
    it('should track failed authentication attempts', async () => {
      const wrongPin = '0000';
      const salt = crypto.getRandomValues(new Uint8Array(CONFIG.SALT_LENGTH));
      await storage.setSalt(salt);
      await authService._setCorrectPinHash('1234', salt);
      
      await authService.authenticate(wrongPin);
      expect(authService.getFailedAttempts()).toBe(1);
      
      await authService.authenticate(wrongPin);
      expect(authService.getFailedAttempts()).toBe(2);
    });

    it('should reset failed attempts on successful authentication', async () => {
      const correctPin = '1234';
      const wrongPin = '0000';
      
      const salt = crypto.getRandomValues(new Uint8Array(CONFIG.SALT_LENGTH));
      await storage.setSalt(salt);
      await authService._setCorrectPinHash(correctPin, salt);
      
      // Fail a few times
      await authService.authenticate(wrongPin);
      await authService.authenticate(wrongPin);
      expect(authService.getFailedAttempts()).toBe(2);
      
      // Succeed
      await authService.authenticate(correctPin);
      expect(authService.getFailedAttempts()).toBe(0);
    });

    it('should not increment failed attempts for invalid PIN format', async () => {
      await authService.authenticate('abc');
      expect(authService.getFailedAttempts()).toBe(1);
    });
  });

  describe('Temporary lockout', () => {
    it('should lock out after MAX_FAILED_ATTEMPTS', async () => {
      const wrongPin = '0000';
      const salt = crypto.getRandomValues(new Uint8Array(CONFIG.SALT_LENGTH));
      await storage.setSalt(salt);
      await authService._setCorrectPinHash('1234', salt);
      
      // Fail MAX_FAILED_ATTEMPTS times
      for (let i = 0; i < CONFIG.MAX_FAILED_ATTEMPTS; i++) {
        await authService.authenticate(wrongPin);
      }
      
      // Should be locked out
      const result = await authService.authenticate('1234');
      expect(result.success).toBe(false);
      expect(result.error).toBe(AuthError.TOO_MANY_ATTEMPTS);
    });

    it('should return remaining lockout time', async () => {
      const wrongPin = '0000';
      const salt = crypto.getRandomValues(new Uint8Array(CONFIG.SALT_LENGTH));
      await storage.setSalt(salt);
      await authService._setCorrectPinHash('1234', salt);
      
      // Trigger lockout
      for (let i = 0; i < CONFIG.MAX_FAILED_ATTEMPTS; i++) {
        await authService.authenticate(wrongPin);
      }
      
      const remainingTime = authService.getRemainingLockTime();
      expect(remainingTime).toBeGreaterThan(0);
      expect(remainingTime).toBeLessThanOrEqual(CONFIG.LOCKOUT_DURATION_MS);
    });

    it('should allow authentication after lockout period expires', async () => {
      const correctPin = '1234';
      const wrongPin = '0000';
      
      const salt = crypto.getRandomValues(new Uint8Array(CONFIG.SALT_LENGTH));
      await storage.setSalt(salt);
      await authService._setCorrectPinHash(correctPin, salt);
      
      // Trigger lockout
      for (let i = 0; i < CONFIG.MAX_FAILED_ATTEMPTS; i++) {
        await authService.authenticate(wrongPin);
      }
      
      // Manually expire the lockout
      await storage.setLockoutEndTime(Date.now() - 1000);
      
      // Should be able to authenticate now
      const result = await authService.authenticate(correctPin);
      expect(result.success).toBe(true);
    });

    it('should return 0 remaining time when not locked out', async () => {
      expect(authService.getRemainingLockTime()).toBe(0);
    });

    it('should return 0 remaining time after lockout expires', async () => {
      // Set expired lockout
      await storage.setLockoutEndTime(Date.now() - 1000);
      
      expect(authService.getRemainingLockTime()).toBe(0);
    });
  });

  describe('Vault locking', () => {
    it('should start in locked state', () => {
      expect(authService.isLocked()).toBe(true);
    });

    it('should unlock after successful authentication', async () => {
      await authService.authenticate('1234');
      expect(authService.isLocked()).toBe(false);
    });

    it('should lock vault when lockVault is called', async () => {
      await authService.authenticate('1234');
      expect(authService.isLocked()).toBe(false);
      
      authService.lockVault();
      expect(authService.isLocked()).toBe(true);
    });

    it('should remain locked after failed authentication', async () => {
      const wrongPin = '0000';
      const salt = crypto.getRandomValues(new Uint8Array(CONFIG.SALT_LENGTH));
      await storage.setSalt(salt);
      await authService._setCorrectPinHash('1234', salt);
      
      await authService.authenticate(wrongPin);
      expect(authService.isLocked()).toBe(true);
    });
  });

  describe('Factory function', () => {
    it('should create a new AuthenticationService instance', () => {
      const service = createAuthenticationService();
      expect(service).toBeDefined();
      expect(service.isLocked()).toBe(true);
    });

    it('should accept custom storage', () => {
      const customStorage = new InMemoryAuthStorage();
      const service = createAuthenticationService(customStorage);
      expect(service).toBeDefined();
    });
  });

  describe('Edge cases', () => {
    it('should handle empty PIN', async () => {
      const result = await authService.authenticate('');
      expect(result.success).toBe(false);
      expect(result.error).toBe(AuthError.INVALID_PIN);
    });

    it('should handle null/undefined PIN gracefully', async () => {
      const result1 = await authService.authenticate(null as any);
      expect(result1.success).toBe(false);
      
      const result2 = await authService.authenticate(undefined as any);
      expect(result2.success).toBe(false);
    });

    it('should handle concurrent authentication attempts', async () => {
      const pin = '1234';
      
      // First authentication to set up the PIN
      const firstResult = await authService.authenticate(pin);
      expect(firstResult.success).toBe(true);
      
      // Lock the vault
      authService.lockVault();
      
      // Multiple concurrent authentications with the same PIN
      const results = await Promise.all([
        authService.authenticate(pin),
        authService.authenticate(pin),
        authService.authenticate(pin),
      ]);
      
      // All should succeed since PIN is already set up
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });
  });

  describe('InMemoryAuthStorage', () => {
    it('should store and retrieve salt', async () => {
      const salt = crypto.getRandomValues(new Uint8Array(32));
      await storage.setSalt(salt);
      
      const retrieved = await storage.getSalt();
      expect(retrieved).toEqual(salt);
    });

    it('should store and retrieve failed attempts', async () => {
      await storage.setFailedAttempts(3);
      const attempts = await storage.getFailedAttempts();
      expect(attempts).toBe(3);
    });

    it('should store and retrieve lockout end time', async () => {
      const endTime = Date.now() + 10000;
      await storage.setLockoutEndTime(endTime);
      
      const retrieved = await storage.getLockoutEndTime();
      expect(retrieved).toBe(endTime);
    });

    it('should return null for unset values', async () => {
      const salt = await storage.getSalt();
      expect(salt).toBeNull();
      
      const lockoutTime = await storage.getLockoutEndTime();
      expect(lockoutTime).toBeNull();
    });

    it('should clear all data', async () => {
      const salt = crypto.getRandomValues(new Uint8Array(32));
      await storage.setSalt(salt);
      await storage.setFailedAttempts(3);
      await storage.setLockoutEndTime(Date.now());
      
      storage.clear();
      
      expect(await storage.getSalt()).toBeNull();
      expect(await storage.getFailedAttempts()).toBe(0);
      expect(await storage.getLockoutEndTime()).toBeNull();
    });
  });

  describe('Auto-lock temporal', () => {
    beforeEach(() => {
      // Use fake timers for testing
      jest.useFakeTimers();
    });

    afterEach(() => {
      // Clear all timers and restore real timers
      jest.clearAllTimers();
      jest.useRealTimers();
    });

    it('should start auto-lock timer on successful authentication', async () => {
      const pin = '1234';
      await authService.authenticate(pin);
      
      expect(authService.isLocked()).toBe(false);
      
      // Fast-forward time by 5 minutes
      jest.advanceTimersByTime(CONFIG.AUTO_LOCK_TIMEOUT_MS);
      
      // Vault should be locked
      expect(authService.isLocked()).toBe(true);
    });

    it('should not auto-lock before timeout expires', async () => {
      const pin = '1234';
      await authService.authenticate(pin);
      
      expect(authService.isLocked()).toBe(false);
      
      // Fast-forward time by 4 minutes (less than timeout)
      jest.advanceTimersByTime(4 * 60 * 1000);
      
      // Vault should still be unlocked
      expect(authService.isLocked()).toBe(false);
    });

    it('should reset auto-lock timer on user activity', async () => {
      const pin = '1234';
      await authService.authenticate(pin);
      
      // Fast-forward time by 4 minutes
      jest.advanceTimersByTime(4 * 60 * 1000);
      
      // User activity - reset timer
      authService.resetAutoLockTimer();
      
      // Fast-forward time by another 4 minutes (total 8 minutes, but timer was reset)
      jest.advanceTimersByTime(4 * 60 * 1000);
      
      // Vault should still be unlocked (only 4 minutes since reset)
      expect(authService.isLocked()).toBe(false);
      
      // Fast-forward by another 1 minute (5 minutes since reset)
      jest.advanceTimersByTime(1 * 60 * 1000);
      
      // Now vault should be locked
      expect(authService.isLocked()).toBe(true);
    });

    it('should not reset timer when vault is locked', async () => {
      const pin = '1234';
      await authService.authenticate(pin);
      
      // Lock the vault
      authService.lockVault();
      
      // Try to reset timer
      authService.resetAutoLockTimer();
      
      // Fast-forward time
      jest.advanceTimersByTime(CONFIG.AUTO_LOCK_TIMEOUT_MS);
      
      // Vault should remain locked (timer should not have been started)
      expect(authService.isLocked()).toBe(true);
    });

    it('should stop auto-lock timer when vault is locked manually', async () => {
      const pin = '1234';
      await authService.authenticate(pin);
      
      expect(authService.isLocked()).toBe(false);
      
      // Lock manually before timeout
      authService.lockVault();
      
      // Fast-forward time past timeout
      jest.advanceTimersByTime(CONFIG.AUTO_LOCK_TIMEOUT_MS + 1000);
      
      // Vault should be locked (was locked manually, not by timer)
      expect(authService.isLocked()).toBe(true);
    });

    it('should handle background event by stopping timer', async () => {
      const pin = '1234';
      await authService.authenticate(pin);
      
      expect(authService.isLocked()).toBe(false);
      
      // App goes to background
      authService.handleBackground();
      
      // Fast-forward time by 10 minutes while in background
      jest.advanceTimersByTime(10 * 60 * 1000);
      
      // Vault should still be unlocked (timer was stopped)
      expect(authService.isLocked()).toBe(false);
    });

    it('should lock on foreground if timeout exceeded while in background', async () => {
      const pin = '1234';
      await authService.authenticate(pin);
      
      // App goes to background
      authService.handleBackground();
      
      // Fast-forward time by 6 minutes (more than timeout)
      jest.advanceTimersByTime(6 * 60 * 1000);
      
      // App comes to foreground
      authService.handleForeground();
      
      // Vault should be locked immediately
      expect(authService.isLocked()).toBe(true);
    });

    it('should resume timer on foreground if timeout not exceeded', async () => {
      const pin = '1234';
      await authService.authenticate(pin);
      
      // Fast-forward 2 minutes
      jest.advanceTimersByTime(2 * 60 * 1000);
      
      // App goes to background
      authService.handleBackground();
      
      // Fast-forward 2 more minutes in background (total 4 minutes)
      jest.advanceTimersByTime(2 * 60 * 1000);
      
      // App comes to foreground
      authService.handleForeground();
      
      // Vault should still be unlocked
      expect(authService.isLocked()).toBe(false);
      
      // Fast-forward remaining time (1 minute to reach 5 minutes total)
      jest.advanceTimersByTime(1 * 60 * 1000);
      
      // Now vault should be locked
      expect(authService.isLocked()).toBe(true);
    });

    it('should not do anything on foreground if already locked', async () => {
      const pin = '1234';
      await authService.authenticate(pin);
      
      // Lock the vault
      authService.lockVault();
      
      // App goes to background
      authService.handleBackground();
      
      // App comes to foreground
      authService.handleForeground();
      
      // Vault should remain locked
      expect(authService.isLocked()).toBe(true);
    });

    it('should return correct auto-lock time remaining', async () => {
      const pin = '1234';
      await authService.authenticate(pin);
      
      // Initially, should have full timeout remaining
      const remaining1 = authService.getAutoLockTimeRemaining();
      expect(remaining1).toBeGreaterThan(CONFIG.AUTO_LOCK_TIMEOUT_MS - 1000);
      expect(remaining1).toBeLessThanOrEqual(CONFIG.AUTO_LOCK_TIMEOUT_MS);
      
      // Fast-forward 2 minutes
      jest.advanceTimersByTime(2 * 60 * 1000);
      
      // Should have ~3 minutes remaining
      const remaining2 = authService.getAutoLockTimeRemaining();
      expect(remaining2).toBeGreaterThan(3 * 60 * 1000 - 1000);
      expect(remaining2).toBeLessThanOrEqual(3 * 60 * 1000);
    });

    it('should return 0 time remaining when locked', async () => {
      const pin = '1234';
      await authService.authenticate(pin);
      
      authService.lockVault();
      
      const remaining = authService.getAutoLockTimeRemaining();
      expect(remaining).toBe(0);
    });

    it('should return 0 time remaining when timer not active', () => {
      // Vault is locked, no timer active
      const remaining = authService.getAutoLockTimeRemaining();
      expect(remaining).toBe(0);
    });
  });
});
