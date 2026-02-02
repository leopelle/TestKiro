/**
 * Password Generator Tests
 * 
 * Unit tests for password generation and strength calculation
 */

import { PasswordGenerator } from './password-generator';
import { GeneratorOptions, PasswordStrengthLevel } from './types';

describe('PasswordGenerator', () => {
  let generator: PasswordGenerator;

  beforeEach(() => {
    generator = new PasswordGenerator();
  });

  describe('validateOptions', () => {
    it('should accept valid options', () => {
      const options: GeneratorOptions = {
        length: 12,
        includeUppercase: true,
        includeLowercase: true,
        includeNumbers: true,
        includeSymbols: true,
        excludeSimilar: false,
        excludeAmbiguous: false
      };
      expect(generator.validateOptions(options)).toBe(true);
    });

    it('should reject length less than 8', () => {
      const options: GeneratorOptions = {
        length: 7,
        includeUppercase: true,
        includeLowercase: true,
        includeNumbers: false,
        includeSymbols: false,
        excludeSimilar: false,
        excludeAmbiguous: false
      };
      expect(generator.validateOptions(options)).toBe(false);
    });

    it('should reject length greater than 64', () => {
      const options: GeneratorOptions = {
        length: 65,
        includeUppercase: true,
        includeLowercase: true,
        includeNumbers: false,
        includeSymbols: false,
        excludeSimilar: false,
        excludeAmbiguous: false
      };
      expect(generator.validateOptions(options)).toBe(false);
    });

    it('should reject options with no character types selected', () => {
      const options: GeneratorOptions = {
        length: 12,
        includeUppercase: false,
        includeLowercase: false,
        includeNumbers: false,
        includeSymbols: false,
        excludeSimilar: false,
        excludeAmbiguous: false
      };
      expect(generator.validateOptions(options)).toBe(false);
    });

    it('should accept minimum length of 8', () => {
      const options: GeneratorOptions = {
        length: 8,
        includeUppercase: true,
        includeLowercase: false,
        includeNumbers: false,
        includeSymbols: false,
        excludeSimilar: false,
        excludeAmbiguous: false
      };
      expect(generator.validateOptions(options)).toBe(true);
    });

    it('should accept maximum length of 64', () => {
      const options: GeneratorOptions = {
        length: 64,
        includeUppercase: true,
        includeLowercase: false,
        includeNumbers: false,
        includeSymbols: false,
        excludeSimilar: false,
        excludeAmbiguous: false
      };
      expect(generator.validateOptions(options)).toBe(true);
    });
  });

  describe('generate', () => {
    it('should generate password with correct length', () => {
      const options: GeneratorOptions = {
        length: 16,
        includeUppercase: true,
        includeLowercase: true,
        includeNumbers: true,
        includeSymbols: true,
        excludeSimilar: false,
        excludeAmbiguous: false
      };
      const password = generator.generate(options);
      expect(password.length).toBe(16);
    });

    it('should generate password with only uppercase letters', () => {
      const options: GeneratorOptions = {
        length: 12,
        includeUppercase: true,
        includeLowercase: false,
        includeNumbers: false,
        includeSymbols: false,
        excludeSimilar: false,
        excludeAmbiguous: false
      };
      const password = generator.generate(options);
      expect(password).toMatch(/^[A-Z]+$/);
      expect(password.length).toBe(12);
    });

    it('should generate password with only lowercase letters', () => {
      const options: GeneratorOptions = {
        length: 12,
        includeUppercase: false,
        includeLowercase: true,
        includeNumbers: false,
        includeSymbols: false,
        excludeSimilar: false,
        excludeAmbiguous: false
      };
      const password = generator.generate(options);
      expect(password).toMatch(/^[a-z]+$/);
      expect(password.length).toBe(12);
    });

    it('should generate password with only numbers', () => {
      const options: GeneratorOptions = {
        length: 12,
        includeUppercase: false,
        includeLowercase: false,
        includeNumbers: true,
        includeSymbols: false,
        excludeSimilar: false,
        excludeAmbiguous: false
      };
      const password = generator.generate(options);
      expect(password).toMatch(/^[0-9]+$/);
      expect(password.length).toBe(12);
    });

    it('should generate password with only symbols', () => {
      const options: GeneratorOptions = {
        length: 12,
        includeUppercase: false,
        includeLowercase: false,
        includeNumbers: false,
        includeSymbols: true,
        excludeSimilar: false,
        excludeAmbiguous: false
      };
      const password = generator.generate(options);
      expect(password).toMatch(/^[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]+$/);
      expect(password.length).toBe(12);
    });

    it('should generate password with mixed character types', () => {
      const options: GeneratorOptions = {
        length: 20,
        includeUppercase: true,
        includeLowercase: true,
        includeNumbers: true,
        includeSymbols: true,
        excludeSimilar: false,
        excludeAmbiguous: false
      };
      const password = generator.generate(options);
      expect(password.length).toBe(20);
      // Should contain at least one of each type
      expect(/[A-Z]/.test(password)).toBe(true);
      expect(/[a-z]/.test(password)).toBe(true);
      expect(/[0-9]/.test(password)).toBe(true);
      expect(/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)).toBe(true);
    });

    it('should exclude similar characters when requested', () => {
      const options: GeneratorOptions = {
        length: 20,
        includeUppercase: true,
        includeLowercase: true,
        includeNumbers: true,
        includeSymbols: false,
        excludeSimilar: true,
        excludeAmbiguous: false
      };
      const password = generator.generate(options);
      // Should not contain i, l, 1, L, o, 0, O
      expect(/[il1Lo0O]/.test(password)).toBe(false);
    });

    it('should exclude ambiguous characters when requested', () => {
      const options: GeneratorOptions = {
        length: 20,
        includeUppercase: true,
        includeLowercase: true,
        includeNumbers: true,
        includeSymbols: true,
        excludeSimilar: false,
        excludeAmbiguous: true
      };
      const password = generator.generate(options);
      // Should not contain {}[]()/\'"~,;:.<>
      expect(/[{}\[\]()/\\'"~,;:.<>]/.test(password)).toBe(false);
    });

    it('should throw error for invalid options', () => {
      const options: GeneratorOptions = {
        length: 5, // Too short
        includeUppercase: true,
        includeLowercase: true,
        includeNumbers: true,
        includeSymbols: true,
        excludeSimilar: false,
        excludeAmbiguous: false
      };
      expect(() => generator.generate(options)).toThrow('Invalid generator options');
    });

    it('should throw error when no character types selected', () => {
      const options: GeneratorOptions = {
        length: 12,
        includeUppercase: false,
        includeLowercase: false,
        includeNumbers: false,
        includeSymbols: false,
        excludeSimilar: false,
        excludeAmbiguous: false
      };
      expect(() => generator.generate(options)).toThrow();
    });

    it('should generate different passwords on multiple calls', () => {
      const options: GeneratorOptions = {
        length: 16,
        includeUppercase: true,
        includeLowercase: true,
        includeNumbers: true,
        includeSymbols: true,
        excludeSimilar: false,
        excludeAmbiguous: false
      };
      const password1 = generator.generate(options);
      const password2 = generator.generate(options);
      const password3 = generator.generate(options);
      
      // Extremely unlikely to generate the same password twice
      expect(password1).not.toBe(password2);
      expect(password2).not.toBe(password3);
      expect(password1).not.toBe(password3);
    });

    it('should generate minimum length password', () => {
      const options: GeneratorOptions = {
        length: 8,
        includeUppercase: true,
        includeLowercase: true,
        includeNumbers: true,
        includeSymbols: true,
        excludeSimilar: false,
        excludeAmbiguous: false
      };
      const password = generator.generate(options);
      expect(password.length).toBe(8);
    });

    it('should generate maximum length password', () => {
      const options: GeneratorOptions = {
        length: 64,
        includeUppercase: true,
        includeLowercase: true,
        includeNumbers: true,
        includeSymbols: true,
        excludeSimilar: false,
        excludeAmbiguous: false
      };
      const password = generator.generate(options);
      expect(password.length).toBe(64);
    });
  });

  describe('calculateStrength', () => {
    it('should rate very weak password correctly', () => {
      const password = 'abc123';
      const strength = generator.calculateStrength(password);
      expect(strength.level).toBe(PasswordStrengthLevel.VERY_WEAK);
      expect(strength.score).toBeLessThan(20);
      expect(strength.feedback.length).toBeGreaterThan(0);
    });

    it('should rate weak password correctly', () => {
      const password = 'password';
      const strength = generator.calculateStrength(password);
      // "password" is actually very weak due to being a common pattern
      expect(strength.level).toBe(PasswordStrengthLevel.VERY_WEAK);
      expect(strength.score).toBeLessThan(40);
      expect(strength.feedback).toContain('Avoid common patterns and sequences');
    });

    it('should rate weak password with some complexity', () => {
      const password = 'Abcdef12';
      const strength = generator.calculateStrength(password);
      expect(strength.level).toBe(PasswordStrengthLevel.WEAK);
      expect(strength.score).toBeGreaterThanOrEqual(20);
      expect(strength.score).toBeLessThan(40);
    });

    it('should rate moderate password correctly', () => {
      const password = 'MyPass123';
      const strength = generator.calculateStrength(password);
      expect(strength.level).toBe(PasswordStrengthLevel.MODERATE);
      expect(strength.score).toBeGreaterThanOrEqual(40);
      expect(strength.score).toBeLessThan(60);
    });

    it('should rate strong password correctly', () => {
      const password = 'MyP@ssw0rd123!';
      const strength = generator.calculateStrength(password);
      // This 14-char password with all character types is actually very strong
      expect(strength.level).toBe(PasswordStrengthLevel.VERY_STRONG);
      expect(strength.score).toBeGreaterThanOrEqual(80);
    });

    it('should rate strong password with good length', () => {
      const password = 'GoodP@ss12';
      const strength = generator.calculateStrength(password);
      expect(strength.level).toBe(PasswordStrengthLevel.STRONG);
      expect(strength.score).toBeGreaterThanOrEqual(60);
      expect(strength.score).toBeLessThan(80);
    });

    it('should rate very strong password correctly', () => {
      const password = 'Tr0ub4dor&3$ecureP@ssw0rd!';
      const strength = generator.calculateStrength(password);
      expect(strength.level).toBe(PasswordStrengthLevel.VERY_STRONG);
      expect(strength.score).toBeGreaterThanOrEqual(80);
    });

    it('should provide feedback for short passwords', () => {
      const password = 'Ab1!';
      const strength = generator.calculateStrength(password);
      expect(strength.feedback).toContain('Password is too short (minimum 8 characters)');
    });

    it('should provide feedback for passwords without uppercase', () => {
      const password = 'mypassword123!';
      const strength = generator.calculateStrength(password);
      expect(strength.feedback).toContain('Add uppercase letters for better security');
    });

    it('should provide feedback for passwords without lowercase', () => {
      const password = 'MYPASSWORD123!';
      const strength = generator.calculateStrength(password);
      expect(strength.feedback).toContain('Add lowercase letters for better security');
    });

    it('should provide feedback for passwords without numbers', () => {
      const password = 'MyPassword!';
      const strength = generator.calculateStrength(password);
      expect(strength.feedback).toContain('Add numbers for better security');
    });

    it('should provide feedback for passwords without symbols', () => {
      const password = 'MyPassword123';
      const strength = generator.calculateStrength(password);
      expect(strength.feedback).toContain('Add symbols for better security');
    });

    it('should detect repeating characters', () => {
      const password = 'Passssword123!';
      const strength = generator.calculateStrength(password);
      expect(strength.feedback).toContain('Avoid repeating characters');
    });

    it('should detect common patterns', () => {
      const password = '123456abc!';
      const strength = generator.calculateStrength(password);
      expect(strength.feedback).toContain('Avoid common patterns and sequences');
    });

    it('should calculate entropy correctly', () => {
      const password = 'Abc123!@#';
      const strength = generator.calculateStrength(password);
      expect(strength.entropy).toBeGreaterThan(0);
      // With uppercase, lowercase, numbers, and symbols, entropy should be significant
      expect(strength.entropy).toBeGreaterThan(40);
    });

    it('should have higher entropy for longer passwords', () => {
      const shortPassword = 'Abc123!@';
      const longPassword = 'Abc123!@#$%^&*()';
      const shortStrength = generator.calculateStrength(shortPassword);
      const longStrength = generator.calculateStrength(longPassword);
      expect(longStrength.entropy).toBeGreaterThan(shortStrength.entropy);
    });

    it('should recommend longer passwords for moderate length', () => {
      const password = 'MyPass123!';
      const strength = generator.calculateStrength(password);
      expect(strength.feedback).toContain('Consider using a longer password (12+ characters recommended)');
    });

    it('should not recommend longer passwords for already long passwords', () => {
      const password = 'MyVeryLongP@ssw0rd123!';
      const strength = generator.calculateStrength(password);
      const hasLengthRecommendation = strength.feedback.some(f => 
        f.includes('Consider using a longer password')
      );
      expect(hasLengthRecommendation).toBe(false);
    });
  });
});
