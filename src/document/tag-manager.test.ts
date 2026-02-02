/**
 * Tests for tag management and document organization
 * 
 * Requirement 4.4: Test categorization with custom tags and document metadata
 */

import {
  TagManager,
  DocumentMetadataManager,
  createTagManager,
  createDocumentMetadataManager,
} from './tag-manager';
import { DocumentItem, PasswordItem } from '../types/vault';

describe('TagManager', () => {
  let tagManager: TagManager;

  beforeEach(() => {
    tagManager = createTagManager();
  });

  // Helper function to create a test password item
  const createTestPasswordItem = (tags: string[] = []): PasswordItem => ({
    id: 'test-id',
    type: 'password',
    title: 'Test Item',
    username: 'user@example.com',
    password: 'password123',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    tags,
    history: [],
  });



  describe('addTag', () => {
    it('should add a tag to an item with no tags', () => {
      const item = createTestPasswordItem();
      const updated = tagManager.addTag(item, 'work');

      expect(updated.tags).toEqual(['work']);
      expect(updated.updatedAt).toBeGreaterThanOrEqual(item.updatedAt);
    });

    it('should add a tag to an item with existing tags', () => {
      const item = createTestPasswordItem(['personal']);
      const updated = tagManager.addTag(item, 'work');

      expect(updated.tags).toEqual(['personal', 'work']);
    });

    it('should normalize tags to lowercase', () => {
      const item = createTestPasswordItem();
      const updated = tagManager.addTag(item, 'WORK');

      expect(updated.tags).toEqual(['work']);
    });

    it('should trim whitespace from tags', () => {
      const item = createTestPasswordItem();
      const updated = tagManager.addTag(item, '  work  ');

      expect(updated.tags).toEqual(['work']);
    });

    it('should not add duplicate tags', () => {
      const item = createTestPasswordItem(['work']);
      const updated = tagManager.addTag(item, 'work');

      expect(updated.tags).toEqual(['work']);
      expect(updated).toBe(item); // Should return same object
    });

    it('should not add duplicate tags after normalization', () => {
      const item = createTestPasswordItem(['work']);
      const updated = tagManager.addTag(item, 'WORK');

      expect(updated.tags).toEqual(['work']);
    });

    it('should throw error for empty tag', () => {
      const item = createTestPasswordItem();
      expect(() => tagManager.addTag(item, '')).toThrow('Tag cannot be empty');
    });

    it('should throw error for whitespace-only tag', () => {
      const item = createTestPasswordItem();
      expect(() => tagManager.addTag(item, '   ')).toThrow('Tag cannot be empty');
    });
  });

  describe('removeTag', () => {
    it('should remove a tag from an item', () => {
      const item = createTestPasswordItem(['work', 'personal']);
      const updated = tagManager.removeTag(item, 'work');

      expect(updated.tags).toEqual(['personal']);
      expect(updated.updatedAt).toBeGreaterThanOrEqual(item.updatedAt);
    });

    it('should normalize tag before removing', () => {
      const item = createTestPasswordItem(['work', 'personal']);
      const updated = tagManager.removeTag(item, 'WORK');

      expect(updated.tags).toEqual(['personal']);
    });

    it('should return unchanged item if tag does not exist', () => {
      const item = createTestPasswordItem(['work']);
      const updated = tagManager.removeTag(item, 'personal');

      expect(updated.tags).toEqual(['work']);
      expect(updated).toBe(item);
    });

    it('should handle removing from empty tags', () => {
      const item = createTestPasswordItem([]);
      const updated = tagManager.removeTag(item, 'work');

      expect(updated.tags).toEqual([]);
      expect(updated).toBe(item);
    });

    it('should handle empty tag string', () => {
      const item = createTestPasswordItem(['work']);
      const updated = tagManager.removeTag(item, '');

      expect(updated.tags).toEqual(['work']);
      expect(updated).toBe(item);
    });
  });

  describe('setTags', () => {
    it('should replace all tags on an item', () => {
      const item = createTestPasswordItem(['old1', 'old2']);
      const updated = tagManager.setTags(item, ['new1', 'new2', 'new3']);

      expect(updated.tags).toEqual(['new1', 'new2', 'new3']);
      expect(updated.updatedAt).toBeGreaterThanOrEqual(item.updatedAt);
    });

    it('should normalize all tags', () => {
      const item = createTestPasswordItem();
      const updated = tagManager.setTags(item, ['WORK', '  Personal  ', 'Finance']);

      expect(updated.tags).toEqual(['work', 'personal', 'finance']);
    });

    it('should remove duplicate tags', () => {
      const item = createTestPasswordItem();
      const updated = tagManager.setTags(item, ['work', 'WORK', 'work']);

      expect(updated.tags).toEqual(['work']);
    });

    it('should filter out empty tags', () => {
      const item = createTestPasswordItem();
      const updated = tagManager.setTags(item, ['work', '', '  ', 'personal']);

      expect(updated.tags).toEqual(['work', 'personal']);
    });

    it('should handle empty array', () => {
      const item = createTestPasswordItem(['work']);
      const updated = tagManager.setTags(item, []);

      expect(updated.tags).toEqual([]);
    });
  });

  describe('hasTag', () => {
    it('should return true if item has the tag', () => {
      const item = createTestPasswordItem(['work', 'personal']);
      expect(tagManager.hasTag(item, 'work')).toBe(true);
    });

    it('should return false if item does not have the tag', () => {
      const item = createTestPasswordItem(['work']);
      expect(tagManager.hasTag(item, 'personal')).toBe(false);
    });

    it('should normalize tag before checking', () => {
      const item = createTestPasswordItem(['work']);
      expect(tagManager.hasTag(item, 'WORK')).toBe(true);
      expect(tagManager.hasTag(item, '  work  ')).toBe(true);
    });

    it('should return false for empty tag', () => {
      const item = createTestPasswordItem(['work']);
      expect(tagManager.hasTag(item, '')).toBe(false);
    });
  });

  describe('hasAnyTag', () => {
    it('should return true if item has at least one of the tags', () => {
      const item = createTestPasswordItem(['work', 'personal']);
      expect(tagManager.hasAnyTag(item, ['work', 'finance'])).toBe(true);
    });

    it('should return false if item has none of the tags', () => {
      const item = createTestPasswordItem(['work']);
      expect(tagManager.hasAnyTag(item, ['personal', 'finance'])).toBe(false);
    });

    it('should return false for empty tags array', () => {
      const item = createTestPasswordItem(['work']);
      expect(tagManager.hasAnyTag(item, [])).toBe(false);
    });

    it('should normalize tags before checking', () => {
      const item = createTestPasswordItem(['work']);
      expect(tagManager.hasAnyTag(item, ['WORK', 'Personal'])).toBe(true);
    });
  });

  describe('hasAllTags', () => {
    it('should return true if item has all of the tags', () => {
      const item = createTestPasswordItem(['work', 'personal', 'finance']);
      expect(tagManager.hasAllTags(item, ['work', 'personal'])).toBe(true);
    });

    it('should return false if item is missing any tag', () => {
      const item = createTestPasswordItem(['work', 'personal']);
      expect(tagManager.hasAllTags(item, ['work', 'finance'])).toBe(false);
    });

    it('should return true for empty tags array', () => {
      const item = createTestPasswordItem(['work']);
      expect(tagManager.hasAllTags(item, [])).toBe(true);
    });

    it('should normalize tags before checking', () => {
      const item = createTestPasswordItem(['work', 'personal']);
      expect(tagManager.hasAllTags(item, ['WORK', '  Personal  '])).toBe(true);
    });
  });

  describe('getAllTags', () => {
    it('should return all unique tags from items', () => {
      const items = [
        createTestPasswordItem(['work', 'personal']),
        createTestPasswordItem(['finance', 'work']),
        createTestPasswordItem(['personal']),
      ];

      const tags = tagManager.getAllTags(items);
      expect(tags).toEqual(['finance', 'personal', 'work']);
    });

    it('should return empty array for no items', () => {
      expect(tagManager.getAllTags([])).toEqual([]);
    });

    it('should return empty array for items with no tags', () => {
      const items = [
        createTestPasswordItem([]),
        createTestPasswordItem([]),
      ];

      expect(tagManager.getAllTags(items)).toEqual([]);
    });

    it('should return sorted tags', () => {
      const items = [
        createTestPasswordItem(['zebra', 'apple', 'banana']),
      ];

      const tags = tagManager.getAllTags(items);
      expect(tags).toEqual(['apple', 'banana', 'zebra']);
    });
  });

  describe('getTagUsage', () => {
    it('should count tag usage across items', () => {
      const items = [
        createTestPasswordItem(['work', 'personal']),
        createTestPasswordItem(['work', 'finance']),
        createTestPasswordItem(['personal']),
      ];

      const usage = tagManager.getTagUsage(items);
      expect(usage.get('work')).toBe(2);
      expect(usage.get('personal')).toBe(2);
      expect(usage.get('finance')).toBe(1);
    });

    it('should return empty map for no items', () => {
      const usage = tagManager.getTagUsage([]);
      expect(usage.size).toBe(0);
    });

    it('should handle items with no tags', () => {
      const items = [
        createTestPasswordItem([]),
        createTestPasswordItem(['work']),
      ];

      const usage = tagManager.getTagUsage(items);
      expect(usage.size).toBe(1);
      expect(usage.get('work')).toBe(1);
    });
  });

  describe('getTagStatistics', () => {
    it('should return comprehensive tag statistics', () => {
      const items = [
        createTestPasswordItem(['work', 'personal']),
        createTestPasswordItem(['work', 'finance']),
        createTestPasswordItem(['personal']),
        createTestPasswordItem([]),
      ];

      const stats = tagManager.getTagStatistics(items);
      expect(stats.totalTags).toBe(3);
      expect(stats.totalTaggedItems).toBe(3);
      expect(stats.tagUsage.get('work')).toBe(2);
      expect(stats.mostUsedTags).toEqual(['work', 'personal', 'finance']);
    });

    it('should sort most used tags by usage count', () => {
      const items = [
        createTestPasswordItem(['work']),
        createTestPasswordItem(['work']),
        createTestPasswordItem(['work']),
        createTestPasswordItem(['personal']),
        createTestPasswordItem(['personal']),
        createTestPasswordItem(['finance']),
      ];

      const stats = tagManager.getTagStatistics(items);
      expect(stats.mostUsedTags[0]).toBe('work');
      expect(stats.mostUsedTags[1]).toBe('personal');
      expect(stats.mostUsedTags[2]).toBe('finance');
    });
  });

  describe('filterByTag', () => {
    it('should filter items by tag', () => {
      const items = [
        createTestPasswordItem(['work']),
        createTestPasswordItem(['personal']),
        createTestPasswordItem(['work', 'finance']),
      ];

      const filtered = tagManager.filterByTag(items, 'work');
      expect(filtered).toHaveLength(2);
      expect(filtered[0]?.tags).toContain('work');
      expect(filtered[1]?.tags).toContain('work');
    });

    it('should normalize tag before filtering', () => {
      const items = [
        createTestPasswordItem(['work']),
        createTestPasswordItem(['personal']),
      ];

      const filtered = tagManager.filterByTag(items, 'WORK');
      expect(filtered).toHaveLength(1);
    });

    it('should return empty array for non-existent tag', () => {
      const items = [
        createTestPasswordItem(['work']),
      ];

      const filtered = tagManager.filterByTag(items, 'nonexistent');
      expect(filtered).toEqual([]);
    });

    it('should return empty array for empty tag', () => {
      const items = [
        createTestPasswordItem(['work']),
      ];

      const filtered = tagManager.filterByTag(items, '');
      expect(filtered).toEqual([]);
    });
  });

  describe('filterByAnyTag', () => {
    it('should filter items that have any of the tags', () => {
      const items = [
        createTestPasswordItem(['work']),
        createTestPasswordItem(['personal']),
        createTestPasswordItem(['finance']),
        createTestPasswordItem(['hobby']),
      ];

      const filtered = tagManager.filterByAnyTag(items, ['work', 'personal']);
      expect(filtered).toHaveLength(2);
    });

    it('should return empty array for empty tags', () => {
      const items = [
        createTestPasswordItem(['work']),
      ];

      const filtered = tagManager.filterByAnyTag(items, []);
      expect(filtered).toEqual([]);
    });
  });

  describe('filterByAllTags', () => {
    it('should filter items that have all of the tags', () => {
      const items = [
        createTestPasswordItem(['work', 'personal']),
        createTestPasswordItem(['work']),
        createTestPasswordItem(['work', 'personal', 'finance']),
      ];

      const filtered = tagManager.filterByAllTags(items, ['work', 'personal']);
      expect(filtered).toHaveLength(2);
    });

    it('should return all items for empty tags', () => {
      const items = [
        createTestPasswordItem(['work']),
        createTestPasswordItem(['personal']),
      ];

      const filtered = tagManager.filterByAllTags(items, []);
      expect(filtered).toHaveLength(2);
    });
  });

  describe('renameTag', () => {
    it('should rename a tag across all items', () => {
      const items = [
        createTestPasswordItem(['work', 'personal']),
        createTestPasswordItem(['work']),
        createTestPasswordItem(['finance']),
      ];

      const updated = tagManager.renameTag(items, 'work', 'business');
      expect(updated[0]?.tags).toContain('business');
      expect(updated[0]?.tags).not.toContain('work');
      expect(updated[1]?.tags).toContain('business');
      expect(updated[2]?.tags).not.toContain('business');
    });

    it('should normalize both old and new tags', () => {
      const items = [
        createTestPasswordItem(['work']),
      ];

      const updated = tagManager.renameTag(items, 'WORK', 'Business');
      expect(updated[0]?.tags).toEqual(['business']);
    });

    it('should handle duplicate tags after rename', () => {
      const items = [
        createTestPasswordItem(['work', 'business']),
      ];

      const updated = tagManager.renameTag(items, 'work', 'business');
      expect(updated[0]?.tags).toEqual(['business']);
    });

    it('should return unchanged items if old tag does not exist', () => {
      const items = [
        createTestPasswordItem(['work']),
      ];

      const updated = tagManager.renameTag(items, 'nonexistent', 'new');
      expect(updated[0]?.tags).toEqual(['work']);
    });
  });

  describe('deleteTag', () => {
    it('should delete a tag from all items', () => {
      const items = [
        createTestPasswordItem(['work', 'personal']),
        createTestPasswordItem(['work']),
        createTestPasswordItem(['finance']),
      ];

      const updated = tagManager.deleteTag(items, 'work');
      expect(updated[0]?.tags).toEqual(['personal']);
      expect(updated[1]?.tags).toEqual([]);
      expect(updated[2]?.tags).toEqual(['finance']);
    });

    it('should normalize tag before deleting', () => {
      const items = [
        createTestPasswordItem(['work']),
      ];

      const updated = tagManager.deleteTag(items, 'WORK');
      expect(updated[0]?.tags).toEqual([]);
    });
  });
});

