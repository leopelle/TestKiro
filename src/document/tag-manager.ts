/**
 * Tag Management System for the Password Manager application
 * 
 * This module provides functionality for managing tags and organizing vault items
 * through categorization with custom tags.
 * 
 * Requirement 4.4: Implement categorization with custom tags
 */

import { VaultItem, DocumentItem } from '../types/vault';

/**
 * Tag metadata with optional color for visual organization
 */
export interface TagMetadata {
  readonly name: string;
  readonly color?: string;
  readonly usageCount: number;
  readonly createdAt: number;
}

/**
 * Result of tag operations
 */
export interface TagOperationResult {
  readonly success: boolean;
  readonly message?: string;
}

/**
 * Tag statistics for a vault
 */
export interface TagStatistics {
  readonly totalTags: number;
  readonly totalTaggedItems: number;
  readonly tagUsage: ReadonlyMap<string, number>;
  readonly mostUsedTags: readonly string[];
}

/**
 * TagManager class for managing tags across vault items
 */
export class TagManager {
  /**
   * Adds a tag to a vault item
   * 
   * @param item - The vault item to add the tag to
   * @param tag - The tag to add (will be normalized)
   * @returns Updated item with the new tag
   */
  addTag(item: VaultItem, tag: string): VaultItem {
    const normalizedTag = this.normalizeTag(tag);
    
    if (!normalizedTag) {
      throw new Error('Tag cannot be empty');
    }

    // Check if tag already exists
    if (item.tags.includes(normalizedTag)) {
      return item; // Tag already exists, return unchanged
    }

    // Add tag to the item
    return {
      ...item,
      tags: [...item.tags, normalizedTag],
      updatedAt: Date.now(),
    } as VaultItem;
  }

  /**
   * Removes a tag from a vault item
   * 
   * @param item - The vault item to remove the tag from
   * @param tag - The tag to remove (will be normalized)
   * @returns Updated item without the tag
   */
  removeTag(item: VaultItem, tag: string): VaultItem {
    const normalizedTag = this.normalizeTag(tag);
    
    if (!normalizedTag) {
      return item;
    }

    // Filter out the tag
    const newTags = item.tags.filter(t => t !== normalizedTag);

    // If no change, return original item
    if (newTags.length === item.tags.length) {
      return item;
    }

    return {
      ...item,
      tags: newTags,
      updatedAt: Date.now(),
    } as VaultItem;
  }

  /**
   * Replaces all tags on a vault item
   * 
   * @param item - The vault item to update
   * @param tags - The new tags to set
   * @returns Updated item with the new tags
   */
  setTags(item: VaultItem, tags: readonly string[]): VaultItem {
    const normalizedTags = tags
      .map(tag => this.normalizeTag(tag))
      .filter((tag): tag is string => tag !== null && tag.length > 0);

    // Remove duplicates
    const uniqueTags = Array.from(new Set(normalizedTags));

    return {
      ...item,
      tags: uniqueTags,
      updatedAt: Date.now(),
    } as VaultItem;
  }

  /**
   * Checks if an item has a specific tag
   * 
   * @param item - The vault item to check
   * @param tag - The tag to look for (will be normalized)
   * @returns true if the item has the tag, false otherwise
   */
  hasTag(item: VaultItem, tag: string): boolean {
    const normalizedTag = this.normalizeTag(tag);
    if (!normalizedTag) {
      return false;
    }
    return item.tags.includes(normalizedTag);
  }

  /**
   * Checks if an item has any of the specified tags
   * 
   * @param item - The vault item to check
   * @param tags - The tags to look for
   * @returns true if the item has at least one of the tags
   */
  hasAnyTag(item: VaultItem, tags: readonly string[]): boolean {
    const normalizedTags = tags
      .map(tag => this.normalizeTag(tag))
      .filter((tag): tag is string => tag !== null);

    return normalizedTags.some(tag => item.tags.includes(tag));
  }

  /**
   * Checks if an item has all of the specified tags
   * 
   * @param item - The vault item to check
   * @param tags - The tags to look for
   * @returns true if the item has all of the tags
   */
  hasAllTags(item: VaultItem, tags: readonly string[]): boolean {
    const normalizedTags = tags
      .map(tag => this.normalizeTag(tag))
      .filter((tag): tag is string => tag !== null);

    return normalizedTags.every(tag => item.tags.includes(tag));
  }

  /**
   * Gets all unique tags from a collection of items
   * 
   * @param items - The vault items to extract tags from
   * @returns Array of unique tags sorted alphabetically
   */
  getAllTags(items: readonly VaultItem[]): string[] {
    const tagSet = new Set<string>();

    for (const item of items) {
      for (const tag of item.tags) {
        tagSet.add(tag);
      }
    }

    return Array.from(tagSet).sort();
  }

