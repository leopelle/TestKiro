/**
 * Tests for the CryptoEngine implementation
 */

import * as fc from 'fast-check';
import { DefaultCryptoEngine, createCryptoEngine, defaultCryptoEngine } from './crypto-engine';
import { CryptoEngine, EncryptedData } from '../types/crypto';
import { CONFIG, ErrorCode, PasswordManagerError } from '../types/common';
import { deriveKeyFromPassword, stringToBytes, bytesToString } from '../utils/crypto-utils';
import { PROPERTY_TEST_CONFIG } from '../test-setup';

describe('CryptoEngine', () => {
  let cryptoEngine: CryptoEngine;
  let testKey: CryptoKey;

  beforeEach(async () => {
    cryptoEngine = new DefaultCryptoEngine();
    
    // Create a test key for encryption/decryption tests
    const salt = cryptoEngine.generateSalt();
    testKey = await deriveKeyFromPassword('test-password-123', salt);
  });

  describe('Factory Functions', () => {
    it('should create CryptoEngine instance via factory', () => {
      const engine = createCryptoEngine();
      expect(engine).toBeInstanceOf(DefaultCryptoEngine);
    });

    it('should provide singleton instance', () => {
      expect(defaultCryptoEngine).toBeInstanceOf(DefaultCryptoEngine);
    });
  });

  describe('generateSalt', () => {
    it('should generate salt of default length', () => {
      const salt = cryptoEngine.generateSalt();
      expect(salt).toBeInstanceOf(Uint8Array);
      expect(salt.length).toBe(CONFIG.SALT_LENGTH);
    });

    it('should generate salt of specified length', () => {
      const length = 16;
      const salt = cryptoEngine.generateSalt(length);
      expect(salt.length).toBe(length);
    });

    it('should generate different salts on each call', () => {
      const salt1 = cryptoEngine.generateSalt();
      const salt2 = cryptoEngine.generateSalt();
      
      expect(salt1).not.toEqual(salt2);
    });

    it('should throw error for invalid length', () => {
      expect(() => cryptoEngine.generateSalt(0)).toThrow(PasswordManagerError);
      expect(() => cryptoEngine.generateSalt(-1)).toThrow(PasswordManagerError);
    });

    // Property-based test for salt generation
    it('should generate cryptographically secure salts', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 64 }), (length) => {
          const salt = cryptoEngine.generateSalt(length);
          
          expect(salt).toBeInstanceOf(Uint8Array);
          expect(salt.length).toBe(length);
          
          // Check that salt contains some randomness (not all zeros)
          const hasNonZero = Array.from(salt).some(byte => byte !== 0);
          expect(hasNonZero).toBe(true);
        }),
        { numRuns: PROPERTY_TEST_CONFIG.numRuns }
      );
    });
  });

  describe('generateIV', () => {
    it('should generate IV of default length', () => {
      const iv = cryptoEngine.generateIV();
      expect(iv).toBeInstanceOf(Uint8Array);
      expect(iv.length).toBe(CONFIG.IV_LENGTH);
    });

    it('should generate IV of specified length', () => {
      const length = 16;
      const iv = cryptoEngine.generateIV(length);
      expect(iv.length).toBe(length);
    });

    it('should generate different IVs on each call', () => {
      const iv1 = cryptoEngine.generateIV();
      const iv2 = cryptoEngine.generateIV();
      
      expect(iv1).not.toEqual(iv2);
    });

    it('should throw error for invalid length', () => {
      expect(() => cryptoEngine.generateIV(0)).toThrow(PasswordManagerError);
      expect(() => cryptoEngine.generateIV(-1)).toThrow(PasswordManagerError);
    });

    // Property-based test for IV generation
    it('should generate cryptographically secure IVs', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 32 }), (length) => {
          const iv = cryptoEngine.generateIV(length);
          
          expect(iv).toBeInstanceOf(Uint8Array);
          expect(iv.length).toBe(length);
          
          // Check that IV contains some randomness (not all zeros)
          const hasNonZero = Array.from(iv).some(byte => byte !== 0);
          expect(hasNonZero).toBe(true);
        }),
        { numRuns: PROPERTY_TEST_CONFIG.numRuns }
      );
    });
  });

  describe('encrypt', () => {
    it('should encrypt data successfully', async () => {
      const data = stringToBytes('Hello, World!');
      
      const encrypted = await cryptoEngine.encrypt(data, testKey);
      
      expect(encrypted).toHaveProperty('ciphertext');
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('authTag');
      expect(encrypted.ciphertext).toBeInstanceOf(Uint8Array);
      expect(encrypted.iv).toBeInstanceOf(Uint8Array);
      expect(encrypted.authTag).toBeInstanceOf(Uint8Array);
      expect(encrypted.iv.length).toBe(CONFIG.IV_LENGTH);
    });

    it('should produce different ciphertext for same data', async () => {
      const data = stringToBytes('test data');
      
      const encrypted1 = await cryptoEngine.encrypt(data, testKey);
      const encrypted2 = await cryptoEngine.encrypt(data, testKey);
      
      expect(encrypted1.ciphertext).not.toEqual(encrypted2.ciphertext);
      expect(encrypted1.iv).not.toEqual(encrypted2.iv);
    });

    it('should throw error for invalid key', async () => {
      const data = stringToBytes('test');
      const invalidKey = {} as CryptoKey;
      
      await expect(cryptoEngine.encrypt(data, invalidKey))
        .rejects.toThrow(PasswordManagerError);
    });

    // Property-based test for encryption
    it('should encrypt any data without errors', () => {
      fc.assert(
        fc.asyncProperty(
          fc.uint8Array({ minLength: 0, maxLength: 1000 }),
          async (data) => {
            const encrypted = await cryptoEngine.encrypt(data, testKey);
            
            expect(encrypted.ciphertext).toBeInstanceOf(Uint8Array);
            expect(encrypted.iv).toBeInstanceOf(Uint8Array);
            expect(encrypted.authTag).toBeInstanceOf(Uint8Array);
            expect(encrypted.iv.length).toBe(CONFIG.IV_LENGTH);
            expect(encrypted.authTag.length).toBe(16); // AES-GCM auth tag is 16 bytes
          }
        ),
        { numRuns: 50 } // Reduced for performance
      );
    });
  });

  describe('decrypt', () => {
    it('should decrypt data successfully', async () => {
      const originalData = stringToBytes('Hello, World!');
      
      const encrypted = await cryptoEngine.encrypt(originalData, testKey);
      const decrypted = await cryptoEngine.decrypt(encrypted, testKey);
      
      expect(decrypted).toEqual(originalData);
      expect(bytesToString(decrypted)).toBe('Hello, World!');
    });

    it('should fail with corrupted ciphertext', async () => {
      const data = stringToBytes('test data');
      const encrypted = await cryptoEngine.encrypt(data, testKey);
      
      // Corrupt the ciphertext
      const corruptedCiphertext = new Uint8Array(encrypted.ciphertext);
      if (corruptedCiphertext.length > 0) {
        corruptedCiphertext[0] = corruptedCiphertext[0]! ^ 1;
      }
      
      const corruptedEncrypted: EncryptedData = {
        ...encrypted,
        ciphertext: corruptedCiphertext,
      };
      
      await expect(cryptoEngine.decrypt(corruptedEncrypted, testKey))
        .rejects.toThrow(PasswordManagerError);
    });

    it('should fail with corrupted auth tag', async () => {
      const data = stringToBytes('test data');
      const encrypted = await cryptoEngine.encrypt(data, testKey);
      
      // Corrupt the auth tag
      const corruptedAuthTag = new Uint8Array(encrypted.authTag);
      corruptedAuthTag[0] = corruptedAuthTag[0]! ^ 1;
      
      const corruptedEncrypted: EncryptedData = {
        ...encrypted,
        authTag: corruptedAuthTag,
      };
      
      await expect(cryptoEngine.decrypt(corruptedEncrypted, testKey))
        .rejects.toThrow(PasswordManagerError);
    });

    it('should fail with invalid encrypted data structure', async () => {
      const invalidEncrypted = {
        ciphertext: new Uint8Array(0),
        iv: new Uint8Array(0),
        authTag: new Uint8Array(0),
      };
      
      await expect(cryptoEngine.decrypt(invalidEncrypted, testKey))
        .rejects.toThrow(PasswordManagerError);
    });

    it('should throw error for invalid key', async () => {
      const data = stringToBytes('test');
      const encrypted = await cryptoEngine.encrypt(data, testKey);
      const invalidKey = {} as CryptoKey;
      
      await expect(cryptoEngine.decrypt(encrypted, invalidKey))
        .rejects.toThrow(PasswordManagerError);
    });
  });

  describe('encrypt/decrypt round-trip', () => {
    it('should preserve data through encryption round-trip', async () => {
      const testData = [
        stringToBytes(''),
        stringToBytes('Hello, World!'),
        stringToBytes('Unicode: 🔐🔑'),
        new Uint8Array([0, 1, 2, 3, 255, 254, 253]),
        new Uint8Array(1000).fill(42),
      ];
      
      for (const data of testData) {
        const encrypted = await cryptoEngine.encrypt(data, testKey);
        const decrypted = await cryptoEngine.decrypt(encrypted, testKey);
        
        expect(decrypted).toEqual(data);
      }
    });

    /**
     * Property 1: Round-trip Crittografico
     * 
     * For any sensitive data and valid master key, encrypting and then decrypting
     * should produce the original data identically.
     * 
     * **Validates: Requirements 1.2, 4.2, 5.3, 8.2**
     * 
     * Feature: password-manager-app, Property 1: Round-trip Crittografico
     */
    it('Property 1: Round-trip Crittografico - encryption and decryption should preserve data', () => {
      fc.assert(
        fc.asyncProperty(
          fc.uint8Array({ minLength: 0, maxLength: 1000 }),
          fc.string({ minLength: 4, maxLength: 64 }), // PIN/password for key derivation
          async (data, password) => {
            // Create a fresh key for each test
            const salt = cryptoEngine.generateSalt();
            const key = await deriveKeyFromPassword(password, salt);
            
            // Encrypt the data
            const encrypted = await cryptoEngine.encrypt(data, key);
            
            // Decrypt the data
            const decrypted = await cryptoEngine.decrypt(encrypted, key);
            
            // The decrypted data should be identical to the original
            expect(decrypted).toEqual(data);
          }
        ),
        { numRuns: PROPERTY_TEST_CONFIG.numRuns }
      );
    });
  });

  describe('secureWipe', () => {
    it('should wipe data array', () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const originalData = new Uint8Array(data);
      
      cryptoEngine.secureWipe(data);
      
      // Data should be different after wiping
      expect(data).not.toEqual(originalData);
      // Should be all zeros after final wipe pass
      expect(Array.from(data)).toEqual([0, 0, 0, 0, 0]);
    });

    it('should handle empty arrays', () => {
      const data = new Uint8Array(0);
      expect(() => cryptoEngine.secureWipe(data)).not.toThrow();
    });

    it('should handle null/undefined gracefully', () => {
      expect(() => cryptoEngine.secureWipe(null as any)).not.toThrow();
      expect(() => cryptoEngine.secureWipe(undefined as any)).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should throw PasswordManagerError with correct error codes', async () => {
      const data = stringToBytes('test');
      const invalidKey = {} as CryptoKey;
      
      try {
        await cryptoEngine.encrypt(data, invalidKey);
        throw new Error('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(PasswordManagerError);
        expect((error as PasswordManagerError).code).toBe(ErrorCode.ENCRYPTION_FAILED);
      }
      
      try {
        const encrypted = await cryptoEngine.encrypt(data, testKey);
        await cryptoEngine.decrypt(encrypted, invalidKey);
        throw new Error('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(PasswordManagerError);
        expect((error as PasswordManagerError).code).toBe(ErrorCode.DECRYPTION_FAILED);
      }
    });
  });
});