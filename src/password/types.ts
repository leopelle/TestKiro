/**
 * Password Generator Types
 * 
 * Types and interfaces for password generation functionality
 */

/**
 * Options for password generation
 */
export interface GeneratorOptions {
  /** Password length (8-64 characters) */
  length: number;
  /** Include uppercase letters (A-Z) */
  includeUppercase: boolean;
  /** Include lowercase letters (a-z) */
  includeLowercase: boolean;
  /** Include numbers (0-9) */
  includeNumbers: boolean;
  /** Include symbols (!@#$%^&*()_+-=[]{}|;:,.<>?) */
  includeSymbols: boolean;
  /** Exclude similar characters (i, l, 1, L, o, 0, O) */
  excludeSimilar: boolean;
  /** Exclude ambiguous characters ({}[]()/\'"~,;:.<>) */
  excludeAmbiguous: boolean;
}

/**
 * Password strength levels
 */
export enum PasswordStrengthLevel {
  VERY_WEAK = 'very_weak',
  WEAK = 'weak',
  MODERATE = 'moderate',
  STRONG = 'strong',
  VERY_STRONG = 'very_strong'
}

/**
 * Password strength analysis result
 */
export interface PasswordStrength {
  /** Strength level */
  level: PasswordStrengthLevel;
  /** Numeric score (0-100) */
  score: number;
  /** Estimated entropy in bits */
  entropy: number;
  /** Feedback messages for improvement */
  feedback: string[];
}

/**
 * Character sets for password generation
 */
export const CHARACTER_SETS = {
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  numbers: '0123456789',
  symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?',
  similar: 'il1Lo0O',
  ambiguous: '{}[]()/\'"~,;:.<>'
} as const;
