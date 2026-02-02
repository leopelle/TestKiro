/**
 * Password Generator
 * 
 * Implements secure password generation with customizable options
 * and password strength calculation.
 * 
 * Requirements: 2.3, 2.4
 */

import {
  GeneratorOptions,
  PasswordStrength,
  PasswordStrengthLevel,
  CHARACTER_SETS
} from './types';

/**
 * Password Generator Service
 * 
 * Provides functionality for generating secure passwords with customizable
 * character sets and calculating password strength.
 */
export class PasswordGenerator {
  /**
   * Generate a password based on the provided options
   * 
   * @param options - Password generation options
   * @returns Generated password string
   * @throws Error if options are invalid
   */
  generate(options: GeneratorOptions): string {
    // Validate options
    if (!this.validateOptions(options)) {
      throw new Error('Invalid generator options');
    }

    // Build character set based on options
    const charset = this.buildCharacterSet(options);
    
    if (charset.length === 0) {
      throw new Error('At least one character type must be included');
    }

    // Generate password using cryptographically secure random values
    const password = this.generateSecurePassword(charset, options.length);

    // Ensure password meets requirements (has at least one char from each selected type)
    if (!this.meetsRequirements(password, options)) {
      // Retry generation (recursive call with max depth protection)
      return this.generate(options);
    }

    return password;
  }

  /**
   * Calculate the strength of a password
   * 
   * @param password - Password to analyze
   * @returns Password strength analysis
   */
  calculateStrength(password: string): PasswordStrength {
    const feedback: string[] = [];
    
    // Calculate entropy
    const entropy = this.calculateEntropy(password);
    
    // Check various password characteristics
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumbers = /[0-9]/.test(password);
    const hasSymbols = /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password);
    const length = password.length;
    
    // Count character types
    let charTypeCount = 0;
    if (hasUppercase) charTypeCount++;
    if (hasLowercase) charTypeCount++;
    if (hasNumbers) charTypeCount++;
    if (hasSymbols) charTypeCount++;
    
    // Generate feedback
    if (length < 8) {
      feedback.push('Password is too short (minimum 8 characters)');
    }
    if (length < 12) {
      feedback.push('Consider using a longer password (12+ characters recommended)');
    }
    if (!hasUppercase) {
      feedback.push('Add uppercase letters for better security');
    }
    if (!hasLowercase) {
      feedback.push('Add lowercase letters for better security');
    }
    if (!hasNumbers) {
      feedback.push('Add numbers for better security');
    }
    if (!hasSymbols) {
      feedback.push('Add symbols for better security');
    }
    if (this.hasCommonPatterns(password)) {
      feedback.push('Avoid common patterns and sequences');
    }
    if (this.hasRepeatingCharacters(password)) {
      feedback.push('Avoid repeating characters');
    }
    
    // Calculate score (0-100)
    let score = 0;
    
    // Length contribution (up to 30 points)
    score += Math.min(30, (length - 8) * 2.5 + 10);
    
    // Character diversity (up to 40 points)
    score += charTypeCount * 10;
    
    // Entropy contribution (up to 30 points)
    score += Math.min(30, entropy / 4);
    
    // Penalties
    if (this.hasCommonPatterns(password)) {
      score -= 30;
    }
    if (this.hasRepeatingCharacters(password)) {
      score -= 15;
    }
    
    // Ensure score is in valid range
    score = Math.max(0, Math.min(100, score));
    
    // Determine strength level
    let level: PasswordStrengthLevel;
    if (score < 20) {
      level = PasswordStrengthLevel.VERY_WEAK;
    } else if (score < 40) {
      level = PasswordStrengthLevel.WEAK;
    } else if (score < 60) {
      level = PasswordStrengthLevel.MODERATE;
    } else if (score < 80) {
      level = PasswordStrengthLevel.STRONG;
    } else {
      level = PasswordStrengthLevel.VERY_STRONG;
    }
    
