# Document Loading and Validation Implementation

## Overview

This document describes the implementation of document loading and validation functionality for the Password Manager application, fulfilling task 8.1.

## Requirements

- **Requirement 4.1**: Support text, images (JPG, PNG) and PDF
- **Requirement 4.3**: Limit file size to 10MB

## Implementation

### Module Structure

The document loading functionality is implemented in `src/document/document-loader.ts` with the following key components:

#### 1. File Type Detection

**MIME Type Detection from File Name**
```typescript
detectMimeTypeFromFileName(fileName: string): string | undefined
```
- Extracts file extension and maps it to MIME type
- Supports: `.txt`, `.jpg`, `.jpeg`, `.png`, `.pdf`
- Case-insensitive matching

**MIME Type Detection from Content (Magic Bytes)**
```typescript
detectMimeTypeFromContent(data: Uint8Array): string | undefined
```
- Analyzes file content to detect type
- Checks magic bytes for:
  - JPEG: `FF D8 FF`
  - PNG: `89 50 4E 47`
  - PDF: `%PDF` (25 50 44 46)
  - Plain text: Validates printable ASCII/UTF-8 characters

#### 2. Validation Functions

**File Size Validation**
```typescript
validateFileSize(size: number): void
```
- Enforces 10MB maximum file size limit
- Rejects negative sizes
- Throws `PasswordManagerError` with `FILE_TOO_LARGE` code

**MIME Type Validation**
```typescript
validateMimeType(mimeType: string): void
```
- Validates against supported types:
  - Images: `image/jpeg`, `image/png`
  - Documents: `text/plain`, `application/pdf`
- Throws `PasswordManagerError` with `UNSUPPORTED_FILE_TYPE` code

#### 3. Document Loading Functions

**Core Loading Function**
```typescript
loadDocument(
  data: Uint8Array,
  options?: LoadDocumentOptions
): Result<LoadDocumentResult>
```
- Main function for loading documents from raw data
- Validates file size first (fail fast)
- Determines MIME type from:
  1. Explicit `options.mimeType` (highest priority)
  2. File name extension via `options.fileName`
  3. Content analysis (magic bytes)
- Validates MIME type is supported
- Creates `DocumentContent` structure
- Returns `Result` type for error handling

**Browser File Loading**
```typescript
loadDocumentFromFile(file: File): Promise<Result<LoadDocumentResult>>
```
- Async function for browser `File` objects
- Reads file data using `arrayBuffer()`
- Delegates to `loadDocument()` with file metadata

**Base64 Loading**
```typescript
loadDocumentFromBase64(
  base64Data: string,
  options?: LoadDocumentOptions
): Result<LoadDocumentResult>
```
- Loads documents from base64-encoded strings
- Supports data URLs (e.g., `data:image/png;base64,...`)
- Extracts MIME type from data URL prefix
- Decodes base64 and delegates to `loadDocument()`

#### 4. Utility Functions

**Base64 Conversion**
```typescript
documentToBase64(content: DocumentContent, includeDataUrl?: boolean): string
```
- Converts document content to base64 string
- Optionally includes data URL prefix

**File Size Formatting**
```typescript
formatFileSize(bytes: number): string
```
- Formats byte sizes as human-readable strings
- Supports: Bytes, KB, MB, GB

### Data Structures

**LoadDocumentOptions**
```typescript
interface LoadDocumentOptions {
  mimeType?: string;    // Optional MIME type override
  fileName?: string;    // Optional file name for extension detection
}
```

**LoadDocumentResult**
```typescript
interface LoadDocumentResult {
  content: DocumentContent;
  fileName: string | undefined;
}
```

**DocumentContent** (from `src/types/vault.ts`)
```typescript
interface DocumentContent {
  readonly type: DocumentContentType;  // 'text' | 'image' | 'pdf'
  readonly data: Uint8Array;
  readonly mimeType: string;
  readonly size: number;
}
```

### Error Handling

The implementation uses the `Result<T, E>` pattern for error handling:

```typescript
type Result<T, E = PasswordManagerError> = 
  | { success: true; data: T }
  | { success: false; error: E };
```

**Error Codes Used:**
- `FILE_TOO_LARGE`: File exceeds 10MB limit
- `UNSUPPORTED_FILE_TYPE`: File type not supported
- `INVALID_DATA_FORMAT`: Invalid or corrupted data

### Supported File Types

| Type | Extensions | MIME Types | Magic Bytes |
|------|-----------|------------|-------------|
| Text | .txt | text/plain | Printable ASCII/UTF-8 |
| JPEG | .jpg, .jpeg | image/jpeg | FF D8 FF |
| PNG | .png | image/png | 89 50 4E 47 |
| PDF | .pdf | application/pdf | 25 50 44 46 (%PDF) |

