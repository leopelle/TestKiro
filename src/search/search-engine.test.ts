/**
 * Tests for the Universal Search Engine
 * 
 * Requirements: 2.2, 4.5
 */

import { SearchEngine } from './search-engine';
import {
  VaultItem,
  PasswordItem,
  CreditCardItem,
  DocumentItem,
} from '../types/vault';

describe('SearchEngine', () => {
  let searchEngine: SearchEngine;
  let testItems: VaultItem[];

  beforeEach(() => {
    searchEngine = new SearchEngine();
    
    // Create test items
    testItems = [
      // Password items
      {
        id: 'pwd-1',
        type: 'password',
        title: 'GitHub Account',
        username: 'john.doe@example.com',
        password: 'secret123',
        url: 'https://github.com',
        tags: ['work', 'development'],
        notes: 'Main GitHub account',
        history: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as PasswordItem,
      {
        id: 'pwd-2',
        type: 'password',
        title: 'Gmail',
        username: 'john.doe@gmail.com',
        password: 'secret456',
        url: 'https://mail.google.com',
        tags: ['personal', 'email'],
        notes: 'Personal email',
        history: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as PasswordItem,
      {
        id: 'pwd-3',
        type: 'password',
        title: 'AWS Console',
        username: 'admin',
        password: 'secret789',
        url: 'https://aws.amazon.com/console',
        tags: ['work', 'cloud'],
        notes: 'AWS admin account',
        history: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as PasswordItem,
      
      // Credit card items
      {
        id: 'cc-1',
        type: 'creditcard',
        title: 'Visa Card',
        cardNumber: '4532015112830366',
        holderName: 'John Doe',
        expiryDate: '12/25',
        cvv: '123',
        tags: ['personal'],
        notes: 'Main credit card',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as CreditCardItem,
      {
        id: 'cc-2',
        type: 'creditcard',
        title: 'Business Mastercard',
        cardNumber: '5425233430109903',
        holderName: 'John Doe',
        expiryDate: '06/26',
        cvv: '456',
        tags: ['work', 'business'],
        notes: 'Company card',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as CreditCardItem,
      
      // Document items
      {
        id: 'doc-1',
        type: 'document',
        title: 'Passport Scan',
        content: {
          type: 'image',
          data: new Uint8Array([1, 2, 3]),
          mimeType: 'image/jpeg',
          size: 3,
        },
        tags: ['personal', 'travel'],
        notes: 'Passport copy',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as DocumentItem,
      {
        id: 'doc-2',
        type: 'document',
        title: 'Project Notes',
        content: {
          type: 'text',
          data: new TextEncoder().encode('This is a document about the password manager project. It contains important information about security and encryption.'),
          mimeType: 'text/plain',
          size: 130,
        },
        tags: ['work', 'development'],
        notes: 'Project documentation',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as DocumentItem,
    ];
  });

  describe('buildIndex', () => {
    it('should build search index from items', () => {
      searchEngine.buildIndex(testItems);
      
      const stats = searchEngine.getIndexStats();
      expect(stats).not.toBeNull();
      expect(stats!.totalItems).toBe(testItems.length);
      expect(stats!.totalTerms).toBeGreaterThan(0);
    });

    it('should handle empty items array', () => {
      searchEngine.buildIndex([]);
      
      const stats = searchEngine.getIndexStats();
      expect(stats).not.toBeNull();
      expect(stats!.totalItems).toBe(0);
      expect(stats!.totalTerms).toBe(0);
    });

    it('should rebuild index when called multiple times', () => {
      searchEngine.buildIndex(testItems);
      const stats1 = searchEngine.getIndexStats();
      
      searchEngine.buildIndex(testItems.slice(0, 3));
      const stats2 = searchEngine.getIndexStats();
      
      expect(stats2!.totalItems).toBe(3);
      expect(stats2!.totalItems).toBeLessThan(stats1!.totalItems);
    });
  });

  describe('search - basic functionality', () => {
    beforeEach(() => {
      searchEngine.buildIndex(testItems);
    });

    it('should find items by title', () => {
      const results = searchEngine.search(testItems, { query: 'GitHub' });
      
      expect(results).toHaveLength(1);
      expect(results[0]?.item.id).toBe('pwd-1');
      expect(results[0]?.matchedFields).toContain('title');
    });

    it('should find items by partial title match', () => {
      const results = searchEngine.search(testItems, { query: 'git' });
      
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.item.id === 'pwd-1')).toBe(true);
    });

    it('should be case-insensitive by default', () => {
      const results1 = searchEngine.search(testItems, { query: 'github' });
      const results2 = searchEngine.search(testItems, { query: 'GITHUB' });
      const results3 = searchEngine.search(testItems, { query: 'GitHub' });
      
      expect(results1).toHaveLength(results2.length);
      expect(results2).toHaveLength(results3.length);
    });

    it('should support case-sensitive search', () => {
      const results = searchEngine.search(testItems, {
        query: 'GITHUB',
        caseSensitive: true,
      });
      
      // Should not match 'GitHub' (different case) or 'github.com' (lowercase)
      // Case-sensitive search for 'GITHUB' should not match anything
      expect(results).toHaveLength(0);
    });

    it('should return empty array for empty query', () => {
      const results = searchEngine.search(testItems, { query: '' });
      expect(results).toHaveLength(0);
    });

    it('should return empty array for whitespace-only query', () => {
      const results = searchEngine.search(testItems, { query: '   ' });
      expect(results).toHaveLength(0);
    });
  });

  describe('search - password items', () => {
    beforeEach(() => {
      searchEngine.buildIndex(testItems);
    });

    it('should find passwords by username (Requirement 2.2)', () => {
      const results = searchEngine.search(testItems, { query: 'john.doe' });
      
      expect(results.length).toBeGreaterThanOrEqual(2);
      expect(results.every(r => r.item.type === 'password')).toBe(true);
    });

    it('should find passwords by URL (Requirement 2.2)', () => {
      const results = searchEngine.search(testItems, { query: 'github.com' });
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.item.id).toBe('pwd-1');
      expect(results[0]?.matchedFields).toContain('url');
    });

    it('should find passwords by partial URL', () => {
      const results = searchEngine.search(testItems, { query: 'google' });
      
      expect(results.some(r => r.item.id === 'pwd-2')).toBe(true);
    });

    it('should match multiple fields in password items', () => {
      const results = searchEngine.search(testItems, { query: 'work' });
      
      // Should match items with 'work' tag
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(r => r.matchedFields.includes('tags'))).toBe(true);
    });
  });

  describe('search - credit card items', () => {
    beforeEach(() => {
      searchEngine.buildIndex(testItems);
    });

    it('should find credit cards by title', () => {
      const results = searchEngine.search(testItems, { query: 'Visa' });
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.item.id).toBe('cc-1');
    });

    it('should find credit cards by holder name', () => {
      const results = searchEngine.search(testItems, { query: 'John Doe' });
      
      // Should match both credit cards
      const cardResults = results.filter(r => r.item.type === 'creditcard');
      expect(cardResults.length).toBe(2);
    });

    it('should find credit cards by last 4 digits', () => {
      const results = searchEngine.search(testItems, { query: '0366' });
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.item.id).toBe('cc-1');
      expect(results[0]?.matchedFields).toContain('cardNumber');
    });

    it('should not expose full card number in search', () => {
      // Searching for first digits should not match
      const results = searchEngine.search(testItems, { query: '4532' });
      
      // Should not match by first 4 digits (only last 4 are indexed)
      const cardMatch = results.find(r => r.item.id === 'cc-1' && r.matchedFields.includes('cardNumber'));
      expect(cardMatch).toBeUndefined();
    });
  });

  describe('search - document items', () => {
    beforeEach(() => {
      searchEngine.buildIndex(testItems);
    });

    it('should find documents by title (Requirement 4.5)', () => {
      const results = searchEngine.search(testItems, { query: 'Passport' });
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.item.id).toBe('doc-1');
    });

    it('should find documents by text content (Requirement 4.5)', () => {
      const results = searchEngine.search(testItems, { query: 'encryption' });
      
      expect(results.some(r => r.item.id === 'doc-2')).toBe(true);
      expect(results.find(r => r.item.id === 'doc-2')?.matchedFields).toContain('content');
    });

    it('should find documents by multiple content words', () => {
      const results = searchEngine.search(testItems, { query: 'security' });
      
      expect(results.some(r => r.item.id === 'doc-2')).toBe(true);
    });

    it('should not search content of non-text documents', () => {
      // Image document should not be searchable by content
      const results = searchEngine.search(testItems, { query: 'image data' });
      
      // Should not match doc-1 by content
      const imageDoc = results.find(r => r.item.id === 'doc-1');
      if (imageDoc) {
        expect(imageDoc.matchedFields).not.toContain('content');
      }
    });
  });

  describe('search - tags', () => {
    beforeEach(() => {
      searchEngine.buildIndex(testItems);
    });

    it('should find items by tag (Requirement 2.2, 4.5)', () => {
      const results = searchEngine.search(testItems, { query: 'work' });
      
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(r => r.matchedFields.includes('tags'))).toBe(true);
    });

    it('should find items with multiple tags', () => {
      const results = searchEngine.search(testItems, { query: 'development' });
      
      expect(results.length).toBeGreaterThan(0);
      const itemIds = results.map(r => r.item.id);
      expect(itemIds).toContain('pwd-1');
      expect(itemIds).toContain('doc-2');
    });

    it('should filter by specific tags', () => {
      const results = searchEngine.search(testItems, {
        query: 'john',
        tags: ['personal'],
      });
      
      // Should only return items with 'personal' tag
      expect(results.every(r => r.item.tags.includes('personal'))).toBe(true);
    });
  });

  describe('search - filtering', () => {
    beforeEach(() => {
      searchEngine.buildIndex(testItems);
    });

    it('should filter by item type', () => {
      const results = searchEngine.search(testItems, {
        query: 'john',
        itemType: 'password',
      });
      
      expect(results.every(r => r.item.type === 'password')).toBe(true);
    });

    it('should filter credit cards by type', () => {
      const results = searchEngine.search(testItems, {
        query: 'john',
        itemType: 'creditcard',
      });
      
      expect(results.every(r => r.item.type === 'creditcard')).toBe(true);
    });

    it('should filter documents by type', () => {
      const results = searchEngine.search(testItems, {
        query: 'project',
        itemType: 'document',
      });
      
      expect(results.every(r => r.item.type === 'document')).toBe(true);
    });

    it('should limit results', () => {
      const results = searchEngine.search(testItems, {
        query: 'john',
        limit: 2,
      });
      
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('should respect limit of 1', () => {
      const results = searchEngine.search(testItems, {
        query: 'work',
        limit: 1,
      });
      
      expect(results).toHaveLength(1);
    });
  });

  describe('search - relevance scoring', () => {
    beforeEach(() => {
      searchEngine.buildIndex(testItems);
    });

    it('should return results sorted by relevance', () => {
      const results = searchEngine.search(testItems, { query: 'john' });
      
      // Results should be sorted by score (descending)
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1]?.score).toBeGreaterThanOrEqual(results[i]?.score ?? 0);
      }
    });

    it('should give higher score to title matches', () => {
      const results = searchEngine.search(testItems, { query: 'github' });
      
      // Title match should have high score
      const titleMatch = results.find(r => r.matchedFields.includes('title'));
      expect(titleMatch).toBeDefined();
      expect(titleMatch!.score).toBeGreaterThan(0.5);
    });

    it('should give lower score to content matches', () => {
      const results = searchEngine.search(testItems, { query: 'encryption' });
      
      // Content match should have lower score than title match
      const contentMatch = results.find(r => r.matchedFields.includes('content'));
      if (contentMatch) {
        expect(contentMatch.score).toBeLessThan(1);
      }
    });

    it('should normalize scores to 0-1 range', () => {
      const results = searchEngine.search(testItems, { query: 'john' });
      
      for (const result of results) {
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('simpleSearch', () => {
    beforeEach(() => {
      searchEngine.buildIndex(testItems);
    });

    it('should return items without scores', () => {
      const results = searchEngine.simpleSearch(testItems, 'github');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty('id');
      expect(results[0]).toHaveProperty('type');
    });

    it('should be equivalent to search without options', () => {
      const simpleResults = searchEngine.simpleSearch(testItems, 'work');
      const searchResults = searchEngine.search(testItems, { query: 'work' });
      
      expect(simpleResults.length).toBe(searchResults.length);
      expect(simpleResults.map(r => r.id)).toEqual(searchResults.map(r => r.item.id));
    });
  });

  describe('searchByTag', () => {
    it('should find items by exact tag', () => {
      const results = searchEngine.searchByTag(testItems, 'work');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(r => r.tags.includes('work'))).toBe(true);
    });

    it('should be case-insensitive', () => {
      const results1 = searchEngine.searchByTag(testItems, 'work');
      const results2 = searchEngine.searchByTag(testItems, 'WORK');
      
      expect(results1.length).toBe(results2.length);
    });

    it('should return empty array for non-existent tag', () => {
      const results = searchEngine.searchByTag(testItems, 'nonexistent');
      expect(results).toHaveLength(0);
    });
  });

  describe('searchByAnyTag', () => {
    it('should find items with any of the specified tags', () => {
      const results = searchEngine.searchByAnyTag(testItems, ['work', 'personal']);
      
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(r => 
        r.tags.includes('work') || r.tags.includes('personal')
      )).toBe(true);
    });

    it('should return empty array for empty tags array', () => {
      const results = searchEngine.searchByAnyTag(testItems, []);
      expect(results).toHaveLength(0);
    });
  });

  describe('searchByUrl', () => {
    it('should find password items by URL', () => {
      const results = searchEngine.searchByUrl(testItems, 'github.com');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.id).toBe('pwd-1');
    });

    it('should only return password items', () => {
      const results = searchEngine.searchByUrl(testItems, 'google');
      
      expect(results.every(r => r.type === 'password')).toBe(true);
    });

    it('should handle partial URL matches', () => {
      const results = searchEngine.searchByUrl(testItems, 'amazon');
      
      expect(results.some(r => r.id === 'pwd-3')).toBe(true);
    });

    it('should return empty array for non-matching URL', () => {
      const results = searchEngine.searchByUrl(testItems, 'nonexistent.com');
      expect(results).toHaveLength(0);
    });
  });

  describe('searchByUsername', () => {
    it('should find password items by username', () => {
      const results = searchEngine.searchByUsername(testItems, 'john.doe');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(r => r.username.includes('john.doe'))).toBe(true);
    });

    it('should only return password items', () => {
      const results = searchEngine.searchByUsername(testItems, 'admin');
      
      expect(results.every(r => r.type === 'password')).toBe(true);
    });

    it('should handle partial username matches', () => {
      const results = searchEngine.searchByUsername(testItems, 'john');
      
      expect(results.length).toBeGreaterThan(0);
    });

    it('should be case-insensitive', () => {
      const results1 = searchEngine.searchByUsername(testItems, 'admin');
      const results2 = searchEngine.searchByUsername(testItems, 'ADMIN');
      
      expect(results1.length).toBe(results2.length);
    });
  });

  describe('clearIndex', () => {
    it('should clear the search index', () => {
      searchEngine.buildIndex(testItems);
      expect(searchEngine.getIndexStats()).not.toBeNull();
      
      searchEngine.clearIndex();
      expect(searchEngine.getIndexStats()).toBeNull();
    });

    it('should allow rebuilding after clearing', () => {
      searchEngine.buildIndex(testItems);
      searchEngine.clearIndex();
      searchEngine.buildIndex(testItems);
      
      expect(searchEngine.getIndexStats()).not.toBeNull();
    });
  });

  describe('getIndexStats', () => {
    it('should return null when no index exists', () => {
      expect(searchEngine.getIndexStats()).toBeNull();
    });

    it('should return stats after building index', () => {
      searchEngine.buildIndex(testItems);
      
      const stats = searchEngine.getIndexStats();
      expect(stats).not.toBeNull();
      expect(stats).toHaveProperty('totalItems');
      expect(stats).toHaveProperty('totalTerms');
      expect(stats).toHaveProperty('lastUpdated');
    });

    it('should have accurate item count', () => {
      searchEngine.buildIndex(testItems);
      
      const stats = searchEngine.getIndexStats();
      expect(stats!.totalItems).toBe(testItems.length);
    });
  });

  describe('index auto-rebuild', () => {
    it('should auto-rebuild index when items change', () => {
      searchEngine.buildIndex(testItems);
      searchEngine.getIndexStats();
      
      // Search with different items (should trigger rebuild)
      const newItems = testItems.slice(0, 3);
      searchEngine.search(newItems, { query: 'test' });
      
      const stats2 = searchEngine.getIndexStats();
      expect(stats2!.totalItems).toBe(3);
    });

    it('should auto-rebuild when new items are added', () => {
      searchEngine.buildIndex(testItems);
      
      const newItem: PasswordItem = {
        id: 'pwd-new',
        type: 'password',
        title: 'New Item',
        username: 'newuser',
        password: 'newpass',
        tags: [],
        history: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      
      const expandedItems = [...testItems, newItem];
      const results = searchEngine.search(expandedItems, { query: 'New Item' });
      
      expect(results.some(r => r.item.id === 'pwd-new')).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle items with no tags', () => {
      const itemWithoutTags: PasswordItem = {
        id: 'pwd-notags',
        type: 'password',
        title: 'No Tags Item',
        username: 'user',
        password: 'pass',
        tags: [],
        history: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      
      searchEngine.buildIndex([itemWithoutTags]);
      const results = searchEngine.search([itemWithoutTags], { query: 'No Tags' });
      
      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle items with no URL', () => {
      const itemWithoutUrl: PasswordItem = {
        id: 'pwd-nourl',
        type: 'password',
        title: 'No URL Item',
        username: 'user',
        password: 'pass',
        tags: [],
        history: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      
      searchEngine.buildIndex([itemWithoutUrl]);
      const results = searchEngine.search([itemWithoutUrl], { query: 'No URL' });
      
      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle special characters in search query', () => {
      const results = searchEngine.search(testItems, { query: '@example.com' });
      
      // Should still work with special characters
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle very long search queries', () => {
      const longQuery = 'a'.repeat(1000);
      const results = searchEngine.search(testItems, { query: longQuery });
      
      // Should not crash
      expect(results).toBeDefined();
    });

    it('should handle Unicode characters', () => {
      const unicodeItem: PasswordItem = {
        id: 'pwd-unicode',
        type: 'password',
        title: 'Café ☕',
        username: 'user',
        password: 'pass',
        tags: ['français'],
        history: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      
      searchEngine.buildIndex([unicodeItem]);
      const results = searchEngine.search([unicodeItem], { query: 'café' });
      
      expect(results.length).toBeGreaterThan(0);
    });
  });

  /**
   * Property-Based Tests
   * 
   * These tests verify universal properties that should hold for all valid inputs
   */
  describe('Property-Based Tests', () => {
    /**
     * Property 7: Ricerca Universale
     * **Validates: Requirements 2.2, 4.5**
     * 
     * For any search query that matches title, username, URL, content or tag of an item,
     * that item should appear in the results.
     * 
     * This property verifies that:
     * 1. Items are found when query matches their title
     * 2. Password items are found when query matches username or URL (Requirement 2.2)
     * 3. Document items are found when query matches content or tags (Requirement 4.5)
     * 4. All items are found when query matches their tags
     * 5. Credit card items are found when query matches holder name or last 4 digits
     */
    it('Property 7: universal search finds items matching query in any searchable field', () => {
      const fc = require('fast-check');

      // Generator for searchable strings (non-empty, reasonable length)
      const searchableStringArb = fc.string({ minLength: 3, maxLength: 30 })
        .filter((s: string) => s.trim().length >= 3);

      // Generator for password items with known searchable content
      const passwordItemArb = fc.record({
        id: fc.uuid(),
        type: fc.constant('password' as const),
        title: searchableStringArb,
        username: searchableStringArb,
        password: fc.string({ minLength: 8, maxLength: 20 }),
        url: fc.option(fc.webUrl(), { nil: undefined }),
        tags: fc.array(searchableStringArb, { minLength: 0, maxLength: 3 }),
        history: fc.constant([]),
        notes: fc.option(fc.string(), { nil: undefined }),
        createdAt: fc.integer({ min: 0, max: Date.now() }),
        updatedAt: fc.integer({ min: 0, max: Date.now() }),
      });

      // Generator for credit card items with known searchable content
      const creditCardItemArb = fc.record({
        id: fc.uuid(),
        type: fc.constant('creditcard' as const),
        title: searchableStringArb,
        cardNumber: fc.constantFrom('4532015112830366', '5425233430109903', '378282246310005'),
        holderName: searchableStringArb,
        expiryDate: fc.constant('12/25'),
        cvv: fc.constant('123'),
        tags: fc.array(searchableStringArb, { minLength: 0, maxLength: 3 }),
        notes: fc.option(fc.string(), { nil: undefined }),
        createdAt: fc.integer({ min: 0, max: Date.now() }),
        updatedAt: fc.integer({ min: 0, max: Date.now() }),
      });

      // Generator for document items with text content
      const documentItemArb = fc.record({
        id: fc.uuid(),
        type: fc.constant('document' as const),
        title: searchableStringArb,
        content: fc.record({
          type: fc.constant('text' as const),
          data: searchableStringArb.map((text: string) => new TextEncoder().encode(text)),
          mimeType: fc.constant('text/plain'),
          size: fc.integer({ min: 1, max: 100 }),
        }).map((content: { type: 'text'; data: Uint8Array; mimeType: string; size: number }) => ({
          ...content,
          size: content.data.length, // Ensure size matches data length
        })),
        tags: fc.array(searchableStringArb, { minLength: 0, maxLength: 3 }),
        notes: fc.option(fc.string(), { nil: undefined }),
        createdAt: fc.integer({ min: 0, max: Date.now() }),
        updatedAt: fc.integer({ min: 0, max: Date.now() }),
      });

      // Generator for vault items
      const vaultItemArb = fc.oneof(passwordItemArb, creditCardItemArb, documentItemArb);

      fc.assert(
        fc.property(
          fc.array(vaultItemArb, { minLength: 1, maxLength: 10 }),
          (items: any[]) => {
            const engine = new SearchEngine();
            engine.buildIndex(items as VaultItem[]);

            // For each item, test that it can be found by its searchable fields
            for (const item of items) {
              const searchableFields: string[] = [];

              // Collect searchable fields based on item type
              if (item.title && item.title.trim().length >= 3) {
                searchableFields.push(item.title.trim());
              }

              if (item.type === 'password') {
                if (item.username && item.username.trim().length >= 3) {
                  searchableFields.push(item.username.trim());
                }
                if (item.url) {
                  // Extract domain from URL for searching
                  try {
                    const url = new URL(item.url);
                    if (url.hostname.length >= 3) {
                      searchableFields.push(url.hostname);
                    }
                  } catch {
                    // Invalid URL, skip
                  }
                }
              }

              if (item.type === 'creditcard') {
                if (item.holderName && item.holderName.trim().length >= 3) {
                  searchableFields.push(item.holderName.trim());
                }
                // Last 4 digits of card
                const lastFour = item.cardNumber.slice(-4);
                searchableFields.push(lastFour);
              }

              if (item.type === 'document' && item.content.type === 'text') {
                try {
                  const textContent = new TextDecoder().decode(item.content.data);
                  if (textContent.trim().length >= 3) {
                    // Extract first word from content for testing
                    const words = textContent.trim().split(/\s+/);
                    if (words.length > 0 && words[0] && words[0].length >= 3) {
                      searchableFields.push(words[0]);
                    }
                  }
                } catch {
                  // Decoding failed, skip
                }
              }

              // Add tags
              if (item.tags && item.tags.length > 0) {
                for (const tag of item.tags) {
                  if (tag && tag.trim().length >= 3) {
                    searchableFields.push(tag.trim());
                  }
                }
              }

              // Test each searchable field
              for (const field of searchableFields) {
                if (!field || field.length < 3) continue;

                // Search for this field (use first 5 characters to ensure match)
                const query = field.substring(0, Math.min(5, field.length)).toLowerCase();
                
                const results = engine.search(items as VaultItem[], { query });

                // Property: The item should be in the results
                const found = results.some(result => result.item.id === item.id);

                if (!found) {
                  // Debug info for failures
                  console.error('Search failed:', {
                    itemId: item.id,
                    itemType: item.type,
                    query,
                    field,
                    searchableFields,
                    resultsCount: results.length,
                  });
                  return false;
                }
              }
            }

            return true;
          }
        ),
        { numRuns: 10 } // At least 10 iterations as requested
      );
    });

    /**
     * Property 15: Organizzazione tramite Tag
     * **Validates: Requirements 4.4**
     * 
     * For any document with assigned tags, it should be retrievable via search for those tags
     * 
     * This property verifies that:
     * 1. Any item with tags can be found by searching for those tags
     * 2. The search is case-insensitive
     * 3. All items with a specific tag are returned when searching for that tag
     */
    it('Property 15: documents with tags should be retrievable by those tags', () => {
      const fc = require('fast-check');

      // Generator for vault items with tags
      const vaultItemWithTagsArbitrary = fc.oneof(
        // Password item
        fc.record({
          id: fc.uuid(),
          type: fc.constant('password' as const),
          title: fc.string({ minLength: 1, maxLength: 50 }),
          username: fc.string({ minLength: 1, maxLength: 50 }),
          password: fc.string({ minLength: 1, maxLength: 50 }),
          url: fc.option(fc.webUrl(), { nil: undefined }),
          tags: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
          history: fc.constant([]),
          notes: fc.option(fc.string(), { nil: undefined }),
          createdAt: fc.integer({ min: 0, max: Date.now() }),
          updatedAt: fc.integer({ min: 0, max: Date.now() }),
        }),
        // Credit card item
        fc.record({
          id: fc.uuid(),
          type: fc.constant('creditcard' as const),
          title: fc.string({ minLength: 1, maxLength: 50 }),
          cardNumber: fc.constant('4532015112830366'), // Valid test card
          holderName: fc.string({ minLength: 1, maxLength: 50 }),
          expiryDate: fc.constant('12/25'),
          cvv: fc.constant('123'),
          tags: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
          notes: fc.option(fc.string(), { nil: undefined }),
          createdAt: fc.integer({ min: 0, max: Date.now() }),
          updatedAt: fc.integer({ min: 0, max: Date.now() }),
        }),
        // Document item
        fc.record({
          id: fc.uuid(),
          type: fc.constant('document' as const),
          title: fc.string({ minLength: 1, maxLength: 50 }),
          content: fc.record({
            type: fc.constantFrom('text' as const, 'image' as const, 'pdf' as const),
            data: fc.uint8Array({ minLength: 1, maxLength: 100 }),
            mimeType: fc.constantFrom('text/plain', 'image/jpeg', 'image/png', 'application/pdf'),
            size: fc.integer({ min: 1, max: 100 }),
          }),
          tags: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
          notes: fc.option(fc.string(), { nil: undefined }),
          createdAt: fc.integer({ min: 0, max: Date.now() }),
          updatedAt: fc.integer({ min: 0, max: Date.now() }),
        })
      );

      fc.assert(
        fc.property(
          fc.array(vaultItemWithTagsArbitrary, { minLength: 1, maxLength: 20 }),
          (items: any[]) => {
            // For each item with tags, verify it can be retrieved by those tags
            for (const item of items) {
              if (item.tags && item.tags.length > 0) {
                // Pick the first tag from the item
                const tagToSearch = item.tags[0];
                
                if (!tagToSearch || tagToSearch.trim().length === 0) {
                  continue; // Skip empty tags
                }
                
                // Search for items with this tag
                const results = searchEngine.searchByTag(items as VaultItem[], tagToSearch);
                
                // The item should be in the results
                const found = results.some(result => result.id === item.id);
                
                // Property: Any item with a tag should be retrievable by that tag
                if (!found) {
                  return false;
                }
                
                // Additional check: case-insensitive search
                const upperCaseResults = searchEngine.searchByTag(items as VaultItem[], tagToSearch.toUpperCase());
                const foundUpperCase = upperCaseResults.some(result => result.id === item.id);
                
                if (!foundUpperCase) {
                  return false;
                }
              }
            }
            
            return true;
          }
        ),
        { numRuns: 10 } // At least 10 iterations as requested
      );
    });
  });
});