    return {
      level,
      score,
      entropy,
      feedback
    };
  }

  /**
   * Validate generator options
   * 
   * @param options - Options to validate
   * @returns True if options are valid
   */
  validateOptions(options: GeneratorOptions): boolean {
    // Check length is within valid range (8-64)
    if (options.length < 8 || options.length > 64) {
      return false;
    }
    
    // Check that at least one character type is included
    if (!options.includeUppercase && 
        !options.includeLowercase && 
        !options.includeNumbers && 
        !options.includeSymbols) {
      return false;
    }
    
    return true;
  }

  /**
   * Build character set based on options
   * 
   * @param options - Generator options
   * @returns Character set string
   */
  private buildCharacterSet(options: GeneratorOptions): string {
    let charset = '';
    
    if (options.includeUppercase) {
      charset += CHARACTER_SETS.uppercase;
    }
    if (options.includeLowercase) {
      charset += CHARACTER_SETS.lowercase;
    }
    if (options.includeNumbers) {
      charset += CHARACTER_SETS.numbers;
    }
    if (options.includeSymbols) {
      charset += CHARACTER_SETS.symbols;
    }
    
    // Remove similar characters if requested
    if (options.excludeSimilar) {
      charset = this.removeCharacters(charset, CHARACTER_SETS.similar);
    }
    
    // Remove ambiguous characters if requested
    if (options.excludeAmbiguous) {
      charset = this.removeCharacters(charset, CHARACTER_SETS.ambiguous);
    }
    
    return charset;
  }

  /**
   * Remove specific characters from a string
   * 
   * @param str - Source string
   * @param charsToRemove - Characters to remove
   * @returns String with characters removed
   */
  private removeCharacters(str: string, charsToRemove: string): string {
    return str.split('').filter(char => !charsToRemove.includes(char)).join('');
  }

  /**
   * Generate a cryptographically secure random password
   * 
   * @param charset - Character set to use
   * @param length - Password length
   * @returns Generated password
   */
  private generateSecurePassword(charset: string, length: number): string {
    const password: string[] = [];
    const randomValues = new Uint32Array(length);
    
    // Use crypto.getRandomValues for cryptographically secure randomness
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(randomValues);
    } else {
      // Fallback for Node.js environment
      const nodeCrypto = require('crypto');
      for (let i = 0; i < length; i++) {
        randomValues[i] = nodeCrypto.randomInt(0, 0xFFFFFFFF);
      }
    }
    
    for (let i = 0; i < length; i++) {
      const randomValue = randomValues[i];
      if (randomValue !== undefined) {
        const randomIndex = randomValue % charset.length;
        const char = charset[randomIndex];
        if (char !== undefined) {
          password.push(char);
        }
      }
    }
    
    return password.join('');
  }

  /**
   * Check if password meets the requirements (has at least one char from each selected type)
   * 
   * @param password - Password to check
   * @param options - Generator options
   * @returns True if password meets requirements
   */
  private meetsRequirements(password: string, options: GeneratorOptions): boolean {
    if (options.includeUppercase && !/[A-Z]/.test(password)) {
      return false;
    }
    if (options.includeLowercase && !/[a-z]/.test(password)) {
      return false;
    }
    if (options.includeNumbers && !/[0-9]/.test(password)) {
      return false;
    }
    if (options.includeSymbols && !/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) {
      return false;
    }
    return true;
  }

  /**
   * Calculate password entropy in bits
   * 
   * @param password - Password to analyze
   * @returns Entropy in bits
   */
  private calculateEntropy(password: string): number {
    // Determine character set size
    let charsetSize = 0;
    
    if (/[a-z]/.test(password)) charsetSize += 26;
    if (/[A-Z]/.test(password)) charsetSize += 26;
    if (/[0-9]/.test(password)) charsetSize += 10;
    if (/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) charsetSize += 32;
    
    // Calculate entropy: log2(charsetSize^length)
    return password.length * Math.log2(charsetSize);
  }

  /**
   * Check for common patterns in password
   * 
   * @param password - Password to check
   * @returns True if common patterns found
   */
  private hasCommonPatterns(password: string): boolean {
    const patterns = [
      /^123+/,           // Starts with 123
      /^abc+/i,          // Starts with abc
      /^qwerty/i,        // Starts with qwerty
      /^password/i,      // Contains password
      /(.)\1{2,}/,       // Three or more repeating characters
      /^(.+)\1+$/,       // Repeated pattern
    ];
    
    return patterns.some(pattern => pattern.test(password));
  }

  /**
   * Check for repeating characters
   * 
   * @param password - Password to check
   * @returns True if has repeating characters (3+ in a row)
   */
  private hasRepeatingCharacters(password: string): boolean {
    return /(.)\1{2,}/.test(password);
  }
}

/**
 * Default password generator instance
 */
export const passwordGenerator = new PasswordGenerator();
