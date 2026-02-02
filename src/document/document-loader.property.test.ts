/**
 * Document Loader Property-Based Tests
 * 
 * Property-based tests using fast-check to verify document loading
 * correctness across all valid file types and sizes.
 * 
 * Feature: password-manager-app
 */

import * as fc from 'fast-check';
import { loadDocument } from './document-loader';
import { CONFIG, ErrorCode } from '../types/common';

describe('DocumentLoader - Property-Based Tests', () => {
  /**
   * Property 14: Validazione Formato e Dimensione File
   * 
   * **Validates: Requirements 4.1, 4.3**
   * 
   * For any file uploaded, it should be accepted only if it is of a supported type
   * (text, JPG, PNG, PDF) and under 10MB.
   * 
   * This property verifies that:
   * 1. Files with supported MIME types and size <= 10MB are accepted
   * 2. Files with unsupported MIME types are rejected
   * 3. Files over 10MB are rejected regardless of type
   * 4. Files exactly at 10MB limit are accepted
   * 5. Empty files (0 bytes) are accepted for supported types
   */
  describe('Property 14: File Format and Size Validation', () => {
    // Supported MIME types as per requirements 4.1
    const supportedMimeTypes = [
      'text/plain',
      'image/jpeg',
      'image/png',
      'application/pdf'
    ];

    // Unsupported MIME types for testing rejection
    const unsupportedMimeTypes = [
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'video/mp4',
      'audio/mp3',
      'image/gif',
      'image/bmp',
      'application/zip',
      'text/html',
      'application/json'
    ];

    it('should accept files with supported MIME types and size under 10MB', () => {
      // Arbitrary for valid file data: supported type and size <= 1MB (reduced for faster tests)
      const validFileArbitrary = fc.record({
        mimeType: fc.constantFrom(...supportedMimeTypes),
        size: fc.integer({ min: 0, max: 1024 * 1024 }) // 1MB instead of 10MB for faster tests
      }).chain(({ mimeType, size }) => {
        // Generate appropriate file data based on MIME type
        return fc.record({
          mimeType: fc.constant(mimeType),
          data: generateFileDataArbitrary(mimeType, size)
        });
      });

      fc.assert(
        fc.property(validFileArbitrary, ({ mimeType, data }) => {
          // Attempt to load the document
          const result = loadDocument(data, { mimeType });

          // Property: Valid files should be accepted
          expect(result.success).toBe(true);
          
          if (result.success) {
            // Verify the loaded document has correct properties
            expect(result.data.content.mimeType).toBe(mimeType);
            expect(result.data.content.size).toBe(data.length);
            expect(result.data.content.size).toBeLessThanOrEqual(CONFIG.MAX_FILE_SIZE);
            expect(result.data.content.data).toEqual(data);
          }
        }),
        { numRuns: 10 }
      );
    });

    it('should reject files with unsupported MIME types', () => {
      // Arbitrary for files with unsupported MIME types (reduced size for faster tests)
      const unsupportedFileArbitrary = fc.record({
        mimeType: fc.constantFrom(...unsupportedMimeTypes),
        size: fc.integer({ min: 1, max: 1024 * 1024 }) // 1MB for faster tests
      }).chain(({ mimeType, size }) => {
        return fc.record({
          mimeType: fc.constant(mimeType),
          data: fc.uint8Array({ minLength: size, maxLength: size })
        });
      });

      fc.assert(
        fc.property(unsupportedFileArbitrary, ({ mimeType, data }) => {
          // Attempt to load the document
          const result = loadDocument(data, { mimeType });

          // Property: Unsupported file types should be rejected
          expect(result.success).toBe(false);
          
          if (!result.success) {
            expect(result.error.code).toBe(ErrorCode.UNSUPPORTED_FILE_TYPE);
            expect(result.error.message).toContain(mimeType);
          }
        }),
        { numRuns: 10 }
      );
    });

    it('should reject files over 10MB regardless of type', () => {
      // Arbitrary for files exceeding the size limit (using smaller test size for speed)
      const oversizedFileArbitrary = fc.record({
        mimeType: fc.constantFrom(...supportedMimeTypes),
        size: fc.integer({ min: CONFIG.MAX_FILE_SIZE + 1, max: CONFIG.MAX_FILE_SIZE + 100 * 1024 }) // Only 100KB over limit
      }).chain(({ mimeType, size }) => {
        return fc.record({
          mimeType: fc.constant(mimeType),
          // For large files, we create a typed array without filling it to save memory
          data: fc.constant(new Uint8Array(size))
        });
      });

      fc.assert(
        fc.property(oversizedFileArbitrary, ({ mimeType, data }) => {
          // Attempt to load the document
          const result = loadDocument(data, { mimeType });

          // Property: Files over 10MB should be rejected
          expect(result.success).toBe(false);
          
          if (!result.success) {
            expect(result.error.code).toBe(ErrorCode.FILE_TOO_LARGE);
            expect(result.error.message).toContain('10MB');
          }
        }),
        { numRuns: 10 }
      );
    });

    it('should accept files exactly at 10MB limit', () => {
      // Test boundary condition: exactly 10MB
      const maxSizeFileArbitrary = fc.constantFrom(...supportedMimeTypes).chain(mimeType => {
        return fc.record({
          mimeType: fc.constant(mimeType),
          data: generateFileDataArbitrary(mimeType, CONFIG.MAX_FILE_SIZE)
        });
      });

      fc.assert(
        fc.property(maxSizeFileArbitrary, ({ mimeType, data }) => {
          // Attempt to load the document
          const result = loadDocument(data, { mimeType });

          // Property: Files exactly at 10MB should be accepted
          expect(result.success).toBe(true);
          
          if (result.success) {
            expect(result.data.content.size).toBe(CONFIG.MAX_FILE_SIZE);
            expect(result.data.content.mimeType).toBe(mimeType);
          }
        }),
        { numRuns: 10 }
      );
    });

    it('should accept empty files (0 bytes) for supported types', () => {
      // Test boundary condition: empty files
      const emptyFileArbitrary = fc.constantFrom(...supportedMimeTypes).map(mimeType => ({
        mimeType,
        data: new Uint8Array(0)
      }));

      fc.assert(
        fc.property(emptyFileArbitrary, ({ mimeType, data }) => {
          // Attempt to load the document
          const result = loadDocument(data, { mimeType });

          // Property: Empty files should be accepted for supported types
          expect(result.success).toBe(true);
          
          if (result.success) {
            expect(result.data.content.size).toBe(0);
            expect(result.data.content.mimeType).toBe(mimeType);
          }
        }),
        { numRuns: 10 }
      );
    });

    it('should validate both format and size constraints together', () => {
      // Arbitrary for any file (supported or not, valid size or not) - reduced max size for speed
      const anyFileArbitrary = fc.record({
        mimeType: fc.oneof(
          fc.constantFrom(...supportedMimeTypes),
          fc.constantFrom(...unsupportedMimeTypes)
        ),
        size: fc.integer({ min: 0, max: CONFIG.MAX_FILE_SIZE + 100 * 1024 }) // Reduced from +1MB to +100KB
      }).chain(({ mimeType, size }) => {
        return fc.record({
          mimeType: fc.constant(mimeType),
          size: fc.constant(size),
          data: size > CONFIG.MAX_FILE_SIZE 
            ? fc.constant(new Uint8Array(size))
            : generateFileDataArbitrary(mimeType, size)
        });
      });

      fc.assert(
        fc.property(anyFileArbitrary, ({ mimeType, size, data }) => {
          // Attempt to load the document
          const result = loadDocument(data, { mimeType });

          const isSupported = supportedMimeTypes.includes(mimeType);
          const isValidSize = size <= CONFIG.MAX_FILE_SIZE;

          // Property: File should be accepted if and only if both conditions are met
          if (isSupported && isValidSize) {
            expect(result.success).toBe(true);
            if (result.success) {
              expect(result.data.content.mimeType).toBe(mimeType);
              expect(result.data.content.size).toBe(size);
            }
          } else {
            expect(result.success).toBe(false);
            if (!result.success) {
              if (!isValidSize) {
                expect(result.error.code).toBe(ErrorCode.FILE_TOO_LARGE);
              } else if (!isSupported) {
                expect(result.error.code).toBe(ErrorCode.UNSUPPORTED_FILE_TYPE);
              }
            }
          }
        }),
        { numRuns: 10 }
      );
    });

    it('should correctly map MIME types to content types', () => {
      // Verify that each supported MIME type maps to the correct content type
      const mimeTypeMapping = {
        'text/plain': 'text',
        'image/jpeg': 'image',
        'image/png': 'image',
        'application/pdf': 'pdf'
      } as const;

      const validFileWithTypeArbitrary = fc.constantFrom(...supportedMimeTypes).chain(mimeType => {
        return fc.record({
          mimeType: fc.constant(mimeType),
          expectedType: fc.constant(mimeTypeMapping[mimeType as keyof typeof mimeTypeMapping]),
          data: generateFileDataArbitrary(mimeType, fc.sample(fc.integer({ min: 1, max: 1024 }), 1)[0] ?? 100)
        });
      });

      fc.assert(
        fc.property(validFileWithTypeArbitrary, ({ mimeType, expectedType, data }) => {
          const result = loadDocument(data, { mimeType });

          // Property: MIME type should be correctly mapped to content type
          expect(result.success).toBe(true);
          if (result.success) {
            expect(result.data.content.type).toBe(expectedType);
          }
        }),
        { numRuns: 10 }
      );
    });
  });
});

