/**
 * Cryptographic type definitions for the Password Manager application
 */

/**
 * Encrypted data structure containing all necessary components
 */
export interface EncryptedData {
  readonly ciphertext: Uint8Array;
  readonly iv: Uint8Array;
  readonly authTag: Uint8Array;
  readonly salt?: Uint8Array; // Optional salt for key derivation
}

/**
 * Key derivation parameters
 */
export interface KeyDerivationParams {
  readonly salt: Uint8Array;
  readonly iterations: number;
  readonly hash: 'SHA-256' | 'SHA-512';
  readonly keyLength: 256 | 512;
}

/**
 * Encryption algorithm parameters
 */
export interface EncryptionParams {
  readonly algorithm: 'AES-GCM';
  readonly keyLength: 256;
  readonly ivLength: 12;
  readonly tagLength: 128;
}

/**
 * Authentication result for PIN verification
 */
export interface AuthResult {
  readonly success: boolean;
  readonly masterKey?: CryptoKey;
  readonly error?: AuthError;
}

/**
 * Authentication error types
 */
export enum AuthError {
  INVALID_PIN = 'INVALID_PIN',
  TOO_MANY_ATTEMPTS = 'TOO_MANY_ATTEMPTS',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  CRYPTO_ERROR = 'CRYPTO_ERROR',
}

/**
 * Crypto engine interface for encryption/decryption operations
 */
export interface CryptoEngine {
  /**
   * Encrypts data using AES-256-GCM
   */
  encrypt(data: Uint8Array, key: CryptoKey): Promise<EncryptedData>;
  
  /**
   * Decrypts data using AES-256-GCM
   */
  decrypt(encryptedData: EncryptedData, key: CryptoKey): Promise<Uint8Array>;
  
  /**
   * Generates a cryptographically secure salt
   */
  generateSalt(length?: number): Uint8Array;
  
  /**
   * Generates a cryptographically secure IV
   */
  generateIV(length?: number): Uint8Array;
  
  /**
   * Securely wipes sensitive data from memory
   */
  secureWipe(data: Uint8Array): void;
}

/**
 * Authentication service interface
 */
export interface AuthenticationService {
  /**
   * Authenticates user with PIN and returns master key
   */
  authenticate(pin: string): Promise<AuthResult>;
  
  /**
   * Derives master key from PIN and salt using PBKDF2
   */
  deriveMasterKey(pin: string, salt: Uint8Array): Promise<CryptoKey>;
  
  /**
   * Locks the vault and clears sensitive data
   */
  lockVault(): void;
  
  /**
   * Checks if the vault is currently locked
   */
  isLocked(): boolean;
  
  /**
   * Gets the number of failed authentication attempts
   */
  getFailedAttempts(): number;
  
  /**
   * Gets remaining lockout time in milliseconds
   */
  getRemainingLockTime(): number;
  
  /**
   * Resets the auto-lock timer (called on user activity)
   */
  resetAutoLockTimer(): void;
  
  /**
   * Handles application going to background
   */
  handleBackground(): void;
  
  /**
   * Handles application coming to foreground
   */
  handleForeground(): void;
  
  /**
   * Gets the time remaining until auto-lock (in milliseconds)
   */
  getAutoLockTimeRemaining(): number;
}

/**
 * Utility type for secure key material
 */
export interface SecureKeyMaterial {
  readonly key: CryptoKey;
  readonly salt: Uint8Array;
  readonly createdAt: number;
}

/**
 * Crypto operation result type
 */
export type CryptoResult<T> = 
  | { success: true; data: T }
  | { success: false; error: string };