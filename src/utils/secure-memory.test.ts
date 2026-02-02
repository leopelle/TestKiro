/**
 * Tests for secure memory utilities
 */

import * as fc from 'fast-check';
import {
  secureWipe,
  SecureBuffer,
  SecureString,
  generateSecureRandom,
  constantTimeEquals,
  hexToBytes,
  bytesToHex,
} from './secure-memory';
import { PROPERTY_TEST_CONFIG } from '../test-setup';

describe('Secure Memory Utilities', () => {
  describe('secureWipe', () => {
    it('should wipe a Uint8Array with zeros', () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      secureWipe(data);
      expect(data).toEqual(new Uint8Array([0, 0, 0, 0, 0]));
    });

    it('should handle empty arrays gracefully', () => {
      const data = new Uint8Array(0);
      expect(() => secureWipe(data)).not.toThrow();
    });

    it('should handle null/undefined gracefully', () => {
      expect(() => secureWipe(null as any)).not.toThrow();
      expect(() => secureWipe(undefined as any)).not.toThrow();
    });

    // Property-based test
    it('should always result in zeros for any input', () => {
      fc.assert(
        fc.property(fc.uint8Array(), (data) => {
          const original = new Uint8Array(data);
          secureWipe(original);
          expect(original).toEqual(new Uint8Array(data.length).fill(0));
        }),
        { numRuns: PROPERTY_TEST_CONFIG.numRuns }
      );
    });
  });

  describe('SecureBuffer', () => {
    it('should create a buffer with specified size', () => {
      const buffer = new SecureBuffer(10);
      expect(buffer.size).toBe(10);
      expect(buffer.data.length).toBe(10);
      buffer.dispose();
    });

    it('should throw error for invalid size', () => {
      expect(() => new SecureBuffer(0)).toThrow('Buffer size must be positive');
      expect(() => new SecureBuffer(-1)).toThrow('Buffer size must be positive');
    });

    it('should write and read data correctly', () => {
      const buffer = new SecureBuffer(10);
      const testData = new Uint8Array([1, 2, 3, 4, 5]);
      
      buffer.write(testData, 2);
      const readData = buffer.read(2, 5);
      
      expect(readData).toEqual(testData);
      buffer.dispose();
    });

    it('should throw error when accessing disposed buffer', () => {
      const buffer = new SecureBuffer(10);
      buffer.dispose();
      
      expect(() => buffer.data).toThrow('Buffer has been disposed');
      expect(() => buffer.write(new Uint8Array([1]))).toThrow('Buffer has been disposed');
      expect(() => buffer.read()).toThrow('Buffer has been disposed');
    });

    it('should randomize buffer contents', () => {
      const buffer = new SecureBuffer(10);
      const originalData = new Uint8Array(buffer.data);
      
      buffer.randomize();
      
      // Very unlikely that random data equals original zeros
      expect(buffer.data).not.toEqual(originalData);
      buffer.dispose();
    });

    // Property-based test for bounds checking
    it('should enforce bounds checking for all operations', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          fc.uint8Array({ minLength: 1, maxLength: 50 }),
          fc.integer({ min: -10, max: 110 }),
          (bufferSize, data, offset) => {
            const buffer = new SecureBuffer(bufferSize);
            
            if (offset < 0 || offset + data.length > bufferSize) {
              expect(() => buffer.write(data, offset)).toThrow();
            } else {
              expect(() => buffer.write(data, offset)).not.toThrow();
            }
            
            buffer.dispose();
          }
        ),
        { numRuns: PROPERTY_TEST_CONFIG.numRuns }
      );
    });
  });

  describe('SecureString', () => {
    it('should store and retrieve string correctly', () => {
      const testString = 'Hello, World!';
      const secureStr = new SecureString(testString);
      
      expect(secureStr.value).toBe(testString);
      expect(secureStr.length).toBe(new TextEncoder().encode(testString).length);
      
      secureStr.dispose();
    });

    it('should throw error when accessing disposed string', () => {
      const secureStr = new SecureString('test');
      secureStr.dispose();
      
      expect(() => secureStr.value).toThrow('SecureString has been disposed');
      expect(secureStr.isDisposed).toBe(true);
    });

    // Property-based test for string round-trip
    it('should preserve any valid string', () => {
      fc.assert(
        fc.property(fc.string(), (str) => {
          const secureStr = new SecureString(str);
          expect(secureStr.value).toBe(str);
          secureStr.dispose();
        }),
        { numRuns: PROPERTY_TEST_CONFIG.numRuns }
      );
    });
  });

  describe('generateSecureRandom', () => {
    it('should generate random bytes of specified length', () => {
      const length = 32;
      const random = generateSecureRandom(length);
      
      expect(random.length).toBe(length);
      expect(random).toBeInstanceOf(Uint8Array);
    });

    it('should throw error for invalid length', () => {
      expect(() => generateSecureRandom(0)).toThrow('Length must be positive');
      expect(() => generateSecureRandom(-1)).toThrow('Length must be positive');
    });

    // Property-based test for randomness (basic check)
    it('should generate different values for multiple calls', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 100 }), (length) => {
          const random1 = generateSecureRandom(length);
          const random2 = generateSecureRandom(length);
          
          expect(random1.length).toBe(length);
          expect(random2.length).toBe(length);
          
          // Very unlikely that two random arrays are identical
          if (length > 1) {
            expect(random1).not.toEqual(random2);
          }
        }),
        { numRuns: 50 } // Reduced runs for performance
      );
    });
  });

  describe('constantTimeEquals', () => {
    it('should return true for identical arrays', () => {
      const arr1 = new Uint8Array([1, 2, 3, 4, 5]);
      const arr2 = new Uint8Array([1, 2, 3, 4, 5]);
      
      expect(constantTimeEquals(arr1, arr2)).toBe(true);
    });

    it('should return false for different arrays', () => {
      const arr1 = new Uint8Array([1, 2, 3, 4, 5]);
      const arr2 = new Uint8Array([1, 2, 3, 4, 6]);
      
      expect(constantTimeEquals(arr1, arr2)).toBe(false);
    });

    it('should return false for arrays of different lengths', () => {
      const arr1 = new Uint8Array([1, 2, 3]);
      const arr2 = new Uint8Array([1, 2, 3, 4]);
      
      expect(constantTimeEquals(arr1, arr2)).toBe(false);
    });

    // Property-based test for reflexivity and symmetry
    it('should be reflexive and symmetric', () => {
      fc.assert(
        fc.property(fc.uint8Array(), fc.uint8Array(), (arr1, arr2) => {
          // Reflexivity: a equals a
          expect(constantTimeEquals(arr1, arr1)).toBe(true);
          
          // Symmetry: if a equals b, then b equals a
          const result = constantTimeEquals(arr1, arr2);
          expect(constantTimeEquals(arr2, arr1)).toBe(result);
        }),
        { numRuns: PROPERTY_TEST_CONFIG.numRuns }
      );
    });
  });

  describe('hex conversion utilities', () => {
    it('should convert bytes to hex and back', () => {
      const original = new Uint8Array([0x00, 0x01, 0x0F, 0xFF, 0xAB, 0xCD]);
      const hex = bytesToHex(original);
      const converted = hexToBytes(hex);
      
      expect(hex).toBe('00010fffabcd');
      expect(converted).toEqual(original);
    });

    it('should throw error for invalid hex strings', () => {
      expect(() => hexToBytes('abc')).toThrow('Hex string must have even length');
      expect(() => hexToBytes('zz')).toThrow('Invalid hex string');
    });

    // Property-based test for hex round-trip
    it('should preserve data through hex round-trip', () => {
      fc.assert(
        fc.property(fc.uint8Array(), (data) => {
          const hex = bytesToHex(data);
          const converted = hexToBytes(hex);
          expect(converted).toEqual(data);
        }),
        { numRuns: PROPERTY_TEST_CONFIG.numRuns }
      );
    });
  });
});