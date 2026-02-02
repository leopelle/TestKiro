/**
 * Secure Memory Utilities
 * 
 * Provides utilities for secure handling of sensitive data in memory,
 * including secure wiping and protected storage.
 */

/**
 * Securely wipes a Uint8Array by overwriting it with random data
 * and then zeros. This helps prevent sensitive data from remaining
 * in memory after use.
 */
export function secureWipe(data: Uint8Array): void {
  if (!data || data.length === 0) {
    return;
  }

  // First pass: fill with random data
  const randomData = new Uint8Array(data.length);
  crypto.getRandomValues(randomData);
  data.set(randomData);

  // Second pass: fill with zeros
  data.fill(0);

  // Third pass: fill with 0xFF
  data.fill(0xFF);

  // Final pass: fill with zeros
  data.fill(0);
}

/**
 * Securely wipes a string by converting it to a Uint8Array and wiping it.
 * Note: This doesn't guarantee the original string is wiped from memory
 * due to JavaScript's string immutability, but it's a best effort.
 */
export function secureWipeString(str: string): void {
  if (!str) {
    return;
  }

  // Convert string to Uint8Array and wipe it
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  secureWipe(data);
}

/**
 * Creates a secure buffer that automatically wipes itself when disposed
 */
export class SecureBuffer {
  private _data: Uint8Array;
  private _disposed = false;

  constructor(size: number) {
    if (size <= 0) {
      throw new Error('Buffer size must be positive');
    }
    this._data = new Uint8Array(size);
  }

  /**
   * Gets the underlying data array. Should only be used for read operations.
   */
  get data(): Readonly<Uint8Array> {
    if (this._disposed) {
      throw new Error('Buffer has been disposed');
    }
    return this._data;
  }

  /**
   * Gets the size of the buffer
   */
  get size(): number {
    return this._data.length;
  }

  /**
   * Writes data to the buffer at the specified offset
   */
  write(data: Uint8Array, offset = 0): void {
    if (this._disposed) {
      throw new Error('Buffer has been disposed');
    }
    if (offset < 0 || offset + data.length > this._data.length) {
      throw new Error('Write would exceed buffer bounds');
    }
    this._data.set(data, offset);
  }

  /**
   * Reads data from the buffer
   */
  read(offset = 0, length?: number): Uint8Array {
    if (this._disposed) {
      throw new Error('Buffer has been disposed');
    }
    const actualLength = length ?? this._data.length - offset;
    if (offset < 0 || offset + actualLength > this._data.length) {
      throw new Error('Read would exceed buffer bounds');
    }
    return this._data.slice(offset, offset + actualLength);
  }

  /**
   * Fills the buffer with random data
   */
  randomize(): void {
    if (this._disposed) {
      throw new Error('Buffer has been disposed');
    }
    crypto.getRandomValues(this._data);
  }

  /**
   * Securely disposes of the buffer by wiping its contents
   */
  dispose(): void {
    if (!this._disposed) {
      secureWipe(this._data);
      this._disposed = true;
    }
  }

  /**
   * Checks if the buffer has been disposed
   */
  get isDisposed(): boolean {
    return this._disposed;
  }
}

/**
 * A secure string holder that automatically wipes the string when disposed
 */
export class SecureString {
  private _buffer: SecureBuffer;
  private _actualLength: number;
  private _disposed = false;

  constructor(str: string) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    this._actualLength = data.length;
    
    // Handle empty strings by creating a buffer with at least 1 byte
    const bufferSize = Math.max(data.length, 1);
    this._buffer = new SecureBuffer(bufferSize);
    
    if (data.length > 0) {
      this._buffer.write(data);
    }
    
    secureWipe(data); // Wipe the temporary array
  }

  /**
   * Gets the string value. Creates a new string each time.
   */
  get value(): string {
    if (this._disposed) {
      throw new Error('SecureString has been disposed');
    }
    const decoder = new TextDecoder();
    // Only decode the actual string length, not the buffer padding
    const actualData = this._buffer.read(0, this._actualLength);
    return decoder.decode(actualData);
  }

  /**
   * Gets the length of the string in bytes
   */
  get length(): number {
    return this._actualLength;
  }

  /**
   * Securely disposes of the string
   */
  dispose(): void {
    if (!this._disposed) {
      this._buffer.dispose();
      this._disposed = true;
    }
  }

  /**
   * Checks if the string has been disposed
   */
  get isDisposed(): boolean {
    return this._disposed;
  }
}

/**
 * Utility function to generate cryptographically secure random bytes
 */
export function generateSecureRandom(length: number): Uint8Array {
  if (length <= 0) {
    throw new Error('Length must be positive');
  }
  const buffer = new Uint8Array(length);
  crypto.getRandomValues(buffer);
  return buffer;
}

/**
 * Utility function to compare two Uint8Arrays in constant time
 * to prevent timing attacks
 */
export function constantTimeEquals(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i]! ^ b[i]!;
  }

  return result === 0;
}

/**
 * Converts a hex string to Uint8Array
 */
export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error('Hex string must have even length');
  }
  
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    const byte = parseInt(hex.substring(i, i + 2), 16);
    if (isNaN(byte)) {
      throw new Error('Invalid hex string');
    }
    bytes[i / 2] = byte;
  }
  
  return bytes;
}

/**
 * Converts Uint8Array to hex string
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}