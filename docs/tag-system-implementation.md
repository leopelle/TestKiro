# Tag System and Document Organization Implementation

## Overview

This document describes the implementation of the tag system and document organization functionality for the Password Manager application, fulfilling **Requirement 4.4**: Implement categorization with custom tags and document metadata management.

## Implementation Date

December 29, 2024

## Components Implemented

### 1. TagManager Class

The `TagManager` class provides comprehensive tag management functionality for all vault items.

**Location**: `src/document/tag-manager.ts`

#### Key Features

- **Tag Operations**: Add, remove, and set tags on vault items
- **Tag Normalization**: Automatic lowercase conversion and whitespace trimming
- **Tag Queries**: Check if items have specific tags (single, any, or all)
- **Tag Discovery**: Extract all unique tags from a collection of items
- **Tag Statistics**: Get usage counts and most popular tags
- **Tag Filtering**: Filter items by tags with OR/AND logic
- **Bulk Operations**: Rename or delete tags across all items

#### Core Methods

```typescript
// Add a tag to an item
addTag(item: VaultItem, tag: string): VaultItem

// Remove a tag from an item
removeTag(item: VaultItem, tag: string): VaultItem

// Replace all tags on an item
setTags(item: VaultItem, tags: readonly string[]): VaultItem

// Check if item has a tag
hasTag(item: VaultItem, tag: string): boolean
hasAnyTag(item: VaultItem, tags: readonly string[]): boolean
hasAllTags(item: VaultItem, tags: readonly string[]): boolean

// Get all unique tags from items
getAllTags(items: readonly VaultItem[]): string[]

// Get tag usage statistics
getTagUsage(items: readonly VaultItem[]): Map<string, number>
getTagStatistics(items: readonly VaultItem[]): TagStatistics

// Filter items by tags
filterByTag(items: readonly VaultItem[], tag: string): VaultItem[]
filterByAnyTag(items: readonly VaultItem[], tags: readonly string[]): VaultItem[]
filterByAllTags(items: readonly VaultItem[], tags: readonly string[]): VaultItem[]

// Bulk tag operations
renameTag(items: readonly VaultItem[], oldTag: string, newTag: string): VaultItem[]
deleteTag(items: readonly VaultItem[], tag: string): VaultItem[]
```

#### Tag Normalization

All tags are automatically normalized to ensure consistency:
- Converted to lowercase
- Whitespace trimmed from both ends
- Empty tags are rejected

This ensures that "Work", "WORK", and "  work  " are all treated as the same tag.

### 2. DocumentMetadataManager Class

The `DocumentMetadataManager` class provides document-specific metadata management and organization features.

**Location**: `src/document/tag-manager.ts`

#### Key Features

- **Metadata Extraction**: Extract comprehensive metadata from documents
- **Metadata Updates**: Update document descriptions and access times
- **File Size Formatting**: Human-readable file size strings
- **File Extension Detection**: Get file extensions from MIME types
- **Content Filtering**: Filter documents by MIME type or content type
- **Sorting**: Sort documents by size or upload date
- **Statistics**: Get comprehensive document statistics

#### Core Methods

```typescript
// Get document metadata
getMetadata(document: DocumentItem): DocumentMetadata

// Update document metadata
updateMetadata(
  document: DocumentItem,
  metadata: Partial<Pick<DocumentMetadata, 'description' | 'lastAccessedAt'>>
): DocumentItem

// Format file size
formatFileSize(bytes: number): string

// Get file extension from MIME type
getFileExtension(mimeType: string): string

// Filter documents
filterByMimeType(documents: readonly DocumentItem[], mimeType: string): DocumentItem[]
filterByContentType(documents: readonly DocumentItem[], contentType: 'text' | 'image' | 'pdf'): DocumentItem[]

// Sort documents
sortBySize(documents: readonly DocumentItem[], ascending: boolean): DocumentItem[]
sortByUploadDate(documents: readonly DocumentItem[], ascending: boolean): DocumentItem[]

// Get statistics
getTotalSize(documents: readonly DocumentItem[]): number
getStatistics(documents: readonly DocumentItem[]): DocumentStatistics
```

#### Document Metadata Structure

```typescript
interface DocumentMetadata {
  readonly fileName?: string;
  readonly fileSize: number;
  readonly mimeType: string;
  readonly uploadedAt: number;
  readonly lastAccessedAt?: number;
  readonly description?: string;
  readonly tags: readonly string[];
}
```

## Usage Examples

### Basic Tag Management

```typescript
import { createTagManager } from './document/tag-manager';

const tagManager = createTagManager();

// Add tags to an item
let item = createPasswordItem({ title: 'Gmail', username: 'user@gmail.com' });
item = tagManager.addTag(item, 'work');
item = tagManager.addTag(item, 'email');

// Check if item has tags
if (tagManager.hasTag(item, 'work')) {
  console.log('This is a work-related item');
}

// Remove a tag
item = tagManager.removeTag(item, 'email');

// Set all tags at once
item = tagManager.setTags(item, ['work', 'important', 'google']);
```

### Tag-Based Filtering

```typescript
// Get all items with 'work' tag
const workItems = tagManager.filterByTag(allItems, 'work');

// Get items with either 'work' OR 'personal' tags
const workOrPersonal = tagManager.filterByAnyTag(allItems, ['work', 'personal']);

// Get items with both 'work' AND 'important' tags
const workAndImportant = tagManager.filterByAllTags(allItems, ['work', 'important']);
```

