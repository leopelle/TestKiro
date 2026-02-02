/**
 * Tests for cryptographic utilities
 */

import * as fc from 'fast-check';
import {
  generateSalt,
  generateIV,
  deriveKeyFromPassword,
  encryptData,
  decryptData,
  validateCryptoKey,
  stringToBytes,
  bytesToString,
  validatePIN,
  generateRandomPIN,
} from './crypto-utils';
import { CONFIG } from '../types/common';
import { PROPERTY_TEST_CONFIG } from '../test-setup';

describe('Crypto Utils', () => {
  describe('generateSalt', () => {
    it('should generate salt of default length', () => {
      const salt = generateSalt();
      expect(salt.length).toBe(CONFIG.SALT_LENGTH);
      expect(salt).toBeInstanceOf(Uint8Array);
    });

    it('should generate salt of specified length', () => {
      const length = 16;
      const salt = generateSalt(length);
      expect(salt.length).toBe(length);
    });

    it('should throw error for invalid length', () => {
      expect(() => generateSalt(0)).toThrow('Salt length must be positive');
      expect(() => generateSalt(-1)).toThrow('Salt length must be positive');
    });

    // Property-based test
    it('should generate different salts on each call', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 64 }), (length) => {
          const salt1 = generateSalt(length);
          const salt2 = generateSalt(length);
          
          expect(salt1.length).toBe(length);
          expect(salt2.length).toBe(length);
          
          // Very unlikely that two random salts are identical
          if (length > 1) {
            expect(salt1).not.toEqual(salt2);
          }
        }),
        { numRuns: 50 } // Reduced for performance
      );
    });
  });

  describe('generateIV', () => {
    it('should generate IV of default length', () => {
      const iv = generateIV();
      expect(iv.length).toBe(CONFIG.IV_LENGTH);
      expect(iv).toBeInstanceOf(Uint8Array);
    });

    it('should generate IV of specified length', () => {
      const length = 16;
      const iv = generateIV(length);
      expect(iv.length).toBe(length);
    });

    it('should throw error for invalid length', () => {
      expect(() => generateIV(0)).toThrow('IV length must be positive');
      expect(() => generateIV(-1)).toThrow('IV length must be positive');
    });
  });

  describe('deriveKeyFromPassword', () => {
    it('should derive a valid CryptoKey from password', async () => {
      const password = 'test-password-123';
      const salt = generateSalt();
      
      const key = await deriveKeyFromPassword(password, salt);
      
      expect(key).toBeInstanceOf(CryptoKey);
      expect(validateCryptoKey(key)).toBe(true);
    });

    it('should derive different keys for different passwords', async () => {
      const salt = generateSalt();
      const key1 = await deriveKeyFromPassword('password1', salt);
      const key2 = await deriveKeyFromPassword('password2', salt);
      
      // Keys should be different (we can't directly compare CryptoKey objects,
      // but we can test by encrypting the same data and expecting different results)
      const testData = stringToBytes('test data');
      const encrypted1 = await encryptData(testData, key1);
      const encrypted2 = await encryptData(testData, key2);
      
      expect(encrypted1.ciphertext).not.toEqual(encrypted2.ciphertext);
    });

    it('should derive same key for same password and salt', async () => {
      const password = 'consistent-password';
      const salt = generateSalt();
      
      const key1 = await deriveKeyFromPassword(password, salt);
      const key2 = await deriveKeyFromPassword(password, salt);
      
      // Test consistency by encrypting same data with both keys
      const testData = stringToBytes('test data');
      const iv = generateIV();
      
      const encrypted1 = await encryptData(testData, key1, iv);
      const encrypted2 = await encryptData(testData, key2, iv);
      
      expect(encrypted1.ciphertext).toEqual(encrypted2.ciphertext);
    });

    // Property-based test for key derivation consistency
    it('should consistently derive same key for same inputs', () => {
      fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.uint8Array({ minLength: 16, maxLength: 64 }),
          async (password, salt) => {
            const key1 = await deriveKeyFromPassword(password, salt);
            const key2 = await deriveKeyFromPassword(password, salt);
            
            expect(validateCryptoKey(key1)).toBe(true);
            expect(validateCryptoKey(key2)).toBe(true);
            
            // Test consistency through encryption
            const testData = stringToBytes('consistency test');
            const iv = generateIV();
            
            const encrypted1 = await encryptData(testData, key1, iv);
            const encrypted2 = await encryptData(testData, key2, iv);
            
            expect(encrypted1.ciphertext).toEqual(encrypted2.ciphertext);
          }
        ),
        { numRuns: 20 } // Reduced for performance due to async operations
      );
    });

    /**
     * Property 2: Generazione Chiavi Sicure
     * 
     * For any valid PIN (4-8 digits), the system should always generate a valid
     * AES-256 key using PBKDF2.
     * 
     * **Validates: Requirements 1.1**
     * 
     * Feature: password-manager-app, Property 2: Generazione Chiavi Sicure
     */
    it('Property 2: Generazione Chiavi Sicure - should generate valid AES-256 keys for any valid PIN', () => {
      fc.assert(
        fc.asyncProperty(
          // Generate valid PINs (4-8 digits)
          fc.integer({ min: CONFIG.PIN_MIN_LENGTH, max: CONFIG.PIN_MAX_LENGTH }).chain(length =>
            fc.tuple(
              fc.constant(length),
              fc.array(fc.integer({ min: 0, max: 9 }), { minLength: length, maxLength: length })
            )
          ),
          async ([length, digits]) => {
            // Create PIN from digits
            const pin = digits.join('');
            
            // Validate PIN format
            expect(validatePIN(pin)).toBe(true);
            expect(pin.length).toBe(length);
            expect(pin.length).toBeGreaterThanOrEqual(CONFIG.PIN_MIN_LENGTH);
            expect(pin.length).toBeLessThanOrEqual(CONFIG.PIN_MAX_LENGTH);
            
            // Generate salt
            const salt = generateSalt();
            
            // Derive key from PIN
            const key = await deriveKeyFromPassword(pin, salt);
            
            // Verify the key is valid
            expect(key).toBeInstanceOf(CryptoKey);
            expect(validateCryptoKey(key)).toBe(true);
            
            // Verify key properties
            expect(key.type).toBe('secret');
            expect(key.algorithm.name).toBe('AES-GCM');
            expect((key.algorithm as AesKeyAlgorithm).length).toBe(CONFIG.AES_KEY_LENGTH);
            expect(key.usages).toContain('encrypt');
            expect(key.usages).toContain('decrypt');
            
            // Verify the key can actually be used for encryption
            const testData = stringToBytes('test data for key validation');
            const encrypted = await encryptData(testData, key);
            
            expect(encrypted.ciphertext).toBeInstanceOf(Uint8Array);
            expect(encrypted.iv).toBeInstanceOf(Uint8Array);
            expect(encrypted.authTag).toBeInstanceOf(Uint8Array);
            
            // Verify the key can decrypt what it encrypted
            const decrypted = await decryptData(
              encrypted.ciphertext,
              key,
              encrypted.iv,
              encrypted.authTag
            );
            
            expect(decrypted).toEqual(testData);
          }
        ),
        { numRuns: PROPERTY_TEST_CONFIG.numRuns }
      );
    });
  });

  describe('encryptData and decryptData', () => {
    let testKey: CryptoKey;

    beforeEach(async () => {
      const salt = generateSalt();
      testKey = await deriveKeyFromPassword('test-password', salt);
    });

    it('should encrypt and decrypt data correctly', async () => {
      const originalData = stringToBytes('Hello, World!');
      
      const encrypted = await encryptData(originalData, testKey);
      const decrypted = await decryptData(
        encrypted.ciphertext,
        testKey,
        encrypted.iv,
        encrypted.authTag
      );
      
      expect(decrypted).toEqual(originalData);
      expect(bytesToString(decrypted)).toBe('Hello, World!');
    });

    it('should produce different ciphertext for same data with different IVs', async () => {
      const data = stringToBytes('test data');
      
      const encrypted1 = await encryptData(data, testKey);
      const encrypted2 = await encryptData(data, testKey);
      
      expect(encrypted1.ciphertext).not.toEqual(encrypted2.ciphertext);
      expect(encrypted1.iv).not.toEqual(encrypted2.iv);
    });

    it('should fail decryption with wrong auth tag', async () => {
      const data = stringToBytes('test data');
      const encrypted = await encryptData(data, testKey);
      
      // Corrupt the auth tag
      const corruptedAuthTag = new Uint8Array(encrypted.authTag);
      corruptedAuthTag[0] = corruptedAuthTag[0]! ^ 1;
      
      await expect(
        decryptData(encrypted.ciphertext, testKey, encrypted.iv, corruptedAuthTag)
      ).rejects.toThrow();
    });

    // Property-based test for encryption round-trip
    it('should preserve any data through encryption round-trip', () => {
      fc.assert(
        fc.asyncProperty(fc.uint8Array({ minLength: 0, maxLength: 1000 }), async (data) => {
          const encrypted = await encryptData(data, testKey);
          const decrypted = await decryptData(
            encrypted.ciphertext,
            testKey,
            encrypted.iv,
            encrypted.authTag
          );
          
          expect(decrypted).toEqual(data);
        }),
        { numRuns: PROPERTY_TEST_CONFIG.numRuns }
      );
    });
  });

  describe('validateCryptoKey', () => {
    it('should validate correct AES-GCM key', async () => {
      const salt = generateSalt();
      const key = await deriveKeyFromPassword('test', salt);
      
      expect(validateCryptoKey(key)).toBe(true);
    });

    it('should reject invalid key types', async () => {
      // Create a key with wrong algorithm
      const wrongKey = await crypto.subtle.generateKey(
        {
          name: 'HMAC',
          hash: 'SHA-256',
        },
        false,
        ['sign', 'verify']
      );
      
      expect(validateCryptoKey(wrongKey)).toBe(false);
    });
  });

  describe('string/bytes conversion', () => {
    it('should convert strings to bytes and back', () => {
      const testStrings = [
        'Hello, World!',
        'Unicode: 🔐🔑',
        '',
        'Special chars: !@#$%^&*()',
      ];
      
      testStrings.forEach(str => {
        const bytes = stringToBytes(str);
        const converted = bytesToString(bytes);
        expect(converted).toBe(str);
      });
    });

    // Property-based test for string round-trip
    it('should preserve any valid string through conversion', () => {
      fc.assert(
        fc.property(fc.string(), (str) => {
          const bytes = stringToBytes(str);
          const converted = bytesToString(bytes);
          expect(converted).toBe(str);
        }),
        { numRuns: PROPERTY_TEST_CONFIG.numRuns }
      );
    });
  });

  describe('validatePIN', () => {
    it('should validate correct PINs', () => {
      const validPINs = ['1234', '12345', '123456', '1234567', '12345678'];
      validPINs.forEach(pin => {
        expect(validatePIN(pin)).toBe(true);
      });
    });

    it('should reject invalid PINs', () => {
      const invalidPINs = [
        '',
        '123', // too short
        '123456789', // too long
        '12a4', // contains letter
        '12.4', // contains dot
        '12 4', // contains space
        null as any,
        undefined as any,
        123 as any, // not a string
      ];
      
      invalidPINs.forEach(pin => {
        expect(validatePIN(pin)).toBe(false);
      });
    });

    // Property-based test for PIN validation
    it('should validate PINs according to rules', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: CONFIG.PIN_MIN_LENGTH, maxLength: CONFIG.PIN_MAX_LENGTH }),
          (str) => {
            const isAllDigits = /^\d+$/.test(str);
            const result = validatePIN(str);
            
            if (isAllDigits) {
              expect(result).toBe(true);
            } else {
              expect(result).toBe(false);
            }
          }
        ),
        { numRuns: PROPERTY_TEST_CONFIG.numRuns }
      );
    });
  });

  describe('generateRandomPIN', () => {
    it('should generate valid PINs', () => {
      for (let i = 0; i < 10; i++) {
        const pin = generateRandomPIN();
        expect(validatePIN(pin)).toBe(true);
        expect(pin.length).toBeGreaterThanOrEqual(CONFIG.PIN_MIN_LENGTH);
        expect(pin.length).toBeLessThanOrEqual(CONFIG.PIN_MAX_LENGTH);
      }
    });

    it('should generate different PINs', () => {
      const pins = new Set();
      for (let i = 0; i < 20; i++) {
        pins.add(generateRandomPIN());
      }
      
      // Should have generated at least some different PINs
      expect(pins.size).toBeGreaterThan(1);
    });
  });
});