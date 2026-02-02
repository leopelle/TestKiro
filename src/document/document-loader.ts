/**
 * Document loading and validation module for the Password Manager application
 * 
 * This module provides functionality to load and validate documents from various sources,
 * ensuring they meet format and size requirements before being stored in the vault.
 * 
 * Requirements: 4.1, 4.3
 */

import { CONFIG, ErrorCode, PasswordManagerError, Result, success, failure } from '../types/common';
import { DocumentContent, DocumentContentType, validateDocumentContent } from '../types/vault';

/**
 * Supported file extensions mapped to their MIME types
 */
const FILE_EXTENSION_TO_MIME: Record<string, string> = {
  '.txt': 'text/plain',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.pdf': 'application/pdf',
};

/**
 * MIME types mapped to document content types
 */
const MIME_TO_CONTENT_TYPE: Record<string, DocumentContentType> = {
  'text/plain': 'text',
  'image/jpeg': 'image',
  'image/png': 'image',
  'application/pdf': 'pdf',
};

/**
 * Options for loading a document
 */
export interface LoadDocumentOptions {
  /**
   * Optional MIME type override
   * If not provided, will be inferred from file extension or content
   */
  mimeType?: string;
  
  /**
   * Optional file name for extension detection
   */
  fileName?: string;
}

/**
 * Result of document loading operation
 */
export interface LoadDocumentResult {
  content: DocumentContent;
  fileName: string | undefined;
}

/**
 * Detects MIME type from file extension
 * 
 * @param fileName - The file name with extension
 * @returns The detected MIME type or undefined
 */
export function detectMimeTypeFromFileName(fileName: string): string | undefined {
  const extension = fileName.toLowerCase().match(/\.[^.]+$/)?.[0];
  if (!extension) {
    return undefined;
  }
  return FILE_EXTENSION_TO_MIME[extension];
}

/**
 * Detects MIME type from file content (magic bytes)
 * 
 * @param data - The file data
 * @returns The detected MIME type or undefined
 */
export function detectMimeTypeFromContent(data: Uint8Array): string | undefined {
  if (data.length < 4) {
    return undefined;
  }

  // Check for JPEG magic bytes (FF D8 FF)
  if (data[0] === 0xFF && data[1] === 0xD8 && data[2] === 0xFF) {
    return 'image/jpeg';
  }

  // Check for PNG magic bytes (89 50 4E 47)
  if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4E && data[3] === 0x47) {
    return 'image/png';
  }

  // Check for PDF magic bytes (%PDF)
  if (data[0] === 0x25 && data[1] === 0x50 && data[2] === 0x44 && data[3] === 0x46) {
    return 'application/pdf';
  }

  // Check if it's plain text (all printable ASCII or UTF-8)
  const isText = Array.from(data.slice(0, Math.min(512, data.length))).every(byte => {
    // Allow printable ASCII, newlines, tabs, and UTF-8 continuation bytes
    return (byte >= 0x20 && byte <= 0x7E) || byte === 0x09 || byte === 0x0A || byte === 0x0D || byte >= 0x80;
  });

  if (isText) {
    return 'text/plain';
  }

  return undefined;
}

/**
 * Determines the document content type from MIME type
 * 
 * @param mimeType - The MIME type
 * @returns The document content type
 * @throws PasswordManagerError if MIME type is not supported
 */
export function getContentTypeFromMimeType(mimeType: string): DocumentContentType {
  const contentType = MIME_TO_CONTENT_TYPE[mimeType];
  if (!contentType) {
    throw new PasswordManagerError(
      ErrorCode.UNSUPPORTED_FILE_TYPE,
      `Unsupported MIME type: ${mimeType}`
    );
  }
  return contentType;
}

/**
 * Validates file size
 * 
 * Requirement 4.3: Limit file size to 10MB
 * 
 * @param size - The file size in bytes
 * @throws PasswordManagerError if file is too large
 */
export function validateFileSize(size: number): void {
  if (size > CONFIG.MAX_FILE_SIZE) {
    throw new PasswordManagerError(
      ErrorCode.FILE_TOO_LARGE,
      `File size (${size} bytes) exceeds maximum allowed size of ${CONFIG.MAX_FILE_SIZE / (1024 * 1024)}MB`
    );
  }
  
  if (size < 0) {
    throw new PasswordManagerError(
      ErrorCode.INVALID_DATA_FORMAT,
      'File size cannot be negative'
    );
  }
}

/**
 * Validates MIME type is supported
 * 
 * Requirement 4.1: Support text, images (JPG, PNG) and PDF
 * 
 * @param mimeType - The MIME type to validate
 * @throws PasswordManagerError if MIME type is not supported
 */
export function validateMimeType(mimeType: string): void {
  const supportedTypes: string[] = [
    ...CONFIG.SUPPORTED_IMAGE_TYPES,
    ...CONFIG.SUPPORTED_DOCUMENT_TYPES,
  ];
  
  if (!supportedTypes.includes(mimeType)) {
    throw new PasswordManagerError(
      ErrorCode.UNSUPPORTED_FILE_TYPE,
      `Unsupported file type: ${mimeType}. Supported types: ${supportedTypes.join(', ')}`
    );
  }
}

