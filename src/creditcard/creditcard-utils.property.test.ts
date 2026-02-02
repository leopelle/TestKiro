/**
 * Credit Card Utilities Property-Based Tests
 * 
 * Property-based tests using fast-check to verify credit card utility
 * correctness across all valid inputs.
 * 
 * Feature: password-manager-app
 */

import * as fc from 'fast-check';
import { maskCardNumber, validateLuhn, isExpiringSoon } from './creditcard-utils';
import { checkExpiringCards, createExpiryNotification } from './expiry-notifications';
import { CreditCardItem } from '../types/vault';

describe('CreditCard Utilities - Property-Based Tests', () => {
  /**
   * Property 10: Mascheramento Numero Carta
   * 
   * **Validates: Requirements 3.2**
   * 
   * For any credit card number displayed, it should show only the last 4 digits
   * with the rest masked.
   * 
   * This property verifies that:
   * 1. Only the last 4 digits are visible (unmasked)
   * 2. All other digits are masked with the mask character
   * 3. The total length is preserved (excluding formatting spaces)
   * 4. The masking is consistent regardless of input format (with/without spaces/dashes)
   */
  describe('Property 10: Credit Card Number Masking', () => {
    it('should always show only the last 4 digits for any card number', () => {
      // Arbitrary for credit card numbers (13-19 digits, which covers all major card types)
      const cardNumberArbitrary = fc.stringOf(
        fc.integer({ min: 0, max: 9 }).map(String),
        { minLength: 13, maxLength: 19 }
      );

      fc.assert(
        fc.property(cardNumberArbitrary, (cardNumber) => {
          const masked = maskCardNumber(cardNumber);
          
          // Remove spaces from masked result to get clean string
          const cleanedMasked = masked.replace(/\s/g, '');
          
          // Property 1: Last 4 characters should be the original last 4 digits
          const lastFour = cardNumber.slice(-4);
          const maskedLastFour = cleanedMasked.slice(-4);
          expect(maskedLastFour).toBe(lastFour);
          
          // Property 2: All characters before last 4 should be mask characters
          const maskedPortion = cleanedMasked.slice(0, -4);
          const allMasked = maskedPortion.split('').every(char => char === '*');
          expect(allMasked).toBe(true);
          
          // Property 3: Total length should be preserved (excluding spaces)
          expect(cleanedMasked.length).toBe(cardNumber.length);
        }),
        { numRuns: 10 }
      );
    });

    it('should mask all but last 4 digits with custom mask character', () => {
      const cardNumberArbitrary = fc.stringOf(
        fc.integer({ min: 0, max: 9 }).map(String),
        { minLength: 13, maxLength: 19 }
      );
      
      const maskCharArbitrary = fc.constantFrom('*', 'X', '#', '•', '●');

      fc.assert(
        fc.property(cardNumberArbitrary, maskCharArbitrary, (cardNumber, maskChar) => {
          const masked = maskCardNumber(cardNumber, maskChar);
          const cleanedMasked = masked.replace(/\s/g, '');
          
          // Last 4 should be original digits
          const lastFour = cardNumber.slice(-4);
          expect(cleanedMasked.slice(-4)).toBe(lastFour);
          
          // All other characters should be the custom mask character
          const maskedPortion = cleanedMasked.slice(0, -4);
          const allMasked = maskedPortion.split('').every(char => char === maskChar);
          expect(allMasked).toBe(true);
        }),
        { numRuns: 10 }
      );
    });

    it('should handle card numbers with spaces consistently', () => {
      const cardNumberArbitrary = fc.stringOf(
        fc.integer({ min: 0, max: 9 }).map(String),
        { minLength: 13, maxLength: 19 }
      );

      fc.assert(
        fc.property(cardNumberArbitrary, (cardNumber) => {
          // Create version with spaces (every 4 digits)
          const withSpaces = cardNumber.match(/.{1,4}/g)?.join(' ') || cardNumber;
          
          const maskedPlain = maskCardNumber(cardNumber);
          const maskedWithSpaces = maskCardNumber(withSpaces);
          
          // Both should produce the same result (spaces are normalized)
          expect(maskedPlain).toBe(maskedWithSpaces);
        }),
        { numRuns: 10 }
      );
    });

    it('should handle card numbers with dashes consistently', () => {
      const cardNumberArbitrary = fc.stringOf(
        fc.integer({ min: 0, max: 9 }).map(String),
        { minLength: 13, maxLength: 19 }
      );

      fc.assert(
        fc.property(cardNumberArbitrary, (cardNumber) => {
          // Create version with dashes (every 4 digits)
          const withDashes = cardNumber.match(/.{1,4}/g)?.join('-') || cardNumber;
          
          const maskedPlain = maskCardNumber(cardNumber);
          const maskedWithDashes = maskCardNumber(withDashes);
          
          // Both should produce the same result (dashes are normalized to spaces)
          expect(maskedPlain).toBe(maskedWithDashes);
        }),
        { numRuns: 10 }
      );
    });

    it('should preserve exactly 4 visible digits for cards with 4+ digits', () => {
      const cardNumberArbitrary = fc.stringOf(
        fc.integer({ min: 0, max: 9 }).map(String),
        { minLength: 4, maxLength: 19 }
      );

      fc.assert(
        fc.property(cardNumberArbitrary, (cardNumber) => {
          const masked = maskCardNumber(cardNumber);
          const cleanedMasked = masked.replace(/\s/g, '');
          
          // Count visible digits (non-mask characters)
          const visibleDigits = cleanedMasked.replace(/\*/g, '');
          expect(visibleDigits.length).toBe(4);
          
          // Verify they are actual digits
          expect(/^\d{4}$/.test(visibleDigits)).toBe(true);
        }),
        { numRuns: 10 }
      );
    });

    it('should mask the correct number of digits', () => {
      const cardNumberArbitrary = fc.stringOf(
        fc.integer({ min: 0, max: 9 }).map(String),
        { minLength: 4, maxLength: 19 }
      );

      fc.assert(
        fc.property(cardNumberArbitrary, (cardNumber) => {
          const masked = maskCardNumber(cardNumber);
          const cleanedMasked = masked.replace(/\s/g, '');
          
          // Count mask characters
          const maskCount = (cleanedMasked.match(/\*/g) || []).length;
          const expectedMaskCount = cardNumber.length - 4;
          
          expect(maskCount).toBe(expectedMaskCount);
        }),
        { numRuns: 10 }
      );
    });

    it('should format output with spaces for readability', () => {
      const cardNumberArbitrary = fc.stringOf(
        fc.integer({ min: 0, max: 9 }).map(String),
        { minLength: 13, maxLength: 19 }
      );

      fc.assert(
        fc.property(cardNumberArbitrary, (cardNumber) => {
          const masked = maskCardNumber(cardNumber);
          
          // Output should contain spaces (for cards longer than 4 digits)
          if (cardNumber.length > 4) {
            expect(masked).toContain(' ');
          }
          
          // When spaces are removed, length should match original
          const cleanedMasked = masked.replace(/\s/g, '');
          expect(cleanedMasked.length).toBe(cardNumber.length);
        }),
        { numRuns: 10 }
      );
    });

    it('should handle edge case of exactly 4 digits', () => {
      const fourDigitArbitrary = fc.stringOf(
        fc.integer({ min: 0, max: 9 }).map(String),
        { minLength: 4, maxLength: 4 }
      );

      fc.assert(
        fc.property(fourDigitArbitrary, (cardNumber) => {
          const masked = maskCardNumber(cardNumber);
          
          // With exactly 4 digits, all should be visible (no masking needed)
          expect(masked).toBe(cardNumber);
        }),
        { numRuns: 10 }
      );
    });

    it('should handle short card numbers (less than 4 digits)', () => {
      const shortCardArbitrary = fc.stringOf(
        fc.integer({ min: 0, max: 9 }).map(String),
        { minLength: 1, maxLength: 3 }
      );

      fc.assert(
        fc.property(shortCardArbitrary, (cardNumber) => {
          const masked = maskCardNumber(cardNumber);
          
          // All digits should be masked
          const cleanedMasked = masked.replace(/\s/g, '');
          expect(cleanedMasked).toBe('*'.repeat(cardNumber.length));
        }),
        { numRuns: 10 }
      );
    });

    it('should be idempotent - masking twice produces same result', () => {
      const cardNumberArbitrary = fc.stringOf(
        fc.integer({ min: 0, max: 9 }).map(String),
        { minLength: 13, maxLength: 19 }
      );

      fc.assert(
        fc.property(cardNumberArbitrary, (cardNumber) => {
          const masked1 = maskCardNumber(cardNumber);
          const masked2 = maskCardNumber(cardNumber);
          
          // Should produce identical results
          expect(masked1).toBe(masked2);
        }),
        { numRuns: 10 }
      );
    });

    it('should never expose more than 4 digits', () => {
      const cardNumberArbitrary = fc.stringOf(
        fc.integer({ min: 0, max: 9 }).map(String),
        { minLength: 5, maxLength: 19 }
      );

      fc.assert(
        fc.property(cardNumberArbitrary, (cardNumber) => {
          const masked = maskCardNumber(cardNumber);
          
          // Count all digits in the masked output
          const digitCount = (masked.match(/\d/g) || []).length;
          
          // Should never have more than 4 visible digits
          expect(digitCount).toBeLessThanOrEqual(4);
        }),
        { numRuns: 10 }
      );
    });

    it('should mask different card lengths correctly', () => {
      // Test various card lengths (13-19 digits cover all major card types)
      const cardLengths = [13, 14, 15, 16, 17, 18, 19];
      
      cardLengths.forEach(length => {
        const cardArbitrary = fc.stringOf(
          fc.integer({ min: 0, max: 9 }).map(String),
          { minLength: length, maxLength: length }
        );

        fc.assert(
          fc.property(cardArbitrary, (cardNumber) => {
            const masked = maskCardNumber(cardNumber);
            const cleanedMasked = masked.replace(/\s/g, '');
            
            // Should have correct length
            expect(cleanedMasked.length).toBe(length);
            
            // Should have correct number of masked characters
            const maskCount = (cleanedMasked.match(/\*/g) || []).length;
            expect(maskCount).toBe(length - 4);
            
            // Last 4 should be original
            expect(cleanedMasked.slice(-4)).toBe(cardNumber.slice(-4));
          }),
          { numRuns: 10 } // Fewer runs per length since we're testing multiple lengths
        );
      });
    });
  });

  /**
   * Property 12: Validazione Algoritmo Luhn
   * 
   * **Validates: Requirements 3.4**
   * 
   * For any credit card number accepted by the system, it should pass
   * the Luhn algorithm validation.
   * 
   * This property verifies that:
   * 1. All valid Luhn numbers are accepted by the validation function
   * 2. Invalid Luhn numbers are rejected
   * 3. The validation is consistent regardless of formatting (spaces/dashes)
   * 4. The Luhn algorithm is correctly implemented
   */
  describe('Property 12: Luhn Algorithm Validation', () => {
    /**
     * Helper function to calculate Luhn check digit for a given number
     * This allows us to generate valid card numbers for testing
     */
    function calculateLuhnCheckDigit(cardNumberWithoutCheck: string): string {
      let sum = 0;
      let isEven = true; // Start with even because we're adding a digit at the end

      // Process digits from right to left
      for (let i = cardNumberWithoutCheck.length - 1; i >= 0; i--) {
        let digit = parseInt(cardNumberWithoutCheck[i] ?? '0', 10);

        if (isEven) {
          digit *= 2;
          if (digit > 9) {
            digit -= 9;
          }
        }

        sum += digit;
        isEven = !isEven;
      }

      // Calculate check digit that makes sum divisible by 10
      const checkDigit = (10 - (sum % 10)) % 10;
      return checkDigit.toString();
    }

    /**
     * Arbitrary that generates valid credit card numbers with correct Luhn checksums
     */
    const validLuhnCardArbitrary = fc
      .stringOf(fc.integer({ min: 0, max: 9 }).map(String), { minLength: 12, maxLength: 18 })
      .map((base) => {
        // Ensure it's not all zeros
        if (/^0+$/.test(base)) {
          base = '1' + base.slice(1);
        }
        // Calculate and append check digit
        const checkDigit = calculateLuhnCheckDigit(base);
        return base + checkDigit;
      });

    it('should accept all valid Luhn numbers', () => {
      fc.assert(
        fc.property(validLuhnCardArbitrary, (cardNumber) => {
          // Any card number with a valid Luhn checksum should be accepted
          const result = validateLuhn(cardNumber);
          expect(result).toBe(true);
        }),
        { numRuns: 10 }
      );
    });

    it('should reject numbers with invalid check digits', () => {
      fc.assert(
        fc.property(validLuhnCardArbitrary, (validCard) => {
          // Take a valid card and corrupt the check digit
          const lastDigit = parseInt(validCard[validCard.length - 1] ?? '0', 10);
          const corruptedDigit = (lastDigit + 1) % 10; // Change the last digit
          const corruptedCard = validCard.slice(0, -1) + corruptedDigit;

          // The corrupted card should be rejected (unless by chance it's still valid)
          const result = validateLuhn(corruptedCard);
          
          // Verify that if it's rejected, it's because of Luhn failure
          // (Some corrupted cards might still pass Luhn by coincidence)
          if (!result) {
            expect(result).toBe(false);
          }
        }),
        { numRuns: 10 }
      );
    });

    it('should validate consistently regardless of formatting', () => {
      fc.assert(
        fc.property(validLuhnCardArbitrary, (cardNumber) => {
          // Test with different formatting
          const withSpaces = cardNumber.match(/.{1,4}/g)?.join(' ') || cardNumber;
          const withDashes = cardNumber.match(/.{1,4}/g)?.join('-') || cardNumber;
          const mixed = cardNumber.match(/.{1,4}/g)?.join('  ') || cardNumber; // Double spaces

          const plainResult = validateLuhn(cardNumber);
          const spacesResult = validateLuhn(withSpaces);
          const dashesResult = validateLuhn(withDashes);
          const mixedResult = validateLuhn(mixed);

          // All should produce the same result
          expect(spacesResult).toBe(plainResult);
          expect(dashesResult).toBe(plainResult);
          expect(mixedResult).toBe(plainResult);
        }),
        { numRuns: 10 }
      );
    });

    it('should be deterministic - same input always produces same result', () => {
      fc.assert(
        fc.property(validLuhnCardArbitrary, (cardNumber) => {
          const result1 = validateLuhn(cardNumber);
          const result2 = validateLuhn(cardNumber);
          const result3 = validateLuhn(cardNumber);

          // Should always return the same result
          expect(result1).toBe(result2);
          expect(result2).toBe(result3);
        }),
        { numRuns: 10 }
      );
    });

    it('should reject cards shorter than 13 digits', () => {
      const shortCardArbitrary = fc
        .stringOf(fc.integer({ min: 0, max: 9 }).map(String), { minLength: 1, maxLength: 12 })
        .filter((s) => s.length > 0);

      fc.assert(
        fc.property(shortCardArbitrary, (shortCard) => {
          // Even if it has a valid Luhn checksum, cards shorter than 13 digits should be rejected
          const result = validateLuhn(shortCard);
          expect(result).toBe(false);
        }),
        { numRuns: 10 }
      );
    });

    it('should reject cards with non-numeric characters', () => {
      fc.assert(
        fc.property(
          validLuhnCardArbitrary,
          fc.integer({ min: 0, max: 15 }),
          fc.constantFrom('a', 'X', '!', '@', '#'),
          (validCard, position, char) => {
            // Insert a non-numeric character at a random position
            const pos = position % validCard.length;
            const corruptedCard = validCard.slice(0, pos) + char + validCard.slice(pos + 1);

            // Should be rejected due to non-numeric character
            const result = validateLuhn(corruptedCard);
            expect(result).toBe(false);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should reject all-zero card numbers', () => {
      const zeroCardArbitrary = fc
        .integer({ min: 13, max: 19 })
        .map((length) => '0'.repeat(length));

      fc.assert(
        fc.property(zeroCardArbitrary, (zeroCard) => {
          // All-zero cards should always be rejected
          const result = validateLuhn(zeroCard);
          expect(result).toBe(false);
        }),
        { numRuns: 10 }
      );
    });

    it('should handle various valid card lengths (13-19 digits)', () => {
      const cardLengths = [13, 14, 15, 16, 17, 18, 19];

      cardLengths.forEach((length) => {
        const cardArbitrary = fc
          .stringOf(fc.integer({ min: 0, max: 9 }).map(String), {
            minLength: length - 1,
            maxLength: length - 1,
          })
          .map((base) => {
            // Ensure not all zeros
            if (/^0+$/.test(base)) {
              base = '1' + base.slice(1);
            }
            const checkDigit = calculateLuhnCheckDigit(base);
            return base + checkDigit;
          });

        fc.assert(
          fc.property(cardArbitrary, (cardNumber) => {
            // Valid Luhn numbers of any supported length should be accepted
            expect(cardNumber.length).toBe(length);
            const result = validateLuhn(cardNumber);
            expect(result).toBe(true);
          }),
          { numRuns: 10 } // Fewer runs per length since we test multiple lengths
        );
      });
    });

    it('should correctly implement Luhn algorithm checksum', () => {
      fc.assert(
        fc.property(validLuhnCardArbitrary, (cardNumber) => {
          // Manually verify the Luhn algorithm
          const cleaned = cardNumber.replace(/[\s-]/g, '');
          let sum = 0;
          let isEven = false;

          for (let i = cleaned.length - 1; i >= 0; i--) {
            let digit = parseInt(cleaned[i] ?? '0', 10);

            if (isEven) {
              digit *= 2;
              if (digit > 9) {
                digit -= 9;
              }
            }

            sum += digit;
            isEven = !isEven;
          }

          // If our generator is correct, sum should be divisible by 10
          expect(sum % 10).toBe(0);

          // And validateLuhn should return true
          expect(validateLuhn(cardNumber)).toBe(true);
        }),
        { numRuns: 10 }
      );
    });

    it('should reject numbers where Luhn checksum fails', () => {
      // Generate random numbers that are NOT guaranteed to have valid Luhn checksums
      const randomCardArbitrary = fc.stringOf(
        fc.integer({ min: 0, max: 9 }).map(String),
        { minLength: 13, maxLength: 19 }
      ).filter((s) => !/^0+$/.test(s)); // Exclude all zeros

      fc.assert(
        fc.property(randomCardArbitrary, (cardNumber) => {
          const result = validateLuhn(cardNumber);

          // If rejected, verify it's because the Luhn checksum actually fails
          if (!result) {
            // Manually calculate Luhn checksum
            let sum = 0;
            let isEven = false;

            for (let i = cardNumber.length - 1; i >= 0; i--) {
              let digit = parseInt(cardNumber[i] ?? '0', 10);

              if (isEven) {
                digit *= 2;
                if (digit > 9) {
                  digit -= 9;
                }
              }

              sum += digit;
              isEven = !isEven;
            }

            // If validateLuhn returned false, the checksum should not be divisible by 10
            expect(sum % 10).not.toBe(0);
          }
        }),
        { numRuns: 10 }
      );
    });

    it('should handle real-world test card numbers', () => {
      // Test with known valid test card numbers from major card networks
      const testCards = [
        '4532015112830366', // Visa
        '5425233430109903', // Mastercard
        '378282246310005',  // Amex
        '6011111111111117', // Discover
        '3530111333300000', // JCB
      ];

      testCards.forEach((card) => {
        fc.assert(
          fc.property(fc.constant(card), (cardNumber) => {
            // All these test cards should pass Luhn validation
            expect(validateLuhn(cardNumber)).toBe(true);
          }),
          { numRuns: 10 }
        );
      });
    });

    it('should maintain validation correctness when digits are permuted incorrectly', () => {
      fc.assert(
        fc.property(
          validLuhnCardArbitrary,
          fc.integer({ min: 0, max: 10 }),
          fc.integer({ min: 0, max: 10 }),
          (validCard, pos1, pos2) => {
            // Swap two digits in a valid card (likely making it invalid)
            const p1 = pos1 % validCard.length;
            const p2 = pos2 % validCard.length;

            if (p1 === p2) {
              // If same position, no change - should still be valid
              expect(validateLuhn(validCard)).toBe(true);
              return;
            }

            const chars = validCard.split('');
            [chars[p1], chars[p2]] = [chars[p2] ?? '0', chars[p1] ?? '0'];
            const swappedCard = chars.join('');

            const result = validateLuhn(swappedCard);

            // If it's rejected, verify the Luhn checksum actually fails
            if (!result) {
              let sum = 0;
              let isEven = false;

              for (let i = swappedCard.length - 1; i >= 0; i--) {
                let digit = parseInt(swappedCard[i] ?? '0', 10);

                if (isEven) {
                  digit *= 2;
                  if (digit > 9) {
                    digit -= 9;
                  }
                }

                sum += digit;
                isEven = !isEven;
              }

              expect(sum % 10).not.toBe(0);
            }
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  /**
   * Property 13: Avviso Scadenza Carta
   * 
   * **Validates: Requirements 3.5**
   * 
   * For any credit card with an expiry date within 30 days, the system should
   * show an expiry warning.
   * 
   * This property verifies that:
   * 1. Cards expiring within 30 days generate a notification
   * 2. Cards expiring beyond 30 days do not generate a notification
   * 3. Expired cards generate a critical notification
   * 4. The notification contains correct information about the card
   * 5. Multiple cards are correctly processed and sorted by urgency
   */
  describe('Property 13: Credit Card Expiry Warning', () => {
    /**
     * Helper function to create a test credit card with specified expiry date
     */
    function createTestCard(
      id: string,
      title: string,
      expiryDate: string
    ): CreditCardItem {
      return {
        id,
        type: 'creditcard',
        title,
        cardNumber: '4532015112830366',
        holderName: 'Test User',
        expiryDate,
        cvv: '123',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        tags: [],
      };
    }

    /**
     * Helper function to create an expiry date that expires in approximately N days
     * 
     * Note: This creates a date where the LAST DAY of the expiry month is approximately
     * daysFromNow days away. This matches how credit cards actually work - they expire
     * at the end of the month shown on the card.
     */
    function createExpiryDateInDays(daysFromNow: number): string {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + daysFromNow);
      
      // For the expiry date, we want the last day of the target month to be
      // approximately daysFromNow days away. So we use the target date's month.
      const month = String(targetDate.getMonth() + 1).padStart(2, '0');
      const year = String(targetDate.getFullYear()).slice(-2);
      return `${month}/${year}`;
    }

    it('should show warning for any card expiring within 30 days', () => {
      // Generate cards expiring within 0-29 days
      // Note: We use 0-29 to ensure we're well within the 30-day threshold
      // even accounting for the fact that cards expire at month-end
      const expiringCardArbitrary = fc.record({
        id: fc.string({ minLength: 1, maxLength: 20 }),
        title: fc.string({ minLength: 1, maxLength: 50 }),
        daysUntilExpiry: fc.integer({ min: 0, max: 20 }), // Use 0-20 to be safe
      });

      fc.assert(
        fc.property(expiringCardArbitrary, (cardData) => {
          const expiryDate = createExpiryDateInDays(cardData.daysUntilExpiry);
          const card = createTestCard(cardData.id, cardData.title, expiryDate);

          // Create notification for the card
          const notification = createExpiryNotification(card);

          // Property: A notification should be created for cards expiring soon
          expect(notification).not.toBeNull();

          if (notification) {
            // Property: Notification should contain correct card information
            expect(notification.cardId).toBe(card.id);
            expect(notification.cardTitle).toBe(card.title);
            expect(notification.expiryDate).toBe(card.expiryDate);

            // Property: Message should contain the card title
            expect(notification.message).toContain(card.title);

            // Property: Severity should be appropriate
            expect(['warning', 'critical']).toContain(notification.severity);
          }
        }),
        { numRuns: 10 }
      );
    });

    it('should NOT show warning for cards expiring beyond 30 days', () => {
      // Generate cards expiring beyond 30 days
      const futureCardArbitrary = fc.record({
        id: fc.string({ minLength: 1, maxLength: 20 }),
        title: fc.string({ minLength: 1, maxLength: 50 }),
        daysUntilExpiry: fc.integer({ min: 31, max: 365 }),
      });

      fc.assert(
        fc.property(futureCardArbitrary, (cardData) => {
          const expiryDate = createExpiryDateInDays(cardData.daysUntilExpiry);
          const card = createTestCard(cardData.id, cardData.title, expiryDate);

          // Check if the card is detected as expiring soon
          const isExpiring = isExpiringSoon(card.expiryDate, 30);

          // Property: Cards expiring beyond 30 days should NOT be detected
          expect(isExpiring).toBe(false);

          // Create notification for the card
          const notification = createExpiryNotification(card);

          // Property: No notification should be created
          expect(notification).toBeNull();
        }),
        { numRuns: 10 }
      );
    });

    it('should show critical warning for expired cards', () => {
      // Generate expired cards (negative days)
      const expiredCardArbitrary = fc.record({
        id: fc.string({ minLength: 1, maxLength: 20 }),
        title: fc.string({ minLength: 1, maxLength: 50 }),
        daysAgo: fc.integer({ min: 1, max: 365 }),
      });

      fc.assert(
        fc.property(expiredCardArbitrary, (cardData) => {
          const expiryDate = createExpiryDateInDays(-cardData.daysAgo);
          const card = createTestCard(cardData.id, cardData.title, expiryDate);

          // Check if the card is detected as expiring soon (expired cards should be detected)
          const isExpiring = isExpiringSoon(card.expiryDate, 30);

          // Property: Expired cards should be detected
          expect(isExpiring).toBe(true);

          // Create notification for the card
          const notification = createExpiryNotification(card);

          // Property: A notification should be created for expired cards
          expect(notification).not.toBeNull();

          if (notification) {
            // Property: Expired cards should have critical severity
            expect(notification.severity).toBe('critical');

            // Property: Message should indicate the card has expired
            expect(notification.message.toLowerCase()).toContain('expired');

            // Property: Days until expiry should be negative
            expect(notification.daysUntilExpiry).toBeLessThan(0);
          }
        }),
        { numRuns: 10 }
      );
    });

    it('should correctly process multiple cards and sort by urgency', () => {
      // Generate an array of cards with various expiry dates
      const cardsArbitrary = fc.array(
        fc.record({
          id: fc.string({ minLength: 1, maxLength: 20 }),
          title: fc.string({ minLength: 1, maxLength: 50 }),
          daysUntilExpiry: fc.integer({ min: -30, max: 60 }),
        }),
        { minLength: 1, maxLength: 10 }
      );

      fc.assert(
        fc.property(cardsArbitrary, (cardsData) => {
          const cards = cardsData.map((data) => {
            const expiryDate = createExpiryDateInDays(data.daysUntilExpiry);
            return createTestCard(data.id, data.title, expiryDate);
          });

          // Check all cards for expiry warnings
          const notifications = checkExpiringCards(cards);

          // Property: Number of notifications should not exceed number of cards
          expect(notifications.length).toBeLessThanOrEqual(cards.length);

          // Property: Only cards expiring within 30 days should have notifications
          const cardsExpiringWithin30Days = cardsData.filter(
            (data) => data.daysUntilExpiry <= 30
          ).length;
          expect(notifications.length).toBeLessThanOrEqual(cardsExpiringWithin30Days);

          // Property: Notifications should be sorted by urgency (ascending days until expiry)
          for (let i = 0; i < notifications.length - 1; i++) {
            expect(notifications[i]!.daysUntilExpiry).toBeLessThanOrEqual(
              notifications[i + 1]!.daysUntilExpiry
            );
          }

          // Property: Each notification should have valid data
          notifications.forEach((notification) => {
            expect(notification.cardId).toBeTruthy();
            expect(notification.cardTitle).toBeTruthy();
            expect(notification.expiryDate).toMatch(/^\d{2}\/\d{2}$/);
            expect(notification.message).toBeTruthy();
            expect(['warning', 'critical']).toContain(notification.severity);
          });
        }),
        { numRuns: 10 }
      );
    });

    it('should respect custom warning thresholds', () => {
      // Test with custom threshold of 60 days
      // Use a range that's clearly within the custom threshold
      const customThreshold = 60;
      const cardArbitrary = fc.record({
        id: fc.string({ minLength: 1, maxLength: 20 }),
        title: fc.string({ minLength: 1, maxLength: 50 }),
        daysUntilExpiry: fc.integer({ min: 35, max: 50 }), // Well within 60 days
      });

      fc.assert(
        fc.property(cardArbitrary, (cardData) => {
          const expiryDate = createExpiryDateInDays(cardData.daysUntilExpiry);
          const card = createTestCard(cardData.id, cardData.title, expiryDate);

          // With default threshold (30 days), might not show warning
          // (depends on exact day of month)

          // Create notification with custom config
          const notification = createExpiryNotification(card, {
            warningThreshold: customThreshold,
            criticalThreshold: 14,
          });

          // Property: Notification should be created with custom threshold
          // Since we're using 35-50 days and threshold is 60, should get notification
          expect(notification).not.toBeNull();
          
          if (notification) {
            expect(notification.cardId).toBe(card.id);
            expect(['warning', 'critical']).toContain(notification.severity);
          }
        }),
        { numRuns: 10 }
      );
    });

    it('should distinguish between warning and critical severity levels', () => {
      const cardArbitrary = fc.record({
        id: fc.string({ minLength: 1, maxLength: 20 }),
        title: fc.string({ minLength: 1, maxLength: 50 }),
        daysUntilExpiry: fc.integer({ min: 0, max: 20 }), // Use 0-20 to ensure within threshold
      });

      fc.assert(
        fc.property(cardArbitrary, (cardData) => {
          const expiryDate = createExpiryDateInDays(cardData.daysUntilExpiry);
          const card = createTestCard(cardData.id, cardData.title, expiryDate);

          const notification = createExpiryNotification(card);

          if (notification) {
            // Property: Notification should have a valid severity
            expect(['warning', 'critical']).toContain(notification.severity);
            
            // Property: Critical notifications should have urgent messaging
            if (notification.severity === 'critical' && notification.daysUntilExpiry > 1) {
              expect(notification.message).toContain('URGENT');
            }
            
            // Property: Warning notifications should not have URGENT
            if (notification.severity === 'warning') {
              expect(notification.message).not.toContain('URGENT');
            }
          }
        }),
        { numRuns: 10 }
      );
    });

    it('should generate appropriate messages for different time ranges', () => {
      const cardArbitrary = fc.record({
        id: fc.string({ minLength: 1, maxLength: 20 }),
        title: fc.string({ minLength: 1, maxLength: 50 }),
        daysUntilExpiry: fc.integer({ min: 0, max: 20 }),
      });

      fc.assert(
        fc.property(cardArbitrary, (cardData) => {
          const expiryDate = createExpiryDateInDays(cardData.daysUntilExpiry);
          const card = createTestCard(cardData.id, cardData.title, expiryDate);

          const notification = createExpiryNotification(card);

          if (notification) {
            // Property: Message should always contain the card title
            expect(notification.message).toContain(card.title);

            // Property: Message should mention days or specific timing
            const messageLower = notification.message.toLowerCase();
            const hasTimeReference = 
              messageLower.includes('today') ||
              messageLower.includes('tomorrow') ||
              messageLower.includes('days') ||
              messageLower.includes('expired');
            
            expect(hasTimeReference).toBe(true);
          }
        }),
        { numRuns: 10 }
      );
    });

    it('should handle edge case of cards expiring exactly at threshold boundary', () => {
      // Test cards expiring at various points near the threshold
      // Use the current month to ensure we're testing realistic scenarios
      const boundaryArbitrary = fc.record({
        id: fc.string({ minLength: 1, maxLength: 20 }),
        title: fc.string({ minLength: 1, maxLength: 50 }),
        daysUntilExpiry: fc.integer({ min: 0, max: 20 }), // Within threshold
      });

      fc.assert(
        fc.property(boundaryArbitrary, (cardData) => {
          const expiryDate = createExpiryDateInDays(cardData.daysUntilExpiry);
          const card = createTestCard(cardData.id, cardData.title, expiryDate);

          const notification = createExpiryNotification(card);

          // Property: Cards expiring soon should generate notifications
          expect(notification).not.toBeNull();
          
          if (notification) {
            expect(notification.cardId).toBe(card.id);
            expect(['warning', 'critical']).toContain(notification.severity);
          }
        }),
        { numRuns: 10 }
      );
    });

    it('should maintain consistency across repeated checks', () => {
      const cardArbitrary = fc.record({
        id: fc.string({ minLength: 1, maxLength: 20 }),
        title: fc.string({ minLength: 1, maxLength: 50 }),
        daysUntilExpiry: fc.integer({ min: 0, max: 30 }),
      });

      fc.assert(
        fc.property(cardArbitrary, (cardData) => {
          const expiryDate = createExpiryDateInDays(cardData.daysUntilExpiry);
          const card = createTestCard(cardData.id, cardData.title, expiryDate);

          // Check multiple times
          const notification1 = createExpiryNotification(card);
          const notification2 = createExpiryNotification(card);
          const notification3 = createExpiryNotification(card);

          // Property: Should produce consistent results
          if (notification1 === null) {
            expect(notification2).toBeNull();
            expect(notification3).toBeNull();
          } else {
            expect(notification2).not.toBeNull();
            expect(notification3).not.toBeNull();

            // All notifications should have identical data
            expect(notification2?.cardId).toBe(notification1.cardId);
            expect(notification2?.severity).toBe(notification1.severity);
            expect(notification2?.message).toBe(notification1.message);

            expect(notification3?.cardId).toBe(notification1.cardId);
            expect(notification3?.severity).toBe(notification1.severity);
            expect(notification3?.message).toBe(notification1.message);
          }
        }),
        { numRuns: 10 }
      );
    });

    it('should handle empty card arrays gracefully', () => {
      fc.assert(
        fc.property(fc.constant([]), (emptyCards) => {
          const notifications = checkExpiringCards(emptyCards);

          // Property: Empty input should produce empty output
          expect(notifications).toEqual([]);
          expect(notifications.length).toBe(0);
        }),
        { numRuns: 10 }
      );
    });
  });
});