  /**
   * Gets tag usage statistics from a collection of items
   * 
   * @param items - The vault items to analyze
   * @returns Map of tag names to usage counts
   */
  getTagUsage(items: readonly VaultItem[]): Map<string, number> {
    const tagUsage = new Map<string, number>();

    for (const item of items) {
      for (const tag of item.tags) {
        tagUsage.set(tag, (tagUsage.get(tag) || 0) + 1);
      }
    }

    return tagUsage;
  }

  /**
   * Gets comprehensive tag statistics
   * 
   * @param items - The vault items to analyze
   * @returns Tag statistics object
   */
  getTagStatistics(items: readonly VaultItem[]): TagStatistics {
    const tagUsage = this.getTagUsage(items);
    const totalTags = tagUsage.size;
    const totalTaggedItems = items.filter(item => item.tags.length > 0).length;

    // Get most used tags (sorted by usage count, descending)
    const mostUsedTags = Array.from(tagUsage.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([tag]) => tag);

    return {
      totalTags,
      totalTaggedItems,
      tagUsage,
      mostUsedTags,
    };
  }

  /**
   * Filters items by tag
   * 
   * @param items - The vault items to filter
   * @param tag - The tag to filter by
   * @returns Array of items that have the specified tag
   */
  filterByTag(items: readonly VaultItem[], tag: string): VaultItem[] {
    const normalizedTag = this.normalizeTag(tag);
    if (!normalizedTag) {
      return [];
    }

    return items.filter(item => item.tags.includes(normalizedTag));
  }

  /**
   * Filters items by multiple tags (OR logic - has any of the tags)
   * 
   * @param items - The vault items to filter
   * @param tags - The tags to filter by
   * @returns Array of items that have at least one of the specified tags
   */
  filterByAnyTag(items: readonly VaultItem[], tags: readonly string[]): VaultItem[] {
    if (tags.length === 0) {
      return [];
    }

    return items.filter(item => this.hasAnyTag(item, tags));
  }

  /**
   * Filters items by multiple tags (AND logic - has all tags)
   * 
   * @param items - The vault items to filter
   * @param tags - The tags to filter by
   * @returns Array of items that have all of the specified tags
   */
  filterByAllTags(items: readonly VaultItem[], tags: readonly string[]): VaultItem[] {
    if (tags.length === 0) {
      return Array.from(items);
    }

    return items.filter(item => this.hasAllTags(item, tags));
  }

  /**
   * Renames a tag across all items
   * 
   * @param items - The vault items to update
   * @param oldTag - The tag to rename
   * @param newTag - The new tag name
   * @returns Array of updated items
   */
  renameTag(items: readonly VaultItem[], oldTag: string, newTag: string): VaultItem[] {
    const normalizedOldTag = this.normalizeTag(oldTag);
    const normalizedNewTag = this.normalizeTag(newTag);

    if (!normalizedOldTag || !normalizedNewTag) {
      return Array.from(items);
    }

    if (normalizedOldTag === normalizedNewTag) {
      return Array.from(items);
    }

    return items.map(item => {
      if (!item.tags.includes(normalizedOldTag)) {
        return item;
      }

      // Replace old tag with new tag
      const newTags = item.tags.map(tag => 
        tag === normalizedOldTag ? normalizedNewTag : tag
      );

      // Remove duplicates if new tag already existed
      const uniqueTags = Array.from(new Set(newTags));

      return {
        ...item,
        tags: uniqueTags,
        updatedAt: Date.now(),
      } as VaultItem;
    });
  }

  /**
   * Deletes a tag from all items
   * 
   * @param items - The vault items to update
   * @param tag - The tag to delete
   * @returns Array of updated items
   */
  deleteTag(items: readonly VaultItem[], tag: string): VaultItem[] {
    const normalizedTag = this.normalizeTag(tag);

    if (!normalizedTag) {
      return Array.from(items);
    }

    return items.map(item => {
      if (!item.tags.includes(normalizedTag)) {
        return item;
      }

      return this.removeTag(item, normalizedTag);
    });
  }

  /**
   * Normalizes a tag by trimming whitespace and converting to lowercase
   * 
   * @param tag - The tag to normalize
   * @returns Normalized tag, or null if invalid
   */
  private normalizeTag(tag: string): string | null {
    if (typeof tag !== 'string') {
      return null;
    }

    const normalized = tag.trim().toLowerCase();
    
    if (normalized.length === 0) {
      return null;
    }

    return normalized;
  }
}

/**
 * Document metadata management
 */
export interface DocumentMetadata {
  readonly fileName?: string;
  readonly fileSize: number;
  readonly mimeType: string;
  readonly uploadedAt: number;
  readonly lastAccessedAt?: number;
  readonly description?: string;
  readonly tags: readonly string[];
}

/**
 * DocumentMetadataManager class for managing document-specific metadata
 */
