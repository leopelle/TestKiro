/**
 * Tests for credit card utility functions
 * 
 * This test suite includes both unit tests for specific examples
 * and property-based tests for universal properties.
 * 
 * Requirements: 3.2, 3.4, 3.5
 */

import { describe, test, expect } from '@jest/globals';
import * as fc from 'fast-check';
import {
  maskCardNumber,
  validateLuhn,
  detectCardType,
  formatCardNumber,
  isExpiringSoon,
  validateExpiryDate,
} from './creditcard-utils';

describe('Credit Card Utilities', () => {
  describe('maskCardNumber', () => {
    describe('Unit Tests - Specific Examples', () => {
      test('should mask 16-digit card number showing last 4 digits', () => {
        const result = maskCardNumber('4532015112830366');
        expect(result).toBe('**** **** **** 0366');
      });

      test('should mask card number with spaces', () => {
        const result = maskCardNumber('4532 0151 1283 0366');
        expect(result).toBe('**** **** **** 0366');
      });

      test('should mask card number with dashes', () => {
        const result = maskCardNumber('4532-0151-1283-0366');
        expect(result).toBe('**** **** **** 0366');
      });

      test('should mask 15-digit Amex card', () => {
        const result = maskCardNumber('378282246310005');
        expect(result).toBe('**** **** ***0 005');
      });

      test('should handle card with less than 4 digits', () => {
        const result = maskCardNumber('123');
        expect(result).toBe('***');
      });

      test('should use custom mask character', () => {
        const result = maskCardNumber('4532015112830366', 'X');
        expect(result).toBe('XXXX XXXX XXXX 0366');
      });

      test('should handle empty string', () => {
        const result = maskCardNumber('');
        expect(result).toBe('');
      });

      test('should handle exactly 4 digits', () => {
        const result = maskCardNumber('1234');
        expect(result).toBe('1234');
      });
    });

    describe('Property-Based Tests', () => {
      test('should always show last 4 digits for cards with 4+ digits', () => {
        fc.assert(
          fc.property(
            fc.stringOf(fc.integer({ min: 0, max: 9 }).map(String), { minLength: 4, maxLength: 19 }),
            (cardNumber) => {
              const masked = maskCardNumber(cardNumber);
              const lastFour = cardNumber.slice(-4);
              expect(masked.replace(/[\s*]/g, '').slice(-4)).toBe(lastFour);
            }
          ),
          { numRuns: 100 }
        );
      });

      test('should mask all but last 4 digits', () => {
        fc.assert(
          fc.property(
            fc.stringOf(fc.integer({ min: 0, max: 9 }).map(String), { minLength: 4, maxLength: 19 }),
            (cardNumber) => {
              const masked = maskCardNumber(cardNumber);
              const cleanedMasked = masked.replace(/\s/g, '');
              const expectedMaskedCount = Math.max(0, cardNumber.length - 4);
              const actualMaskedCount = (cleanedMasked.match(/\*/g) || []).length;
              expect(actualMaskedCount).toBe(expectedMaskedCount);
            }
          ),
          { numRuns: 100 }
        );
      });

      test('should preserve total digit count', () => {
        fc.assert(
          fc.property(
            fc.stringOf(fc.integer({ min: 0, max: 9 }).map(String), { minLength: 1, maxLength: 19 }),
            (cardNumber) => {
              const masked = maskCardNumber(cardNumber);
              const cleanedMasked = masked.replace(/\s/g, '');
              expect(cleanedMasked.length).toBe(cardNumber.length);
            }
          ),
          { numRuns: 100 }
        );
      });
    });
  });

  describe('validateLuhn', () => {
    describe('Unit Tests - Specific Examples', () => {
      test('should validate correct Visa card number', () => {
        expect(validateLuhn('4532015112830366')).toBe(true);
      });

      test('should validate correct Mastercard number', () => {
        expect(validateLuhn('5425233430109903')).toBe(true);
      });

      test('should validate correct Amex number', () => {
        expect(validateLuhn('378282246310005')).toBe(true);
      });

      test('should reject invalid check digit', () => {
        expect(validateLuhn('4532015112830367')).toBe(false);
      });

      test('should accept card number with spaces', () => {
        expect(validateLuhn('4532 0151 1283 0366')).toBe(true);
      });

      test('should accept card number with dashes', () => {
        expect(validateLuhn('4532-0151-1283-0366')).toBe(true);
      });

      test('should reject card with non-digit characters', () => {
        expect(validateLuhn('4532-0151-1283-036X')).toBe(false);
      });

      test('should reject card with less than 13 digits', () => {
        expect(validateLuhn('123456789012')).toBe(false);
      });

      test('should reject all zeros', () => {
        expect(validateLuhn('0000000000000000')).toBe(false);
      });

      test('should reject empty string', () => {
        expect(validateLuhn('')).toBe(false);
      });

      test('should validate 13-digit card', () => {
        // Valid 13-digit Visa
        expect(validateLuhn('4532015112830')).toBe(true);
      });

      test('should validate 19-digit card', () => {
        // Valid 19-digit card (generated with valid Luhn checksum)
        expect(validateLuhn('6011000990139424009')).toBe(true);
      });
    });

    describe('Property-Based Tests', () => {
      test('should reject cards with non-numeric characters', () => {
        fc.assert(
          fc.property(
            fc.string().filter(s => /[^\d\s-]/.test(s)),
            (invalidCard) => {
              expect(validateLuhn(invalidCard)).toBe(false);
            }
          ),
          { numRuns: 100 }
        );
      });

      test('should reject cards shorter than 13 digits', () => {
        fc.assert(
          fc.property(
            fc.stringOf(fc.integer({ min: 0, max: 9 }).map(String), { minLength: 1, maxLength: 12 }),
            (shortCard) => {
              expect(validateLuhn(shortCard)).toBe(false);
            }
          ),
          { numRuns: 100 }
        );
      });

      test('Luhn algorithm should be consistent', () => {
        fc.assert(
          fc.property(
            fc.stringOf(fc.integer({ min: 0, max: 9 }).map(String), { minLength: 13, maxLength: 19 }),
            (cardNumber) => {
              const result1 = validateLuhn(cardNumber);
              const result2 = validateLuhn(cardNumber);
              expect(result1).toBe(result2);
            }
          ),
          { numRuns: 100 }
        );
      });

      test('should handle spaces and dashes consistently', () => {
        fc.assert(
          fc.property(
            fc.stringOf(fc.integer({ min: 0, max: 9 }).map(String), { minLength: 13, maxLength: 19 }),
            (cardNumber) => {
              const withSpaces = cardNumber.match(/.{1,4}/g)?.join(' ') || cardNumber;
              const withDashes = cardNumber.match(/.{1,4}/g)?.join('-') || cardNumber;
              const plain = validateLuhn(cardNumber);
              const spaces = validateLuhn(withSpaces);
              const dashes = validateLuhn(withDashes);
              expect(plain).toBe(spaces);
              expect(plain).toBe(dashes);
            }
          ),
          { numRuns: 100 }
        );
      });
    });
  });

  describe('detectCardType', () => {
    test('should detect Visa cards', () => {
      expect(detectCardType('4532015112830366')).toBe('visa');
      expect(detectCardType('4111111111111111')).toBe('visa');
    });

    test('should detect Mastercard', () => {
      expect(detectCardType('5425233430109903')).toBe('mastercard');
      expect(detectCardType('5555555555554444')).toBe('mastercard');
      expect(detectCardType('2221000000000009')).toBe('mastercard');
    });

    test('should detect American Express', () => {
      expect(detectCardType('378282246310005')).toBe('amex');
      expect(detectCardType('371449635398431')).toBe('amex');
    });

    test('should detect Discover', () => {
      expect(detectCardType('6011111111111117')).toBe('discover');
      expect(detectCardType('6011000990139424')).toBe('discover');
    });

    test('should detect Diners Club', () => {
      expect(detectCardType('36227206271667')).toBe('diners');
      expect(detectCardType('38520000023237')).toBe('diners');
    });

    test('should detect JCB', () => {
      expect(detectCardType('3530111333300000')).toBe('jcb');
      expect(detectCardType('3566002020360505')).toBe('jcb');
    });

    test('should return unknown for unrecognized patterns', () => {
      expect(detectCardType('9111111111111111')).toBe('unknown');
      expect(detectCardType('1234567890123456')).toBe('unknown');
    });
  });

  describe('formatCardNumber', () => {
    test('should format 16-digit card with spaces', () => {
      expect(formatCardNumber('4532015112830366')).toBe('4532 0151 1283 0366');
    });

    test('should format 15-digit Amex with 4-6-5 pattern', () => {
      expect(formatCardNumber('378282246310005')).toBe('3782 822463 10005');
    });

    test('should handle already formatted card', () => {
      expect(formatCardNumber('4532 0151 1283 0366')).toBe('4532 0151 1283 0366');
    });

    test('should remove dashes and add spaces', () => {
      expect(formatCardNumber('4532-0151-1283-0366')).toBe('4532 0151 1283 0366');
    });
  });

  describe('validateExpiryDate', () => {
    test('should accept valid future date', () => {
      // Create a date far in the future
      expect(validateExpiryDate('12/99')).toBe(true);
    });

    test('should reject invalid format', () => {
      expect(validateExpiryDate('13/25')).toBe(false); // Invalid month
      expect(validateExpiryDate('00/25')).toBe(false); // Invalid month
      expect(validateExpiryDate('1/25')).toBe(false); // Single digit month
      expect(validateExpiryDate('12/2025')).toBe(false); // 4-digit year
      expect(validateExpiryDate('12-25')).toBe(false); // Wrong separator
    });

    test('should reject expired date', () => {
      expect(validateExpiryDate('01/20')).toBe(false);
      expect(validateExpiryDate('12/19')).toBe(false);
    });

    test('should accept current month/year', () => {
      const now = new Date();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = String(now.getFullYear()).slice(-2);
      expect(validateExpiryDate(`${month}/${year}`)).toBe(true);
    });
  });

  describe('isExpiringSoon', () => {
    test('should detect card expiring within 30 days', () => {
      const now = new Date();
      // Get current month - this will definitely be within 30 days
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = String(now.getFullYear()).slice(-2);
      expect(isExpiringSoon(`${month}/${year}`, 30)).toBe(true);
    });

    test('should not flag card expiring beyond threshold', () => {
      const now = new Date();
      // Get a date that's 90 days from now
      const futureDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
      const month = String(futureDate.getMonth() + 1).padStart(2, '0');
      const year = String(futureDate.getFullYear()).slice(-2);
      expect(isExpiringSoon(`${month}/${year}`, 30)).toBe(false);
    });

    test('should handle custom threshold', () => {
      const now = new Date();
      // Get next month
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const month = String(nextMonth.getMonth() + 1).padStart(2, '0');
      const year = String(nextMonth.getFullYear()).slice(-2);
      
      // Next month should be within 60 days but might not be within 20 days
      expect(isExpiringSoon(`${month}/${year}`, 60)).toBe(true);
      
      // Far future month should not be within 60 days
      const farFuture = new Date(now.getTime() + 120 * 24 * 60 * 60 * 1000);
      const farMonth = String(farFuture.getMonth() + 1).padStart(2, '0');
      const farYear = String(farFuture.getFullYear()).slice(-2);
      expect(isExpiringSoon(`${farMonth}/${farYear}`, 60)).toBe(false);
    });

    test('should return false for invalid format', () => {
      expect(isExpiringSoon('13/25', 30)).toBe(false);
      expect(isExpiringSoon('invalid', 30)).toBe(false);
    });

    test('should detect already expired card', () => {
      expect(isExpiringSoon('01/20', 30)).toBe(true);
    });
  });
});