/**
 * Helper function to generate appropriate file data based on MIME type
 * This creates realistic file data with proper magic bytes for binary formats
 */
function generateFileDataArbitrary(mimeType: string, size: number): fc.Arbitrary<Uint8Array> {
  switch (mimeType) {
    case 'image/jpeg':
      // JPEG magic bytes: FF D8 FF
      return fc.constant(createFileWithMagicBytes([0xFF, 0xD8, 0xFF, 0xE0], size));
    
    case 'image/png':
      // PNG magic bytes: 89 50 4E 47
      return fc.constant(createFileWithMagicBytes([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], size));
    
    case 'application/pdf':
      // PDF magic bytes: %PDF
      return fc.constant(createFileWithMagicBytes([0x25, 0x50, 0x44, 0x46], size));
    
    case 'text/plain':
      // For text, generate printable ASCII characters
      if (size === 0) {
        return fc.constant(new Uint8Array(0));
      }
      return fc.array(fc.integer({ min: 0x20, max: 0x7E }), { minLength: size, maxLength: size })
        .map(arr => new Uint8Array(arr));
    
    default:
      // For other types, generate random bytes
      return fc.uint8Array({ minLength: size, maxLength: size });
  }
}

/**
 * Helper function to create a file with specific magic bytes
 */
function createFileWithMagicBytes(magicBytes: number[], totalSize: number): Uint8Array {
  const data = new Uint8Array(totalSize);
  
  // Set magic bytes at the beginning
  for (let i = 0; i < Math.min(magicBytes.length, totalSize); i++) {
    data[i] = magicBytes[i] ?? 0;
  }
  
  // Fill the rest with random-ish data (but deterministic for testing)
  for (let i = magicBytes.length; i < totalSize; i++) {
    data[i] = (i * 7 + 13) % 256;
  }
  
  return data;
}
