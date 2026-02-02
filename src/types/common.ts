/**
 * Common type definitions for the Password Manager application
 */

/**
 * Error codes used throughout the application
 */
export enum ErrorCode {
  // Authentication errors
  INVALID_PIN = 'AUTH_001',
  TOO_MANY_ATTEMPTS = 'AUTH_002',
  SESSION_EXPIRED = 'AUTH_003',
  
  // Cryptography errors
  ENCRYPTION_FAILED = 'CRYPTO_001',
  DECRYPTION_FAILED = 'CRYPTO_002',
  KEY_DERIVATION_FAILED = 'CRYPTO_003',
  
  // Storage errors
  STORAGE_FULL = 'STORAGE_001',
  FILE_CORRUPTED = 'STORAGE_002',
  PERMISSION_DENIED = 'STORAGE_003',
  
  // Validation errors
  INVALID_DATA_FORMAT = 'VALIDATION_001',
  FILE_TOO_LARGE = 'VALIDATION_002',
  UNSUPPORTED_FILE_TYPE = 'VALIDATION_003',
}

/**
 * Base error class for the application
 */
export class PasswordManagerError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'PasswordManagerError';
  }
}

/**
 * Result type for operations that can fail
 */
export type Result<T, E = PasswordManagerError> = 
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Utility function to create a success result
 */
export function success<T>(data: T): Result<T> {
  return { success: true, data };
}

/**
 * Utility function to create an error result
 */
export function failure<T>(error: PasswordManagerError): Result<T> {
  return { success: false, error };
}

/**
 * Configuration constants
 */
export const CONFIG = {
  // Security settings
  PIN_MIN_LENGTH: 4,
  PIN_MAX_LENGTH: 8,
  MAX_FAILED_ATTEMPTS: 5,
  LOCKOUT_DURATION_MS: 30 * 60 * 1000, // 30 minutes
  AUTO_LOCK_TIMEOUT_MS: 5 * 60 * 1000, // 5 minutes
  CLIPBOARD_CLEAR_TIMEOUT_MS: 30 * 1000, // 30 seconds
  
  // Cryptography settings
  AES_KEY_LENGTH: 256,
  PBKDF2_ITERATIONS: 100000,
  SALT_LENGTH: 32,
  IV_LENGTH: 12,
  
  // Password generation
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_MAX_LENGTH: 64,
  PASSWORD_HISTORY_LIMIT: 5,
  
  // File handling
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  SUPPORTED_IMAGE_TYPES: ['image/jpeg', 'image/png'],
  SUPPORTED_DOCUMENT_TYPES: ['application/pdf', 'text/plain'],
  
  // Backup settings
  MAX_BACKUP_COUNT: 10,
} as const;

/**
 * Utility type to make all properties of T readonly recursively
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

/**
 * Utility type for optional fields
 */
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Timestamp type for consistent date handling
 */
export type Timestamp = number; // Unix timestamp in milliseconds

/**
 * UUID type for consistent ID handling
 */
export type UUID = string;

/**
 * Base interface for all vault items
 */
export interface BaseVaultItem {
  readonly id: UUID;
  readonly type: string;
  readonly title: string;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
  readonly tags: readonly string[];
  readonly notes?: string;
}