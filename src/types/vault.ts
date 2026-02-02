/**
 * Vault item type definitions for the Password Manager application
 * 
 * This module defines all vault item types (passwords, credit cards, documents)
 * with validation and serialization support.
 * 
 * Requirements: 2.1, 3.1, 4.1
 */

import { BaseVaultItem, UUID, Timestamp, CONFIG } from './common';

/**
 * Type discriminator for vault items
 */
export type VaultItemType = 'password' | 'creditcard' | 'document';

/**
 * Base interface for all vault items
 * Extends BaseVaultItem with common vault-specific properties
 */
export interface VaultItem extends BaseVaultItem {
  readonly type: VaultItemType;
}

/**
 * Password history entry
 * Tracks previous password values with timestamps
 * 
 * Requirement 2.5: Maintain history of last 5 password versions
 */
export interface PasswordHistory {
  readonly password: string;
  readonly changedAt: Timestamp;
}

/**
 * Password vault item
 * 
 * Requirement 2.1: Store title, username, password, URL and notes
 */
export interface PasswordItem extends VaultItem {
  readonly type: 'password';
  readonly username: string;
  readonly password: string;
  readonly url?: string;
  readonly history: readonly PasswordHistory[];
}

/**
 * Credit card vault item
 * 
 * Requirement 3.1: Store card number, holder name, expiry date, CVV and notes
 */
export interface CreditCardItem extends VaultItem {
  readonly type: 'creditcard';
  readonly cardNumber: string;
  readonly holderName: string;
  readonly expiryDate: string; // Format: MM/YY
  readonly cvv: string;
}

/**
 * Document content types
 */
export type DocumentContentType = 'text' | 'image' | 'pdf';

/**
 * Document content structure
 * 
 * Requirement 4.1: Support text, images (JPG, PNG) and PDF
 */
export interface DocumentContent {
  readonly type: DocumentContentType;
  readonly data: Uint8Array;
  readonly mimeType: string;
  readonly size: number;
}

/**
 * Document vault item
 * 
 * Requirement 4.1: Store documents with categorization
 */
export interface DocumentItem extends VaultItem {
  readonly type: 'document';
  readonly content: DocumentContent;
}

/**
 * Validation result type
 */
export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

/**
 * Validation error class
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly errors: readonly string[]
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validates a password item
 * 
 * Requirement 2.1: Validate required fields for password items
 * 
 * @param item - The password item to validate
 * @returns Validation result with any errors
 */