### Configuration

File handling configuration is defined in `src/types/common.ts`:

```typescript
const CONFIG = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  SUPPORTED_IMAGE_TYPES: ['image/jpeg', 'image/png'],
  SUPPORTED_DOCUMENT_TYPES: ['application/pdf', 'text/plain'],
};
```

## Testing

Comprehensive unit tests are provided in `src/document/document-loader.test.ts`:

### Test Coverage

1. **MIME Type Detection** (13 tests)
   - File name extension detection
   - Content magic bytes detection
   - Edge cases (no extension, unknown types)

2. **Validation** (11 tests)
   - File size validation (under/over/at limit)
   - MIME type validation (supported/unsupported)
   - Error code verification

3. **Document Loading** (15 tests)
   - Loading with explicit MIME type
   - Loading with file name
   - Loading from magic bytes
   - Error cases (too large, unsupported, unknown)
   - Empty files
   - Priority of MIME type sources

4. **Base64 Loading** (5 tests)
   - Plain base64 strings
   - Data URLs
   - Invalid base64
   - Size validation

5. **Utilities** (6 tests)
   - Base64 conversion
   - File size formatting

6. **Edge Cases** (5 tests)
   - Maximum file size boundary
   - All supported types
   - File name preservation

**Total: 55 tests, all passing**

### Test Execution

```bash
npm test -- src/document/document-loader.test.ts
```

## Usage Examples

### Loading a Document from Raw Data

```typescript
import { loadDocument } from './document/document-loader';

const data = new Uint8Array([/* ... */]);
const result = loadDocument(data, { 
  fileName: 'document.pdf',
  mimeType: 'application/pdf' 
});

if (result.success) {
  const { content, fileName } = result.data;
  console.log(`Loaded ${fileName}: ${content.size} bytes`);
} else {
  console.error(`Error: ${result.error.message}`);
}
```

### Loading from Browser File Input

```typescript
import { loadDocumentFromFile } from './document/document-loader';

async function handleFileUpload(file: File) {
  const result = await loadDocumentFromFile(file);
  
  if (result.success) {
    const { content } = result.data;
    // Store in vault...
  } else {
    alert(`Failed to load file: ${result.error.message}`);
  }
}
```

### Loading from Base64

```typescript
import { loadDocumentFromBase64 } from './document/document-loader';

const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANS...';
const result = loadDocumentFromBase64(dataUrl);

if (result.success) {
  const { content } = result.data;
  // Use document content...
}
```

### Converting to Base64

```typescript
import { documentToBase64 } from './document/document-loader';

const base64 = documentToBase64(content, true); // Include data URL
// Result: "data:image/png;base64,iVBORw0KGgoAAAANS..."
```

## Integration with Vault

The document loader integrates with the existing vault system:

1. **Document Types**: Uses `DocumentContent` and `DocumentItem` from `src/types/vault.ts`
2. **Validation**: Leverages `validateDocumentContent()` and `validateDocumentItem()`
3. **Error Handling**: Uses common `PasswordManagerError` and error codes
4. **Configuration**: Shares `CONFIG` constants with other modules

## Security Considerations

1. **File Size Limits**: Enforced at 10MB to prevent memory exhaustion
2. **Type Validation**: Only supported file types are accepted
3. **Magic Byte Verification**: Content-based type detection prevents spoofing
4. **Error Handling**: All errors are caught and returned as `Result` types
5. **Memory Safety**: Uses `Uint8Array` for binary data handling

## Future Enhancements

Potential improvements for future iterations:

1. **Compression**: Add support for compressed documents
2. **Thumbnails**: Generate thumbnails for images
3. **Text Extraction**: Extract text from PDFs for search
4. **Virus Scanning**: Integrate with antivirus APIs
5. **Additional Formats**: Support more document types (DOCX, etc.)
6. **Streaming**: Support streaming for very large files
7. **Progress Callbacks**: Add progress reporting for large file operations

## Related Files

- `src/document/document-loader.ts` - Main implementation
- `src/document/document-loader.test.ts` - Unit tests
- `src/document/index.ts` - Module exports
- `src/types/vault.ts` - Document type definitions
- `src/types/common.ts` - Common types and configuration
- `.kiro/specs/password-manager-app/requirements.md` - Requirements
- `.kiro/specs/password-manager-app/design.md` - Design document
- `.kiro/specs/password-manager-app/tasks.md` - Task list

## Conclusion

The document loading and validation implementation provides a robust, type-safe, and well-tested foundation for handling documents in the Password Manager application. It fully satisfies requirements 4.1 and 4.3, with comprehensive error handling and extensive test coverage.