describe('DocumentMetadataManager', () => {
  let metadataManager: DocumentMetadataManager;

  beforeEach(() => {
    metadataManager = createDocumentMetadataManager();
  });

  const createTestDocument = (
    size: number = 1024,
    mimeType: string = 'text/plain',
    tags: string[] = []
  ): DocumentItem => ({
    id: 'doc-id',
    type: 'document',
    title: 'Test Document',
    content: {
      type: 'text',
      data: new Uint8Array(size),
      mimeType,
      size,
    },
    createdAt: Date.now() - 1000,
    updatedAt: Date.now(),
    tags,
    notes: 'Test description',
  });

  describe('getMetadata', () => {
    it('should extract metadata from document', () => {
      const doc = createTestDocument(2048, 'application/pdf', ['work']);
      const metadata = metadataManager.getMetadata(doc);

      expect(metadata.fileSize).toBe(2048);
      expect(metadata.mimeType).toBe('application/pdf');
      expect(metadata.uploadedAt).toBe(doc.createdAt);
      expect(metadata.lastAccessedAt).toBe(doc.updatedAt);
      expect(metadata.tags).toEqual(['work']);
      expect(metadata.description).toBe('Test description');
    });
  });

  describe('updateMetadata', () => {
    it('should update document description', () => {
      const doc = createTestDocument();
      const updated = metadataManager.updateMetadata(doc, {
        description: 'New description',
      });

      expect(updated.notes).toBe('New description');
      expect(updated.updatedAt).toBeGreaterThanOrEqual(doc.updatedAt);
    });

    it('should update last accessed time', () => {
      const doc = createTestDocument();
      const newTime = Date.now() + 5000;
      const updated = metadataManager.updateMetadata(doc, {
        lastAccessedAt: newTime,
      });

      expect(updated.updatedAt).toBe(newTime);
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes', () => {
      expect(metadataManager.formatFileSize(0)).toBe('0 Bytes');
      expect(metadataManager.formatFileSize(100)).toBe('100 Bytes');
      expect(metadataManager.formatFileSize(1023)).toBe('1023 Bytes');
    });

    it('should format kilobytes', () => {
      expect(metadataManager.formatFileSize(1024)).toBe('1 KB');
      expect(metadataManager.formatFileSize(1536)).toBe('1.5 KB');
    });

    it('should format megabytes', () => {
      expect(metadataManager.formatFileSize(1024 * 1024)).toBe('1 MB');
      expect(metadataManager.formatFileSize(2.5 * 1024 * 1024)).toBe('2.5 MB');
    });

    it('should format gigabytes', () => {
      expect(metadataManager.formatFileSize(1024 * 1024 * 1024)).toBe('1 GB');
    });
  });

  describe('getFileExtension', () => {
    it('should return correct extension for text/plain', () => {
      expect(metadataManager.getFileExtension('text/plain')).toBe('.txt');
    });

    it('should return correct extension for image/jpeg', () => {
      expect(metadataManager.getFileExtension('image/jpeg')).toBe('.jpg');
    });

    it('should return correct extension for image/png', () => {
      expect(metadataManager.getFileExtension('image/png')).toBe('.png');
    });

    it('should return correct extension for application/pdf', () => {
      expect(metadataManager.getFileExtension('application/pdf')).toBe('.pdf');
    });

    it('should return empty string for unknown MIME type', () => {
      expect(metadataManager.getFileExtension('application/unknown')).toBe('');
    });
  });

  describe('filterByMimeType', () => {
    it('should filter documents by MIME type', () => {
      const docs = [
        createTestDocument(1024, 'text/plain'),
        createTestDocument(2048, 'application/pdf'),
        createTestDocument(512, 'text/plain'),
      ];

      const filtered = metadataManager.filterByMimeType(docs, 'text/plain');
      expect(filtered).toHaveLength(2);
      expect(filtered[0]?.content.mimeType).toBe('text/plain');
    });
  });

  describe('filterByContentType', () => {
    it('should filter documents by content type', () => {
      const docs = [
        { ...createTestDocument(), content: { ...createTestDocument().content, type: 'text' as const } },
        { ...createTestDocument(), content: { ...createTestDocument().content, type: 'pdf' as const } },
        { ...createTestDocument(), content: { ...createTestDocument().content, type: 'text' as const } },
      ];

      const filtered = metadataManager.filterByContentType(docs, 'text');
      expect(filtered).toHaveLength(2);
    });
  });

  describe('sortBySize', () => {
    it('should sort documents by size ascending', () => {
      const docs = [
        createTestDocument(2048),
        createTestDocument(512),
        createTestDocument(1024),
      ];

      const sorted = metadataManager.sortBySize(docs, true);
      expect(sorted[0]?.content.size).toBe(512);
      expect(sorted[1]?.content.size).toBe(1024);
      expect(sorted[2]?.content.size).toBe(2048);
    });

    it('should sort documents by size descending', () => {
      const docs = [
        createTestDocument(512),
        createTestDocument(2048),
        createTestDocument(1024),
      ];

      const sorted = metadataManager.sortBySize(docs, false);
      expect(sorted[0]?.content.size).toBe(2048);
      expect(sorted[1]?.content.size).toBe(1024);
      expect(sorted[2]?.content.size).toBe(512);
    });
  });

  describe('sortByUploadDate', () => {
    it('should sort documents by upload date newest first', () => {
      const now = Date.now();
      const docs = [
        { ...createTestDocument(), createdAt: now - 2000 },
        { ...createTestDocument(), createdAt: now },
        { ...createTestDocument(), createdAt: now - 1000 },
      ];

      const sorted = metadataManager.sortByUploadDate(docs, false);
      expect(sorted[0]?.createdAt).toBe(now);
      expect(sorted[1]?.createdAt).toBe(now - 1000);
      expect(sorted[2]?.createdAt).toBe(now - 2000);
    });

    it('should sort documents by upload date oldest first', () => {
      const now = Date.now();
      const docs = [
        { ...createTestDocument(), createdAt: now },
        { ...createTestDocument(), createdAt: now - 2000 },
        { ...createTestDocument(), createdAt: now - 1000 },
      ];

      const sorted = metadataManager.sortByUploadDate(docs, true);
      expect(sorted[0]?.createdAt).toBe(now - 2000);
      expect(sorted[1]?.createdAt).toBe(now - 1000);
      expect(sorted[2]?.createdAt).toBe(now);
    });
  });

  describe('getTotalSize', () => {
    it('should calculate total size of all documents', () => {
      const docs = [
        createTestDocument(1024),
        createTestDocument(2048),
        createTestDocument(512),
      ];

      const total = metadataManager.getTotalSize(docs);
      expect(total).toBe(3584);
    });

    it('should return 0 for empty array', () => {
      expect(metadataManager.getTotalSize([])).toBe(0);
    });
  });

  describe('getStatistics', () => {
    it('should return comprehensive document statistics', () => {
      const docs = [
        createTestDocument(1024, 'text/plain'),
        createTestDocument(2048, 'application/pdf'),
        createTestDocument(512, 'text/plain'),
      ];

      const stats = metadataManager.getStatistics(docs);
      expect(stats.totalDocuments).toBe(3);
      expect(stats.totalSize).toBe(3584);
      expect(stats.averageSize).toBe(3584 / 3);
      expect(stats.byType['text']).toBe(3);
      expect(stats.byMimeType['text/plain']).toBe(2);
      expect(stats.byMimeType['application/pdf']).toBe(1);
    });

    it('should handle empty document array', () => {
      const stats = metadataManager.getStatistics([]);
      expect(stats.totalDocuments).toBe(0);
      expect(stats.totalSize).toBe(0);
      expect(stats.averageSize).toBe(0);
    });
  });
});