export function validatePasswordItem(item: Partial<PasswordItem>): ValidationResult {
  const errors: string[] = [];

  // Validate required fields
  if (!item.title || item.title.trim().length === 0) {
    errors.push('Title is required and cannot be empty');
  }

  if (!item.username || item.username.trim().length === 0) {
    errors.push('Username is required and cannot be empty');
  }

  if (!item.password || item.password.trim().length === 0) {
    errors.push('Password is required and cannot be empty');
  }

  // Validate URL format if provided
  if (item.url && item.url.trim().length > 0) {
    try {
      new URL(item.url);
    } catch {
      errors.push('URL must be a valid URL format');
    }
  }

  // Validate history limit
  if (item.history && item.history.length > CONFIG.PASSWORD_HISTORY_LIMIT) {
    errors.push(`Password history cannot exceed ${CONFIG.PASSWORD_HISTORY_LIMIT} entries`);
  }

  // Validate tags
  if (item.tags && !Array.isArray(item.tags)) {
    errors.push('Tags must be an array');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates a credit card number using the Luhn algorithm
 * 
 * Requirement 3.4: Validate card number using Luhn algorithm
 * 
 * @param cardNumber - The card number to validate (digits only)
 * @returns true if valid, false otherwise
 */
export function validateLuhn(cardNumber: string): boolean {
  // Remove any spaces or dashes
  const cleaned = cardNumber.replace(/[\s-]/g, '');

  // Check if it contains only digits
  if (!/^\d+$/.test(cleaned)) {
    return false;
  }

  // Must be at least 13 digits
  if (cleaned.length < 13) {
    return false;
  }

  // Reject all zeros (invalid card)
  if (/^0+$/.test(cleaned)) {
    return false;
  }

  // Luhn algorithm
  let sum = 0;
  let isEven = false;

  // Loop through values starting from the rightmost digit
  for (let i = cleaned.length - 1; i >= 0; i--) {
    let digit = parseInt(cleaned[i] ?? '0', 10);

    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    isEven = !isEven;
  }

  return sum % 10 === 0;
}

/**
 * Validates expiry date format and checks if it's not expired
 * 
 * @param expiryDate - The expiry date in MM/YY format
 * @returns true if valid and not expired, false otherwise
 */
export function validateExpiryDate(expiryDate: string): boolean {
  // Check format MM/YY
  const expiryRegex = /^(0[1-9]|1[0-2])\/\d{2}$/;
  if (!expiryRegex.test(expiryDate)) {
    return false;
  }

  // Parse month and year
  const [monthStr, yearStr] = expiryDate.split('/');
  const month = parseInt(monthStr ?? '0', 10);
  const year = 2000 + parseInt(yearStr ?? '0', 10);

  // Check if expired
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // getMonth() is 0-indexed

  if (year < currentYear) {
    return false;
  }

  if (year === currentYear && month < currentMonth) {
    return false;
  }

  return true;
}

/**
 * Validates a credit card item
 * 
 * Requirement 3.1: Validate required fields for credit card items
 * 
 * @param item - The credit card item to validate
 * @returns Validation result with any errors
 */
export function validateCreditCardItem(item: Partial<CreditCardItem>): ValidationResult {
  const errors: string[] = [];

  // Validate required fields
  if (!item.title || item.title.trim().length === 0) {
    errors.push('Title is required and cannot be empty');
  }

  if (!item.cardNumber || item.cardNumber.trim().length === 0) {
    errors.push('Card number is required and cannot be empty');
  } else if (!validateLuhn(item.cardNumber)) {
    errors.push('Card number is invalid (failed Luhn check)');
  }

  if (!item.holderName || item.holderName.trim().length === 0) {
    errors.push('Holder name is required and cannot be empty');
  }

  if (!item.expiryDate || item.expiryDate.trim().length === 0) {
    errors.push('Expiry date is required and cannot be empty');
  } else if (!validateExpiryDate(item.expiryDate)) {
    errors.push('Expiry date must be in MM/YY format and not expired');
  }

  if (!item.cvv || item.cvv.trim().length === 0) {
    errors.push('CVV is required and cannot be empty');
  } else if (!/^\d{3,4}$/.test(item.cvv)) {
    errors.push('CVV must be 3 or 4 digits');
  }

  // Validate tags
  if (item.tags && !Array.isArray(item.tags)) {
    errors.push('Tags must be an array');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates document content type and size
 * 
 * Requirement 4.1: Support text, images (JPG, PNG) and PDF
 * Requirement 4.3: Limit file size to 10MB
 * 
 * @param content - The document content to validate
 * @returns Validation result with any errors
 */
export function validateDocumentContent(content: Partial<DocumentContent>): ValidationResult {
  const errors: string[] = [];

  // Validate content type
  if (!content.type) {
    errors.push('Content type is required');
  } else if (!['text', 'image', 'pdf'].includes(content.type)) {
    errors.push('Content type must be text, image, or pdf');
  }

  // Validate mime type
  if (!content.mimeType) {
    errors.push('MIME type is required');
  } else {
    const supportedTypes: readonly string[] = [
      ...CONFIG.SUPPORTED_IMAGE_TYPES,
      ...CONFIG.SUPPORTED_DOCUMENT_TYPES,
    ];
    
    if (!supportedTypes.includes(content.mimeType)) {
      errors.push(`Unsupported MIME type: ${content.mimeType}. Supported types: ${supportedTypes.join(', ')}`);
    }
  }

  // Validate data
  if (!content.data) {
    errors.push('Content data is required');
  } else if (!(content.data instanceof Uint8Array)) {
    errors.push('Content data must be a Uint8Array');
  }

  // Validate size
  if (content.size === undefined || content.size === null) {
    errors.push('Content size is required');
  } else if (content.size > CONFIG.MAX_FILE_SIZE) {
    errors.push(`File size exceeds maximum allowed size of ${CONFIG.MAX_FILE_SIZE / (1024 * 1024)}MB`);
  } else if (content.size < 0) {
    errors.push('Content size cannot be negative');
  }

  // Validate size matches data length
  if (content.data && content.size !== undefined && content.data.length !== content.size) {
    errors.push('Content size does not match data length');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates a document item
 * 
 * Requirement 4.1: Validate required fields for document items
 * 
 * @param item - The document item to validate
 * @returns Validation result with any errors
 */
export function validateDocumentItem(item: Partial<DocumentItem>): ValidationResult {
  const errors: string[] = [];

  // Validate required fields
  if (!item.title || item.title.trim().length === 0) {
    errors.push('Title is required and cannot be empty');
  }

  // Validate content
  if (!item.content) {
    errors.push('Content is required');
  } else {
    const contentValidation = validateDocumentContent(item.content);
    if (!contentValidation.valid) {
      errors.push(...contentValidation.errors);
    }
  }

  // Validate tags
  if (item.tags && !Array.isArray(item.tags)) {
    errors.push('Tags must be an array');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates any vault item based on its type
 * 
 * @param item - The vault item to validate
 * @returns Validation result with any errors
 */
export function validateVaultItem(item: Partial<VaultItem>): ValidationResult {
  const errors: string[] = [];

  // Validate common fields
  if (!item.type) {
    errors.push('Item type is required');
    return { valid: false, errors };
  }

  // Validate type-specific fields
  switch (item.type) {
    case 'password':
      return validatePasswordItem(item as Partial<PasswordItem>);
    case 'creditcard':
      return validateCreditCardItem(item as Partial<CreditCardItem>);
    case 'document':
      return validateDocumentItem(item as Partial<DocumentItem>);
    default:
      errors.push(`Unknown item type: ${item.type}`);
      return { valid: false, errors };
  }
}

/**
 * Serializes a vault item to JSON-compatible format
 * 
 * @param item - The vault item to serialize
 * @returns JSON-compatible object
 */
export function serializeVaultItem(item: VaultItem): Record<string, unknown> {
  const base = {
    id: item.id,
    type: item.type,
    title: item.title,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    tags: [...item.tags],
    notes: item.notes,
  };

  switch (item.type) {
    case 'password': {
      const passwordItem = item as PasswordItem;
      return {
        ...base,
        username: passwordItem.username,
        password: passwordItem.password,
        url: passwordItem.url,
        history: passwordItem.history.map(h => ({
          password: h.password,
          changedAt: h.changedAt,
        })),
      };
    }

    case 'creditcard': {
      const cardItem = item as CreditCardItem;
      return {
        ...base,
        cardNumber: cardItem.cardNumber,
        holderName: cardItem.holderName,
        expiryDate: cardItem.expiryDate,
        cvv: cardItem.cvv,
      };
    }

    case 'document': {
      const docItem = item as DocumentItem;
      return {
        ...base,
        content: {
          type: docItem.content.type,
          data: Array.from(docItem.content.data), // Convert Uint8Array to array for JSON
          mimeType: docItem.content.mimeType,
          size: docItem.content.size,
        },
      };
    }

    default:
      throw new Error(`Unknown item type: ${(item as VaultItem).type}`);
  }
}

/**
 * Deserializes a vault item from JSON-compatible format
 * 
 * @param data - The JSON-compatible object
 * @returns Deserialized vault item
 * @throws ValidationError if data is invalid
 */
export function deserializeVaultItem(data: Record<string, unknown>): VaultItem {
  // Validate type
  if (!data['type'] || typeof data['type'] !== 'string') {
    throw new ValidationError('Invalid item type', ['Item type is required and must be a string']);
  }

  const type = data['type'] as VaultItemType;

  // Build base item
  const base = {
    id: data['id'] as UUID,
    type,
    title: data['title'] as string,
    createdAt: data['createdAt'] as Timestamp,
    updatedAt: data['updatedAt'] as Timestamp,
    tags: (data['tags'] as string[]) || [],
    notes: data['notes'] as string | undefined,
  };

  let item: VaultItem;

  switch (type) {
    case 'password': {
      const history = (data['history'] as Array<{ password: string; changedAt: number }>) || [];
      item = {
        ...base,
        type: 'password',
        username: data['username'] as string,
        password: data['password'] as string,
        url: data['url'] as string | undefined,
        history: history.map(h => ({
          password: h.password,
          changedAt: h.changedAt,
        })),
      } as PasswordItem;
      break;
    }

    case 'creditcard': {
      item = {
        ...base,
        type: 'creditcard',
        cardNumber: data['cardNumber'] as string,
        holderName: data['holderName'] as string,
        expiryDate: data['expiryDate'] as string,
        cvv: data['cvv'] as string,
      } as CreditCardItem;
      break;
    }

    case 'document': {
      const content = data['content'] as Record<string, unknown>;
      const dataArray = content['data'] as number[];
      item = {
        ...base,
        type: 'document',
        content: {
          type: content['type'] as DocumentContentType,
          data: new Uint8Array(dataArray),
          mimeType: content['mimeType'] as string,
          size: content['size'] as number,
        },
      } as DocumentItem;
      break;
    }

    default:
      throw new ValidationError(`Unknown item type: ${type}`, [`Unknown item type: ${type}`]);
  }

  // Validate the deserialized item
  const validation = validateVaultItem(item);
  if (!validation.valid) {
    throw new ValidationError('Invalid vault item data', validation.errors);
  }

  return item;
}