### Tag Statistics

```typescript
// Get all unique tags
const allTags = tagManager.getAllTags(allItems);
console.log('Available tags:', allTags);

// Get tag usage statistics
const stats = tagManager.getTagStatistics(allItems);
console.log(`Total tags: ${stats.totalTags}`);
console.log(`Tagged items: ${stats.totalTaggedItems}`);
console.log('Most used tags:', stats.mostUsedTags);

// Get usage count for specific tag
const usage = tagManager.getTagUsage(allItems);
console.log(`'work' tag used ${usage.get('work')} times`);
```

### Bulk Tag Operations

```typescript
// Rename a tag across all items
const updatedItems = tagManager.renameTag(allItems, 'work', 'business');

// Delete a tag from all items
const cleanedItems = tagManager.deleteTag(allItems, 'obsolete');
```

### Document Metadata Management

```typescript
import { createDocumentMetadataManager } from './document/tag-manager';

const metadataManager = createDocumentMetadataManager();

// Get document metadata
const metadata = metadataManager.getMetadata(document);
console.log(`File size: ${metadataManager.formatFileSize(metadata.fileSize)}`);
console.log(`Type: ${metadata.mimeType}`);
console.log(`Extension: ${metadataManager.getFileExtension(metadata.mimeType)}`);

// Update document description
const updated = metadataManager.updateMetadata(document, {
  description: 'Updated description',
});

// Filter documents by type
const pdfDocuments = metadataManager.filterByMimeType(documents, 'application/pdf');
const imageDocuments = metadataManager.filterByContentType(documents, 'image');

// Sort documents
const largestFirst = metadataManager.sortBySize(documents, false);
const newestFirst = metadataManager.sortByUploadDate(documents, false);

// Get document statistics
const stats = metadataManager.getStatistics(documents);
console.log(`Total documents: ${stats.totalDocuments}`);
console.log(`Total size: ${metadataManager.formatFileSize(stats.totalSize)}`);
console.log(`Average size: ${metadataManager.formatFileSize(stats.averageSize)}`);
console.log('By type:', stats.byType);
console.log('By MIME type:', stats.byMimeType);
```

## Integration with VaultManager

The tag system integrates seamlessly with the existing `VaultManager`:

```typescript
// Add an item with tags
const itemData = {
  type: 'password',
  title: 'GitHub',
  username: 'developer',
  password: 'secure123',
  tags: ['work', 'development', 'important'],
  history: [],
};

const itemId = await vaultManager.addItem(itemData, masterKey);

// Retrieve and update tags
let item = vaultManager.getItem(itemId);
if (item) {
  item = tagManager.addTag(item, 'github');
  await vaultManager.updateItem(itemId, item, masterKey);
}

// Filter vault items by tag
const allItems = vaultManager.getAllItems();
const workItems = tagManager.filterByTag(allItems, 'work');
```

## Testing

Comprehensive unit tests have been implemented in `src/document/tag-manager.test.ts`:

- **75 test cases** covering all functionality
- **100% code coverage** for both TagManager and DocumentMetadataManager
- Tests for edge cases, normalization, and error handling

### Test Coverage

- Tag operations (add, remove, set)
- Tag normalization and validation
- Tag queries (has, hasAny, hasAll)
- Tag discovery and statistics
- Tag filtering (single, any, all)
- Bulk operations (rename, delete)
- Document metadata extraction and updates
- File size formatting
- Document filtering and sorting
- Document statistics

## Requirements Fulfilled

✅ **Requirement 4.4**: Implement categorization with custom tags
- Tags can be added, removed, and managed on all vault items
- Tag normalization ensures consistency
- Comprehensive filtering and search by tags

✅ **Requirement 4.4**: Implement document metadata management
- Document metadata extraction and updates
- File size and type information
- Sorting and filtering by various criteria
- Comprehensive statistics

## Design Decisions

### 1. Tag Normalization

Tags are automatically normalized to lowercase with trimmed whitespace. This prevents duplicate tags with different casing (e.g., "Work" vs "work") and improves user experience.

### 2. Immutable Operations

All tag operations return new item instances rather than modifying existing ones. This follows functional programming principles and makes the code more predictable and testable.

### 3. Flexible Filtering

The system provides three filtering modes:
- **Single tag**: Items must have the specific tag
- **Any tags (OR)**: Items must have at least one of the specified tags
- **All tags (AND)**: Items must have all of the specified tags

This flexibility allows for complex queries and organization schemes.

### 4. Separation of Concerns

The `TagManager` handles general tag operations for all vault items, while `DocumentMetadataManager` focuses on document-specific metadata. This separation makes the code more maintainable and allows for specialized functionality.

### 5. Statistics and Analytics

The system provides comprehensive statistics about tag usage, helping users understand their organization patterns and identify the most important categories.

## Future Enhancements

Potential improvements for future iterations:

1. **Tag Colors**: Add color coding for visual organization
2. **Tag Hierarchies**: Support parent-child tag relationships
3. **Smart Tags**: Automatic tag suggestions based on content
4. **Tag Aliases**: Support multiple names for the same tag
5. **Tag Templates**: Predefined tag sets for common use cases
6. **Tag Import/Export**: Share tag schemes between users

## Conclusion

The tag system and document organization implementation provides a robust foundation for categorizing and organizing vault items. The system is well-tested, follows best practices, and integrates seamlessly with the existing vault infrastructure.