export class DocumentMetadataManager {
  /**
   * Extracts metadata from a document item
   * 
   * @param document - The document item
   * @returns Document metadata
   */
  getMetadata(document: DocumentItem): DocumentMetadata {
    return {
      fileSize: document.content.size,
      mimeType: document.content.mimeType,
      uploadedAt: document.createdAt,
      lastAccessedAt: document.updatedAt,
      tags: document.tags,
      ...(document.notes && { description: document.notes }),
    };
  }

  /**
   * Updates document metadata
   * 
   * @param document - The document item to update
   * @param metadata - Partial metadata to update
   * @returns Updated document item
   */
  updateMetadata(
    document: DocumentItem,
    metadata: Partial<Pick<DocumentMetadata, 'description' | 'lastAccessedAt'>>
  ): DocumentItem {
    const updates: Record<string, unknown> = {
      updatedAt: Date.now(),
    };

    if (metadata.description !== undefined) {
      updates['notes'] = metadata.description;
    }

    if (metadata.lastAccessedAt !== undefined) {
      updates['updatedAt'] = metadata.lastAccessedAt;
    }

    return {
      ...document,
      ...updates,
    } as DocumentItem;
  }

  /**
   * Gets a human-readable file size string
   * 
   * @param bytes - The size in bytes
   * @returns Formatted size string (e.g., "1.5 MB")
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  /**
   * Gets the file extension from a MIME type
   * 
   * @param mimeType - The MIME type
   * @returns File extension (e.g., ".pdf", ".jpg")
   */
  getFileExtension(mimeType: string): string {
    const mimeToExt: Record<string, string> = {
      'text/plain': '.txt',
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'application/pdf': '.pdf',
    };

    return mimeToExt[mimeType] || '';
  }

  /**
   * Filters documents by MIME type
   * 
   * @param documents - The document items to filter
   * @param mimeType - The MIME type to filter by
   * @returns Array of documents with the specified MIME type
   */
  filterByMimeType(documents: readonly DocumentItem[], mimeType: string): DocumentItem[] {
    return documents.filter(doc => doc.content.mimeType === mimeType);
  }

  /**
   * Filters documents by content type
   * 
   * @param documents - The document items to filter
   * @param contentType - The content type to filter by ('text', 'image', 'pdf')
   * @returns Array of documents with the specified content type
   */
  filterByContentType(
    documents: readonly DocumentItem[],
    contentType: 'text' | 'image' | 'pdf'
  ): DocumentItem[] {
    return documents.filter(doc => doc.content.type === contentType);
  }

  /**
   * Gets documents sorted by size
   * 
   * @param documents - The document items to sort
   * @param ascending - Sort order (true for ascending, false for descending)
   * @returns Sorted array of documents
   */
  sortBySize(documents: readonly DocumentItem[], ascending = true): DocumentItem[] {
    const sorted = [...documents].sort((a, b) => {
      return ascending
        ? a.content.size - b.content.size
        : b.content.size - a.content.size;
    });

    return sorted;
  }

  /**
   * Gets documents sorted by upload date
   * 
   * @param documents - The document items to sort
   * @param ascending - Sort order (true for oldest first, false for newest first)
   * @returns Sorted array of documents
   */
  sortByUploadDate(documents: readonly DocumentItem[], ascending = false): DocumentItem[] {
    const sorted = [...documents].sort((a, b) => {
      return ascending
        ? a.createdAt - b.createdAt
        : b.createdAt - a.createdAt;
    });

    return sorted;
  }

  /**
   * Gets total size of all documents
   * 
   * @param documents - The document items to analyze
   * @returns Total size in bytes
   */
  getTotalSize(documents: readonly DocumentItem[]): number {
    return documents.reduce((total, doc) => total + doc.content.size, 0);
  }

  /**
   * Gets document statistics
   * 
   * @param documents - The document items to analyze
   * @returns Statistics object
   */
  getStatistics(documents: readonly DocumentItem[]): {
    totalDocuments: number;
    totalSize: number;
    averageSize: number;
    byType: Record<string, number>;
    byMimeType: Record<string, number>;
  } {
    const totalDocuments = documents.length;
    const totalSize = this.getTotalSize(documents);
    const averageSize = totalDocuments > 0 ? totalSize / totalDocuments : 0;

    const byType: Record<string, number> = {};
    const byMimeType: Record<string, number> = {};

    for (const doc of documents) {
      byType[doc.content.type] = (byType[doc.content.type] || 0) + 1;
      byMimeType[doc.content.mimeType] = (byMimeType[doc.content.mimeType] || 0) + 1;
    }

    return {
      totalDocuments,
      totalSize,
      averageSize,
      byType,
      byMimeType,
    };
  }
}

/**
 * Factory function to create a new TagManager instance
 */
export function createTagManager(): TagManager {
  return new TagManager();
}

/**
 * Factory function to create a new DocumentMetadataManager instance
 */
export function createDocumentMetadataManager(): DocumentMetadataManager {
  return new DocumentMetadataManager();
}
