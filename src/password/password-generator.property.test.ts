/**
 * Password Generator Property-Based Tests
 * 
 * Property-based tests using fast-check to verify password generator
 * correctness across all valid configurations.
 * 
 * Feature: password-manager-app
 */

import * as fc from 'fast-check';
import { PasswordGenerator } from './password-generator';
import { GeneratorOptions, CHARACTER_SETS } from './types';

describe('PasswordGenerator - Property-Based Tests', () => {
  let generator: PasswordGenerator;

  beforeEach(() => {
    generator = new PasswordGenerator();
  });

  /**
   * Property 8: Configurazione Generatore Password
   * 
   * **Validates: Requirements 2.3, 2.4**
   * 
   * For any valid generator configuration (length 8-64, character sets),
   * the generated password should respect exactly that configuration.
   * 
   * This property verifies that:
   * 1. Generated password has exactly the requested length
   * 2. Generated password contains only characters from the selected character sets
   * 3. Generated password contains at least one character from each selected set
   * 4. Excluded characters (similar/ambiguous) are not present when requested
   */
  describe('Property 8: Password Generator Configuration', () => {
    it('should generate passwords that exactly match the configuration', () => {
      // Arbitrary for valid generator options
      const validOptionsArbitrary = fc.record({
        length: fc.integer({ min: 8, max: 64 }),
        includeUppercase: fc.boolean(),
        includeLowercase: fc.boolean(),
        includeNumbers: fc.boolean(),
        includeSymbols: fc.boolean(),
        excludeSimilar: fc.boolean(),
        excludeAmbiguous: fc.boolean()
      }).filter(options => 
        // Ensure at least one character type is selected
        options.includeUppercase || 
        options.includeLowercase || 
        options.includeNumbers || 
        options.includeSymbols
      );

      fc.assert(
        fc.property(validOptionsArbitrary, (options: GeneratorOptions) => {
          // Generate password with the given options
          const password = generator.generate(options);

          // Property 1: Password has exactly the requested length
          expect(password.length).toBe(options.length);

          // Build expected character set
          let expectedCharset = '';
          if (options.includeUppercase) {
            expectedCharset += CHARACTER_SETS.uppercase;
          }
          if (options.includeLowercase) {
            expectedCharset += CHARACTER_SETS.lowercase;
          }
          if (options.includeNumbers) {
            expectedCharset += CHARACTER_SETS.numbers;
          }
          if (options.includeSymbols) {
            expectedCharset += CHARACTER_SETS.symbols;
          }

          // Remove excluded characters
          if (options.excludeSimilar) {
            expectedCharset = expectedCharset
              .split('')
              .filter(char => !CHARACTER_SETS.similar.includes(char))
              .join('');
          }
          if (options.excludeAmbiguous) {
            expectedCharset = expectedCharset
              .split('')
              .filter(char => !CHARACTER_SETS.ambiguous.includes(char))
              .join('');
          }

          // Property 2: All characters in password are from the expected charset
          for (const char of password) {
            expect(expectedCharset).toContain(char);
          }

          // Property 3: Password contains at least one character from each selected set
          if (options.includeUppercase) {
            const uppercaseChars = options.excludeSimilar
              ? CHARACTER_SETS.uppercase.split('').filter(c => !CHARACTER_SETS.similar.includes(c))
              : CHARACTER_SETS.uppercase.split('');
            const hasUppercase = password.split('').some(char => uppercaseChars.includes(char));
            expect(hasUppercase).toBe(true);
          }

          if (options.includeLowercase) {
            const lowercaseChars = options.excludeSimilar
              ? CHARACTER_SETS.lowercase.split('').filter(c => !CHARACTER_SETS.similar.includes(c))
              : CHARACTER_SETS.lowercase.split('');
            const hasLowercase = password.split('').some(char => lowercaseChars.includes(char));
            expect(hasLowercase).toBe(true);
          }

          if (options.includeNumbers) {
            const numberChars = options.excludeSimilar
              ? CHARACTER_SETS.numbers.split('').filter(c => !CHARACTER_SETS.similar.includes(c))
              : CHARACTER_SETS.numbers.split('');
            const hasNumbers = password.split('').some(char => numberChars.includes(char));
            expect(hasNumbers).toBe(true);
          }

          if (options.includeSymbols) {
            const symbolChars = options.excludeAmbiguous
              ? CHARACTER_SETS.symbols.split('').filter(c => !CHARACTER_SETS.ambiguous.includes(c))
              : CHARACTER_SETS.symbols.split('');
            const hasSymbols = password.split('').some(char => symbolChars.includes(char));
            expect(hasSymbols).toBe(true);
          }

          // Property 4: Excluded characters are not present
          if (options.excludeSimilar) {
            for (const char of CHARACTER_SETS.similar) {
              expect(password).not.toContain(char);
            }
          }

          if (options.excludeAmbiguous) {
            for (const char of CHARACTER_SETS.ambiguous) {
              expect(password).not.toContain(char);
            }
          }
        }),
        { numRuns: 10 }
      );
    });

    it('should generate passwords with minimum length (8 characters)', () => {
      const minLengthOptionsArbitrary = fc.record({
        length: fc.constant(8),
        includeUppercase: fc.boolean(),
        includeLowercase: fc.boolean(),
        includeNumbers: fc.boolean(),
        includeSymbols: fc.boolean(),
        excludeSimilar: fc.boolean(),
        excludeAmbiguous: fc.boolean()
      }).filter(options => 
        options.includeUppercase || 
        options.includeLowercase || 
        options.includeNumbers || 
        options.includeSymbols
      );

      fc.assert(
        fc.property(minLengthOptionsArbitrary, (options: GeneratorOptions) => {
          const password = generator.generate(options);
          expect(password.length).toBe(8);
        }),
        { numRuns: 10 }
      );
    });

    it('should generate passwords with maximum length (64 characters)', () => {
      const maxLengthOptionsArbitrary = fc.record({
        length: fc.constant(64),
        includeUppercase: fc.boolean(),
        includeLowercase: fc.boolean(),
        includeNumbers: fc.boolean(),
        includeSymbols: fc.boolean(),
        excludeSimilar: fc.boolean(),
        excludeAmbiguous: fc.boolean()
      }).filter(options => 
        options.includeUppercase || 
        options.includeLowercase || 
        options.includeNumbers || 
        options.includeSymbols
      );

      fc.assert(
        fc.property(maxLengthOptionsArbitrary, (options: GeneratorOptions) => {
          const password = generator.generate(options);
          expect(password.length).toBe(64);
        }),
        { numRuns: 10 }
      );
    });

    it('should generate passwords with single character type', () => {
      const singleTypeArbitrary = fc.oneof(
        fc.record({
          length: fc.integer({ min: 8, max: 64 }),
          includeUppercase: fc.constant(true),
          includeLowercase: fc.constant(false),
          includeNumbers: fc.constant(false),
          includeSymbols: fc.constant(false),
          excludeSimilar: fc.boolean(),
          excludeAmbiguous: fc.boolean()
        }),
        fc.record({
          length: fc.integer({ min: 8, max: 64 }),
          includeUppercase: fc.constant(false),
          includeLowercase: fc.constant(true),
          includeNumbers: fc.constant(false),
          includeSymbols: fc.constant(false),
          excludeSimilar: fc.boolean(),
          excludeAmbiguous: fc.boolean()
        }),
        fc.record({
          length: fc.integer({ min: 8, max: 64 }),
          includeUppercase: fc.constant(false),
          includeLowercase: fc.constant(false),
          includeNumbers: fc.constant(true),
          includeSymbols: fc.constant(false),
          excludeSimilar: fc.boolean(),
          excludeAmbiguous: fc.boolean()
        }),
        fc.record({
          length: fc.integer({ min: 8, max: 64 }),
          includeUppercase: fc.constant(false),
          includeLowercase: fc.constant(false),
          includeNumbers: fc.constant(false),
          includeSymbols: fc.constant(true),
          excludeSimilar: fc.boolean(),
          excludeAmbiguous: fc.boolean()
        })
      );

      fc.assert(
        fc.property(singleTypeArbitrary, (options: GeneratorOptions) => {
          const password = generator.generate(options);
          expect(password.length).toBe(options.length);

          // Verify only the selected character type is present
          if (options.includeUppercase) {
            const uppercaseChars = options.excludeSimilar
              ? CHARACTER_SETS.uppercase.split('').filter(c => !CHARACTER_SETS.similar.includes(c))
              : CHARACTER_SETS.uppercase.split('');
            for (const char of password) {
              expect(uppercaseChars).toContain(char);
            }
          } else if (options.includeLowercase) {
            const lowercaseChars = options.excludeSimilar
              ? CHARACTER_SETS.lowercase.split('').filter(c => !CHARACTER_SETS.similar.includes(c))
              : CHARACTER_SETS.lowercase.split('');
            for (const char of password) {
              expect(lowercaseChars).toContain(char);
            }
          } else if (options.includeNumbers) {
            const numberChars = options.excludeSimilar
              ? CHARACTER_SETS.numbers.split('').filter(c => !CHARACTER_SETS.similar.includes(c))
              : CHARACTER_SETS.numbers.split('');
            for (const char of password) {
              expect(numberChars).toContain(char);
            }
          } else if (options.includeSymbols) {
            const symbolChars = options.excludeAmbiguous
              ? CHARACTER_SETS.symbols.split('').filter(c => !CHARACTER_SETS.ambiguous.includes(c))
              : CHARACTER_SETS.symbols.split('');
            for (const char of password) {
              expect(symbolChars).toContain(char);
            }
          }
        }),
        { numRuns: 10 }
      );
    });

    it('should generate passwords with all character types enabled', () => {
      const allTypesArbitrary = fc.record({
        length: fc.integer({ min: 8, max: 64 }),
        includeUppercase: fc.constant(true),
        includeLowercase: fc.constant(true),
        includeNumbers: fc.constant(true),
        includeSymbols: fc.constant(true),
        excludeSimilar: fc.boolean(),
        excludeAmbiguous: fc.boolean()
      });

      fc.assert(
        fc.property(allTypesArbitrary, (options: GeneratorOptions) => {
          const password = generator.generate(options);
          expect(password.length).toBe(options.length);

          // Verify all character types are present
          const uppercaseChars = options.excludeSimilar
            ? CHARACTER_SETS.uppercase.split('').filter(c => !CHARACTER_SETS.similar.includes(c))
            : CHARACTER_SETS.uppercase.split('');
          const hasUppercase = password.split('').some(char => uppercaseChars.includes(char));
          expect(hasUppercase).toBe(true);

          const lowercaseChars = options.excludeSimilar
            ? CHARACTER_SETS.lowercase.split('').filter(c => !CHARACTER_SETS.similar.includes(c))
            : CHARACTER_SETS.lowercase.split('');
          const hasLowercase = password.split('').some(char => lowercaseChars.includes(char));
          expect(hasLowercase).toBe(true);

          const numberChars = options.excludeSimilar
            ? CHARACTER_SETS.numbers.split('').filter(c => !CHARACTER_SETS.similar.includes(c))
            : CHARACTER_SETS.numbers.split('');
          const hasNumbers = password.split('').some(char => numberChars.includes(char));
          expect(hasNumbers).toBe(true);

          const symbolChars = options.excludeAmbiguous
            ? CHARACTER_SETS.symbols.split('').filter(c => !CHARACTER_SETS.ambiguous.includes(c))
            : CHARACTER_SETS.symbols.split('');
          const hasSymbols = password.split('').some(char => symbolChars.includes(char));
          expect(hasSymbols).toBe(true);
        }),
        { numRuns: 10 }
      );
    });
  });
});