/**
 * Loads and validates a document from raw data
 * 
 * Requirements:
 * - 4.1: Support text, images (JPG, PNG) and PDF
 * - 4.3: Limit file size to 10MB
 * 
 * @param data - The raw document data
 * @param options - Optional loading options
 * @returns Result containing the document content or error
 */
export function loadDocument(
  data: Uint8Array,
  options: LoadDocumentOptions = {}
): Result<LoadDocumentResult> {
  try {
    // Validate file size first
    validateFileSize(data.length);

    // Determine MIME type
    let mimeType = options.mimeType;
    
    if (!mimeType && options.fileName) {
      mimeType = detectMimeTypeFromFileName(options.fileName);
    }
    
    if (!mimeType) {
      mimeType = detectMimeTypeFromContent(data);
    }
    
    if (!mimeType) {
      throw new PasswordManagerError(
        ErrorCode.UNSUPPORTED_FILE_TYPE,
        'Could not determine file type. Please specify a MIME type or use a supported file extension.'
      );
    }

    // Validate MIME type is supported
    validateMimeType(mimeType);

    // Determine content type
    const contentType = getContentTypeFromMimeType(mimeType);

    // Create document content
    const content: DocumentContent = {
      type: contentType,
      data,
      mimeType,
      size: data.length,
    };

    // Validate the document content
    const validation = validateDocumentContent(content);
    if (!validation.valid) {
      throw new PasswordManagerError(
        ErrorCode.INVALID_DATA_FORMAT,
        `Document validation failed: ${validation.errors.join(', ')}`
      );
    }

    return success({
      content,
      fileName: options.fileName ?? undefined,
    });
  } catch (error) {
    if (error instanceof PasswordManagerError) {
      return failure(error);
    }
    return failure(
      new PasswordManagerError(
        ErrorCode.INVALID_DATA_FORMAT,
        `Failed to load document: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      )
    );
  }
}

/**
 * Loads a document from a File object (browser environment)
 * 
 * @param file - The File object
 * @returns Promise resolving to Result containing the document content or error
 */
export async function loadDocumentFromFile(file: File): Promise<Result<LoadDocumentResult>> {
  try {
    // Validate file size first
    validateFileSize(file.size);

    // Read file data
    const arrayBuffer = await file.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);

    // Load document with file name and type
    const mimeType = file.type || undefined;
    return loadDocument(data, {
      fileName: file.name,
      ...(mimeType && { mimeType }),
    });
  } catch (error) {
    if (error instanceof PasswordManagerError) {
      return failure(error);
    }
    return failure(
      new PasswordManagerError(
        ErrorCode.INVALID_DATA_FORMAT,
        `Failed to load document from file: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      )
    );
  }
}

/**
 * Loads a document from a base64-encoded string
 * 
 * @param base64Data - The base64-encoded document data
 * @param options - Optional loading options
 * @returns Result containing the document content or error
 */
export function loadDocumentFromBase64(
  base64Data: string,
  options: LoadDocumentOptions = {}
): Result<LoadDocumentResult> {
  try {
    // Remove data URL prefix if present (e.g., "data:image/png;base64,")
    let cleanBase64 = base64Data;
    let detectedMimeType: string | undefined;
    
    const dataUrlMatch = base64Data.match(/^data:([^;]+);base64,(.+)$/);
    if (dataUrlMatch) {
      detectedMimeType = dataUrlMatch[1];
      cleanBase64 = dataUrlMatch[2] ?? '';
    }

    // Decode base64
    const binaryString = atob(cleanBase64);
    const data = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      data[i] = binaryString.charCodeAt(i);
    }

    // Use detected MIME type from data URL if available
    const finalMimeType = options.mimeType || detectedMimeType;
    const finalOptions: LoadDocumentOptions = {
      ...options,
      ...(finalMimeType && { mimeType: finalMimeType }),
    };

    return loadDocument(data, finalOptions);
  } catch (error) {
    if (error instanceof PasswordManagerError) {
      return failure(error);
    }
    return failure(
      new PasswordManagerError(
        ErrorCode.INVALID_DATA_FORMAT,
        `Failed to load document from base64: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      )
    );
  }
}

/**
 * Converts document content to base64 string
 * 
 * @param content - The document content
 * @param includeDataUrl - Whether to include data URL prefix
 * @returns Base64-encoded string
 */
export function documentToBase64(content: DocumentContent, includeDataUrl = false): string {
  const binaryString = Array.from(content.data)
    .map(byte => String.fromCharCode(byte))
    .join('');
  
  const base64 = btoa(binaryString);
  
  if (includeDataUrl) {
    return `data:${content.mimeType};base64,${base64}`;
  }
  
  return base64;
}

/**
 * Gets a human-readable file size string
 * 
 * @param bytes - The size in bytes
 * @returns Formatted size string (e.g., "1.5 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
