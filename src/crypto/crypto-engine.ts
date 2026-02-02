/**
 * Concrete implementation of the CryptoEngine interface
 * 
 * This module provides the main cryptographic engine for the Password Manager,
 * implementing AES-256-GCM encryption/decryption with secure key handling.
 */

import { CryptoEngine, EncryptedData } from '../types/crypto';
import { CONFIG, PasswordManagerError, ErrorCode } from '../types/common';
import { 
  generateSalt as utilGenerateSalt, 
  generateIV as utilGenerateIV,
  encryptData,
  decryptData,
  validateCryptoKey
} from '../utils/crypto-utils';
import { secureWipe } from '../utils/secure-memory';

/**
 * Default implementation of the CryptoEngine interface
 */
export class DefaultCryptoEngine implements CryptoEngine {
  /**
   * Encrypts data using AES-256-GCM
   * 
   * @param data - The data to encrypt
   * @param key - The encryption key
   * @returns Promise resolving to encrypted data with IV and auth tag
   * @throws PasswordManagerError if encryption fails
   */
  async encrypt(data: Uint8Array, key: CryptoKey): Promise<EncryptedData> {
    try {
      // Validate the key
      if (!validateCryptoKey(key)) {
        throw new PasswordManagerError(
          ErrorCode.ENCRYPTION_FAILED,
          'Invalid CryptoKey provided for encryption'
        );
      }

      // Generate a fresh IV for this encryption
      const iv = this.generateIV();

      // Perform the encryption
      const result = await encryptData(data, key, iv);

      return {
        ciphertext: result.ciphertext,
        iv: result.iv,
        authTag: result.authTag,
      };
    } catch (error) {
      if (error instanceof PasswordManagerError) {
        throw error;
      }
      
      throw new PasswordManagerError(
        ErrorCode.ENCRYPTION_FAILED,
        `Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Decrypts data using AES-256-GCM
   * 
   * @param encryptedData - The encrypted data with IV and auth tag
   * @param key - The decryption key
   * @returns Promise resolving to decrypted data
   * @throws PasswordManagerError if decryption fails
   */
  async decrypt(encryptedData: EncryptedData, key: CryptoKey): Promise<Uint8Array> {
    try {
      // Validate the key
      if (!validateCryptoKey(key)) {
        throw new PasswordManagerError(
          ErrorCode.DECRYPTION_FAILED,
          'Invalid CryptoKey provided for decryption'
        );
      }

      // Validate encrypted data structure
      if (!encryptedData.ciphertext || !encryptedData.iv || !encryptedData.authTag) {
        throw new PasswordManagerError(
          ErrorCode.DECRYPTION_FAILED,
          'Invalid encrypted data structure'
        );
      }

      // Perform the decryption
      const decrypted = await decryptData(
        encryptedData.ciphertext,
        key,
        encryptedData.iv,
        encryptedData.authTag
      );

      return decrypted;
    } catch (error) {
      if (error instanceof PasswordManagerError) {
        throw error;
      }
      
      throw new PasswordManagerError(
        ErrorCode.DECRYPTION_FAILED,
        `Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Generates a cryptographically secure salt
   * 
   * @param length - Optional length for the salt (defaults to CONFIG.SALT_LENGTH)
   * @returns Cryptographically secure random salt
   */
  generateSalt(length: number = CONFIG.SALT_LENGTH): Uint8Array {
    try {
      return utilGenerateSalt(length);
    } catch (error) {
      throw new PasswordManagerError(
        ErrorCode.ENCRYPTION_FAILED,
        `Salt generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Generates a cryptographically secure IV
   * 
   * @param length - Optional length for the IV (defaults to CONFIG.IV_LENGTH)
   * @returns Cryptographically secure random IV
   */
  generateIV(length: number = CONFIG.IV_LENGTH): Uint8Array {
    try {
      return utilGenerateIV(length);
    } catch (error) {
      throw new PasswordManagerError(
        ErrorCode.ENCRYPTION_FAILED,
        `IV generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Securely wipes sensitive data from memory
   * 
   * @param data - The data to wipe
   */
  secureWipe(data: Uint8Array): void {
    secureWipe(data);
  }
}

/**
 * Factory function to create a new CryptoEngine instance
 */
export function createCryptoEngine(): CryptoEngine {
  return new DefaultCryptoEngine();
}

/**
 * Singleton instance for convenience
 */
export const defaultCryptoEngine = createCryptoEngine();