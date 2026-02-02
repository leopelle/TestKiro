/**
 * Document management module
 * 
 * This module provides functionality for loading, validating, and managing
 * documents in the Password Manager application.
 * 
 * Requirements: 4.1, 4.3
 */

export {
  loadDocument,
  loadDocumentFromFile,
  loadDocumentFromBase64,
  documentToBase64,
  detectMimeTypeFromFileName,
  detectMimeTypeFromContent,
  getContentTypeFromMimeType,
  validateFileSize,
  validateMimeType,
  formatFileSize,
  type LoadDocumentOptions,
  type LoadDocumentResult,
} from './document-loader';
