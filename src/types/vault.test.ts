/**
 * Tests for vault item types, validation, and serialization
 * 
 * Requirements: 2.1, 3.1, 4.1
 */

import {
  PasswordItem,
  CreditCardItem,
  DocumentItem,
  PasswordHistory,
  DocumentContent,
  validatePasswordItem,
  validateCreditCardItem,
  validateDocumentItem,
  validateVaultItem,
  validateLuhn,
  validateExpiryDate,
  validateDocumentContent,
  serializeVaultItem,
  deserializeVaultItem,
  ValidationError,
} from './vault';
import { CONFIG } from './common';

describe('Vault Item Types', () => {
  describe('PasswordItem validation', () => {
    it('should validate a valid password item', () => {
      const item: Partial<PasswordItem> = {
        type: 'password',
        title: 'Gmail',
        username: 'user@example.com',
        password: 'SecurePass123!',
        url: 'https://gmail.com',
        tags: ['email', 'work'],
        history: [],
      };

      const result = validatePasswordItem(item);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject password item with empty title', () => {
      const item: Partial<PasswordItem> = {
        type: 'password',
        title: '',
        username: 'user@example.com',
        password: 'SecurePass123!',
      };

      const result = validatePasswordItem(item);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Title is required and cannot be empty');
    });

    it('should reject password item with empty username', () => {
      const item: Partial<PasswordItem> = {
        type: 'password',
        title: 'Gmail',
        username: '',
        password: 'SecurePass123!',
      };

      const result = validatePasswordItem(item);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Username is required and cannot be empty');
    });

    it('should reject password item with empty password', () => {
      const item: Partial<PasswordItem> = {
        type: 'password',
        title: 'Gmail',
        username: 'user@example.com',
        password: '',
      };

      const result = validatePasswordItem(item);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password is required and cannot be empty');
    });

    it('should reject password item with invalid URL', () => {
      const item: Partial<PasswordItem> = {
        type: 'password',
        title: 'Gmail',
        username: 'user@example.com',
        password: 'SecurePass123!',
        url: 'not-a-valid-url',
      };

      const result = validatePasswordItem(item);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('URL must be a valid URL format');
    });

    it('should accept password item without URL', () => {
      const item: Partial<PasswordItem> = {
        type: 'password',
        title: 'Gmail',
        username: 'user@example.com',
        password: 'SecurePass123!',
      };

      const result = validatePasswordItem(item);
      expect(result.valid).toBe(true);
    });

    it('should reject password item with history exceeding limit', () => {
      const history: PasswordHistory[] = Array.from({ length: 6 }, (_, i) => ({
        password: `OldPass${i}`,
        changedAt: Date.now() - i * 1000,
      }));

      const item: Partial<PasswordItem> = {
        type: 'password',
        title: 'Gmail',
        username: 'user@example.com',
        password: 'SecurePass123!',
        history,
      };

      const result = validatePasswordItem(item);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(`Password history cannot exceed ${CONFIG.PASSWORD_HISTORY_LIMIT} entries`);
    });

    it('should accept password item with history at limit', () => {
      const history: PasswordHistory[] = Array.from({ length: 5 }, (_, i) => ({
        password: `OldPass${i}`,
        changedAt: Date.now() - i * 1000,
      }));

      const item: Partial<PasswordItem> = {
        type: 'password',
        title: 'Gmail',
        username: 'user@example.com',
        password: 'SecurePass123!',
        history,
      };

      const result = validatePasswordItem(item);
      expect(result.valid).toBe(true);
    });
  });

  describe('Luhn algorithm validation', () => {
    it('should validate correct credit card numbers', () => {
      // Valid test card numbers
      expect(validateLuhn('4532015112830366')).toBe(true); // Visa
      expect(validateLuhn('5425233430109903')).toBe(true); // Mastercard
      expect(validateLuhn('374245455400126')).toBe(true);  // Amex
      expect(validateLuhn('6011000991001201')).toBe(true); // Discover
    });

    it('should reject invalid credit card numbers', () => {
      expect(validateLuhn('4532015112830367')).toBe(false); // Wrong checksum
      expect(validateLuhn('1234567890123456')).toBe(false); // Invalid
      expect(validateLuhn('0000000000000000')).toBe(false); // All zeros
    });

    it('should handle card numbers with spaces and dashes', () => {
      expect(validateLuhn('4532 0151 1283 0366')).toBe(true);
      expect(validateLuhn('4532-0151-1283-0366')).toBe(true);
    });

    it('should reject non-numeric card numbers', () => {
      expect(validateLuhn('abcd1234efgh5678')).toBe(false);
      expect(validateLuhn('453201511283036a')).toBe(false);
    });

    it('should reject card numbers that are too short', () => {
      expect(validateLuhn('123456789012')).toBe(false); // 12 digits
      expect(validateLuhn('12345')).toBe(false);
    });
  });

  describe('Expiry date validation', () => {
    it('should validate correct expiry date format', () => {
      // Create a date in the future
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 2);
      const month = String(futureDate.getMonth() + 1).padStart(2, '0');
      const year = String(futureDate.getFullYear()).slice(-2);
      
      expect(validateExpiryDate(`${month}/${year}`)).toBe(true);
    });

    it('should reject invalid expiry date formats', () => {
      expect(validateExpiryDate('13/25')).toBe(false); // Invalid month
      expect(validateExpiryDate('00/25')).toBe(false); // Invalid month
      expect(validateExpiryDate('12/2025')).toBe(false); // 4-digit year
      expect(validateExpiryDate('12-25')).toBe(false); // Wrong separator
      expect(validateExpiryDate('1/25')).toBe(false); // Single digit month
    });

    it('should reject expired dates', () => {
      expect(validateExpiryDate('01/20')).toBe(false); // Past date
      expect(validateExpiryDate('12/21')).toBe(false); // Past date
    });

    it('should accept current month/year', () => {
      const now = new Date();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = String(now.getFullYear()).slice(-2);
      
      expect(validateExpiryDate(`${month}/${year}`)).toBe(true);
    });
  });

  describe('CreditCardItem validation', () => {
    it('should validate a valid credit card item', () => {
      const item: Partial<CreditCardItem> = {
        type: 'creditcard',
        title: 'Visa Card',
        cardNumber: '4532015112830366',
        holderName: 'John Doe',
        expiryDate: '12/28',
        cvv: '123',
        tags: ['personal'],
      };

      const result = validateCreditCardItem(item);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject credit card with empty title', () => {
      const item: Partial<CreditCardItem> = {
        type: 'creditcard',
        title: '',
        cardNumber: '4532015112830366',
        holderName: 'John Doe',
        expiryDate: '12/28',
        cvv: '123',
      };

      const result = validateCreditCardItem(item);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Title is required and cannot be empty');
    });

    it('should reject credit card with invalid card number', () => {
      const item: Partial<CreditCardItem> = {
        type: 'creditcard',
        title: 'Visa Card',
        cardNumber: '1234567890123456',
        holderName: 'John Doe',
        expiryDate: '12/28',
        cvv: '123',
      };

      const result = validateCreditCardItem(item);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Card number is invalid (failed Luhn check)');
    });

    it('should reject credit card with empty holder name', () => {
      const item: Partial<CreditCardItem> = {
        type: 'creditcard',
        title: 'Visa Card',
        cardNumber: '4532015112830366',
        holderName: '',
        expiryDate: '12/28',
        cvv: '123',
      };

      const result = validateCreditCardItem(item);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Holder name is required and cannot be empty');
    });

    it('should reject credit card with invalid expiry date', () => {
      const item: Partial<CreditCardItem> = {
        type: 'creditcard',
        title: 'Visa Card',
        cardNumber: '4532015112830366',
        holderName: 'John Doe',
        expiryDate: '13/28',
        cvv: '123',
      };

      const result = validateCreditCardItem(item);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Expiry date must be in MM/YY format and not expired');
    });

    it('should reject credit card with invalid CVV', () => {
      const item: Partial<CreditCardItem> = {
        type: 'creditcard',
        title: 'Visa Card',
        cardNumber: '4532015112830366',
        holderName: 'John Doe',
        expiryDate: '12/28',
        cvv: '12',
      };

      const result = validateCreditCardItem(item);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('CVV must be 3 or 4 digits');
    });

    it('should accept 4-digit CVV', () => {
      const item: Partial<CreditCardItem> = {
        type: 'creditcard',
        title: 'Amex Card',
        cardNumber: '374245455400126',
        holderName: 'John Doe',
        expiryDate: '12/28',
        cvv: '1234',
      };

      const result = validateCreditCardItem(item);
      expect(result.valid).toBe(true);
    });
  });

  describe('DocumentContent validation', () => {
    it('should validate valid text document content', () => {
      const content: Partial<DocumentContent> = {
        type: 'text',
        data: new Uint8Array([72, 101, 108, 108, 111]), // "Hello"
        mimeType: 'text/plain',
        size: 5,
      };

      const result = validateDocumentContent(content);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate valid image document content', () => {
      const content: Partial<DocumentContent> = {
        type: 'image',
        data: new Uint8Array(100),
        mimeType: 'image/jpeg',
        size: 100,
      };

      const result = validateDocumentContent(content);
      expect(result.valid).toBe(true);
    });

    it('should validate valid PDF document content', () => {
      const content: Partial<DocumentContent> = {
        type: 'pdf',
        data: new Uint8Array(1000),
        mimeType: 'application/pdf',
        size: 1000,
      };

      const result = validateDocumentContent(content);
      expect(result.valid).toBe(true);
    });

    it('should reject content with invalid type', () => {
      const content: Partial<DocumentContent> = {
        type: 'video' as any,
        data: new Uint8Array(100),
        mimeType: 'video/mp4',
        size: 100,
      };

      const result = validateDocumentContent(content);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Content type must be text, image, or pdf');
    });

    it('should reject content with unsupported MIME type', () => {
      const content: Partial<DocumentContent> = {
        type: 'image',
        data: new Uint8Array(100),
        mimeType: 'image/gif',
        size: 100,
      };

      const result = validateDocumentContent(content);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Unsupported MIME type'))).toBe(true);
    });

    it('should reject content exceeding size limit', () => {
      const largeSize = CONFIG.MAX_FILE_SIZE + 1;
      const content: Partial<DocumentContent> = {
        type: 'pdf',
        data: new Uint8Array(largeSize),
        mimeType: 'application/pdf',
        size: largeSize,
      };

      const result = validateDocumentContent(content);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('exceeds maximum allowed size'))).toBe(true);
    });

    it('should reject content with negative size', () => {
      const content: Partial<DocumentContent> = {
        type: 'text',
        data: new Uint8Array(100),
        mimeType: 'text/plain',
        size: -1,
      };

      const result = validateDocumentContent(content);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Content size cannot be negative');
    });

    it('should reject content with mismatched size', () => {
      const content: Partial<DocumentContent> = {
        type: 'text',
        data: new Uint8Array(100),
        mimeType: 'text/plain',
        size: 50,
      };

      const result = validateDocumentContent(content);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Content size does not match data length');
    });
  });

  describe('DocumentItem validation', () => {
    it('should validate a valid document item', () => {
      const item: Partial<DocumentItem> = {
        type: 'document',
        title: 'Important Document',
        content: {
          type: 'pdf',
          data: new Uint8Array(1000),
          mimeType: 'application/pdf',
          size: 1000,
        },
        tags: ['important', 'work'],
      };

      const result = validateDocumentItem(item);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject document with empty title', () => {
      const item: Partial<DocumentItem> = {
        type: 'document',
        title: '',
        content: {
          type: 'pdf',
          data: new Uint8Array(1000),
          mimeType: 'application/pdf',
          size: 1000,
        },
      };

      const result = validateDocumentItem(item);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Title is required and cannot be empty');
    });

    it('should reject document without content', () => {
      const item: Partial<DocumentItem> = {
        type: 'document',
        title: 'Important Document',
      };

      const result = validateDocumentItem(item);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Content is required');
    });

    it('should reject document with invalid content', () => {
      const item: Partial<DocumentItem> = {
        type: 'document',
        title: 'Important Document',
        content: {
          type: 'pdf',
          data: new Uint8Array(1000),
          mimeType: 'application/pdf',
          size: -1, // Invalid size
        },
      };

      const result = validateDocumentItem(item);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Content size cannot be negative');
    });
  });

  describe('Generic vault item validation', () => {
    it('should validate password item through generic validator', () => {
      const item: Partial<PasswordItem> = {
        type: 'password',
        title: 'Gmail',
        username: 'user@example.com',
        password: 'SecurePass123!',
      };

      const result = validateVaultItem(item);
      expect(result.valid).toBe(true);
    });

    it('should validate credit card item through generic validator', () => {
      const item: Partial<CreditCardItem> = {
        type: 'creditcard',
        title: 'Visa Card',
        cardNumber: '4532015112830366',
        holderName: 'John Doe',
        expiryDate: '12/28',
        cvv: '123',
      };

      const result = validateVaultItem(item);
      expect(result.valid).toBe(true);
    });

    it('should validate document item through generic validator', () => {
      const item: Partial<DocumentItem> = {
        type: 'document',
        title: 'Important Document',
        content: {
          type: 'pdf',
          data: new Uint8Array(1000),
          mimeType: 'application/pdf',
          size: 1000,
        },
      };

      const result = validateVaultItem(item);
      expect(result.valid).toBe(true);
    });

    it('should reject item without type', () => {
      const item: Partial<any> = {
        title: 'Some Item',
      };

      const result = validateVaultItem(item);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Item type is required');
    });

    it('should reject item with unknown type', () => {
      const item: Partial<any> = {
        type: 'unknown',
        title: 'Some Item',
      };

      const result = validateVaultItem(item);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Unknown item type: unknown');
    });
  });

  describe('Serialization and deserialization', () => {
    it('should serialize and deserialize password item', () => {
      const item: PasswordItem = {
        id: 'test-id-1',
        type: 'password',
        title: 'Gmail',
        username: 'user@example.com',
        password: 'SecurePass123!',
        url: 'https://gmail.com',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        tags: ['email', 'work'],
        notes: 'My work email',
        history: [
          { password: 'OldPass1', changedAt: Date.now() - 1000 },
          { password: 'OldPass2', changedAt: Date.now() - 2000 },
        ],
      };

      const serialized = serializeVaultItem(item);
      const deserialized = deserializeVaultItem(serialized);

      expect(deserialized).toEqual(item);
    });

    it('should serialize and deserialize credit card item', () => {
      const item: CreditCardItem = {
        id: 'test-id-2',
        type: 'creditcard',
        title: 'Visa Card',
        cardNumber: '4532015112830366',
        holderName: 'John Doe',
        expiryDate: '12/28',
        cvv: '123',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        tags: ['personal'],
        notes: 'Personal card',
      };

      const serialized = serializeVaultItem(item);
      const deserialized = deserializeVaultItem(serialized);

      expect(deserialized).toEqual(item);
    });

    it('should serialize and deserialize document item', () => {
      const item: DocumentItem = {
        id: 'test-id-3',
        type: 'document',
        title: 'Important Document',
        content: {
          type: 'pdf',
          data: new Uint8Array([1, 2, 3, 4, 5]),
          mimeType: 'application/pdf',
          size: 5,
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        tags: ['important', 'work'],
        notes: 'Work document',
      };

      const serialized = serializeVaultItem(item);
      const deserialized = deserializeVaultItem(serialized);

      expect(deserialized).toEqual(item);
    });

    it('should throw ValidationError for invalid deserialization data', () => {
      const invalidData = {
        type: 'password',
        title: '', // Invalid: empty title
        username: 'user@example.com',
        password: 'SecurePass123!',
      };

      expect(() => deserializeVaultItem(invalidData)).toThrow(ValidationError);
    });

    it('should throw ValidationError for unknown item type', () => {
      const invalidData = {
        type: 'unknown',
        title: 'Some Item',
      };

      expect(() => deserializeVaultItem(invalidData)).toThrow(ValidationError);
      expect(() => deserializeVaultItem(invalidData)).toThrow('Unknown item type');
    });
  });
});
