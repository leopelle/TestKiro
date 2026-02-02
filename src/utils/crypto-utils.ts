/**
 * Cryptographic utility functions
 * 
 * This module provides low-level cryptographic utilities that are used
 * by the main crypto engine. All functions use the Web Crypto API.
 */

import { CONFIG } from '../types/common';
import { KeyDerivationParams, EncryptionParams } from '../types/crypto';

/**
 * Default key derivation parameters
 */
export const DEFAULT_KEY_DERIVATION: KeyDerivationParams = {
  salt: new Uint8Array(CONFIG.SALT_LENGTH),
  iterations: CONFIG.PBKDF2_ITERATIONS,
  hash: 'SHA-256',
  keyLength: CONFIG.AES_KEY_LENGTH,
} as const;

/**
 * Default encryption parameters
 */
export const DEFAULT_ENCRYPTION: EncryptionParams = {
  algorithm: 'AES-GCM',
  keyLength: CONFIG.AES_KEY_LENGTH,
  ivLength: CONFIG.IV_LENGTH,
  tagLength: 128,
} as const;

/**
 * Generates a cryptographically secure random salt
 */
export function generateSalt(length: number = CONFIG.SALT_LENGTH): Uint8Array {
  if (length <= 0) {
    throw new Error('Salt length must be positive');
  }
  return crypto.getRandomValues(new Uint8Array(length));
}

/**
 * Generates a cryptographically secure random IV
 */
export function generateIV(length: number = CONFIG.IV_LENGTH): Uint8Array {
  if (length <= 0) {
    throw new Error('IV length must be positive');
  }
  return crypto.getRandomValues(new Uint8Array(length));
}

/**
 * Derives a CryptoKey from a password using PBKDF2
 */
export async function deriveKeyFromPassword(
  password: string,
  salt: Uint8Array,
  params: Partial<KeyDerivationParams> = {}
): Promise<CryptoKey> {
  const derivationParams: KeyDerivationParams = {
    ...DEFAULT_KEY_DERIVATION,
    salt,
    ...params,
  };

  // Import the password as key material
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  // Derive the actual encryption key
  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: derivationParams.salt as BufferSource,
      iterations: derivationParams.iterations,
      hash: derivationParams.hash,
    },
    passwordKey,
    {
      name: 'AES-GCM',
      length: derivationParams.keyLength,
    },
    false, // Not extractable for security
    ['encrypt', 'decrypt']
  );

  return derivedKey;
}

/**
 * Encrypts data using AES-256-GCM
 */
export async function encryptData(
  data: Uint8Array,
  key: CryptoKey,
  iv?: Uint8Array
): Promise<{ ciphertext: Uint8Array; iv: Uint8Array; authTag: Uint8Array }> {
  const actualIV = iv || generateIV();

  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: actualIV as BufferSource,
    },
    key,
    data as BufferSource
  );

  // AES-GCM returns ciphertext + auth tag combined
  const encryptedArray = new Uint8Array(encrypted);
  const ciphertext = encryptedArray.slice(0, -16); // All but last 16 bytes
  const authTag = encryptedArray.slice(-16); // Last 16 bytes

  return {
    ciphertext,
    iv: actualIV,
    authTag,
  };
}

/**
 * Decrypts data using AES-256-GCM
 */
export async function decryptData(
  ciphertext: Uint8Array,
  key: CryptoKey,
  iv: Uint8Array,
  authTag: Uint8Array
): Promise<Uint8Array> {
  // Combine ciphertext and auth tag for Web Crypto API
  const combined = new Uint8Array(ciphertext.length + authTag.length);
  combined.set(ciphertext);
  combined.set(authTag, ciphertext.length);

  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv as BufferSource,
    },
    key,
    combined as BufferSource
  );

  return new Uint8Array(decrypted);
}

/**
 * Validates that a CryptoKey is suitable for AES-GCM operations
 */
export function validateCryptoKey(key: CryptoKey): boolean {
  return (
    key.type === 'secret' &&
    key.algorithm.name === 'AES-GCM' &&
    key.usages.includes('encrypt') &&
    key.usages.includes('decrypt')
  );
}

/**
 * Securely compares two Uint8Arrays in constant time
 * This is a re-export from secure-memory for convenience
 */
export { constantTimeEquals } from './secure-memory';

/**
 * Converts a string to Uint8Array using UTF-8 encoding
 */
export function stringToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

/**
 * Converts Uint8Array to string using UTF-8 decoding
 */
export function bytesToString(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

/**
 * Validates PIN format (4-8 digits)
 */
export function validatePIN(pin: string): boolean {
  if (!pin || typeof pin !== 'string') {
    return false;
  }
  
  const length = pin.length;
  if (length < CONFIG.PIN_MIN_LENGTH || length > CONFIG.PIN_MAX_LENGTH) {
    return false;
  }
  
  // Check that all characters are digits
  return /^\d+$/.test(pin);
}

/**
 * Generates a random PIN for testing purposes
 */
export function generateRandomPIN(): string {
  const length = Math.floor(Math.random() * (CONFIG.PIN_MAX_LENGTH - CONFIG.PIN_MIN_LENGTH + 1)) + CONFIG.PIN_MIN_LENGTH;
  let pin = '';
  for (let i = 0; i < length; i++) {
    pin += Math.floor(Math.random() * 10).toString();
  }
  return pin;
}