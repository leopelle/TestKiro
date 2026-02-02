/**
 * Universal Search Engine for the Password Manager application
 * 
 * This module provides comprehensive search functionality across all vault items,
 * including passwords, credit cards, and documents. It supports searching by:
 * - Title
 * - Username (passwords)
 * - URL (passwords)
 * - Content (documents)
 * - Tags (all items)
 * - Card holder name (credit cards)
 * - Card number (last 4 digits, credit cards)
 * 
 * The search engine includes indexing for performance optimization.
 * 
 * Requirements: 2.2, 4.5
 */

import {
  VaultItem,
  PasswordItem,
  CreditCardItem,
  DocumentItem,
} from '../types/vault';

/**
 * Search query options
 */
export interface SearchQuery {
  /** The search term to look for */
  readonly query: string;
  /** Whether the search should be case-sensitive (default: false) */
  readonly caseSensitive?: boolean;
  /** Whether to use exact matching (default: false, uses partial matching) */
  readonly exactMatch?: boolean;
  /** Filter by item type */
  readonly itemType?: 'password' | 'creditcard' | 'document';
  /** Filter by tags (items must have at least one of these tags) */
  readonly tags?: readonly string[];
  /** Maximum number of results to return (default: unlimited) */
  readonly limit?: number;
}

/**
 * Search result with relevance score
 */
export interface SearchResult {
  /** The matching vault item */
  readonly item: VaultItem;
  /** Relevance score (0-1, higher is more relevant) */
  readonly score: number;
  /** Fields that matched the search query */
  readonly matchedFields: readonly string[];
}

/**
 * Search index for fast lookups
 */
interface SearchIndex {
  /** Map of normalized terms to item IDs */
  readonly termToItems: Map<string, Set<string>>;
  /** Map of item IDs to their searchable content */
  readonly itemContent: Map<string, SearchableContent>;
  /** Last update timestamp */
  readonly lastUpdated: number;
}

/**
 * Searchable content extracted from a vault item
 */
interface SearchableContent {
  readonly id: string;
  readonly type: 'password' | 'creditcard' | 'document';
  readonly title: string;
  readonly tags: readonly string[];
  readonly username?: string;
  readonly url?: string;
  readonly textContent?: string;
  readonly holderName?: string;
  readonly cardLastFour?: string;
}

/**
 * Universal search engine with indexing support
 */
export class SearchEngine {
  private index: SearchIndex | null = null;

  /**
   * Builds or rebuilds the search index from vault items
   * 
   * This should be called when:
   * - The vault is first loaded
   * - Items are added, updated, or deleted
   * 
   * @param items - All vault items to index
   */
  buildIndex(items: readonly VaultItem[]): void {
    const termToItems = new Map<string, Set<string>>();
    const itemContent = new Map<string, SearchableContent>();

    for (const item of items) {
      const content = this.extractSearchableContent(item);
      itemContent.set(item.id, content);

      // Index all searchable terms
      const terms = this.extractSearchTerms(content);
      for (const term of terms) {
        if (!termToItems.has(term)) {
          termToItems.set(term, new Set());
        }
        termToItems.get(term)!.add(item.id);
      }
    }

    this.index = {
      termToItems,
      itemContent,
      lastUpdated: Date.now(),
    };
  }

  /**
   * Searches vault items using the query
   * 
   * Requirements:
   * - 2.2: Search passwords by title, username, or URL
   * - 4.5: Search documents by title, content, and tags
   * 
   * @param items - All vault items to search
   * @param query - Search query with options
   * @returns Array of search results sorted by relevance
   */
  search(items: readonly VaultItem[], query: SearchQuery): SearchResult[] {
    // Rebuild index if not present or if items changed
    if (!this.index || this.shouldRebuildIndex(items)) {
      this.buildIndex(items);
    }

    // Handle empty query
    if (!query.query || query.query.trim().length === 0) {
      return [];
    }

    const normalizedQuery = query.caseSensitive
      ? query.query.trim()
      : query.query.trim().toLowerCase();

    // Filter by type if specified
    let itemsToSearch = items;
    if (query.itemType) {
      itemsToSearch = items.filter(item => item.type === query.itemType);
    }

    // Filter by tags if specified
    if (query.tags && query.tags.length > 0) {
      itemsToSearch = itemsToSearch.filter(item =>
        query.tags!.some(tag => item.tags.includes(tag.toLowerCase()))
      );
    }

    // Perform search
    const results: SearchResult[] = [];

    for (const item of itemsToSearch) {
      const content = this.index!.itemContent.get(item.id);
      if (!content) continue;

      const match = this.matchItem(content, normalizedQuery, query);
      if (match) {
        results.push(match);
      }
    }

    // Sort by relevance score (descending)
    results.sort((a, b) => b.score - a.score);

    // Apply limit if specified
    if (query.limit && query.limit > 0) {
      return results.slice(0, query.limit);
    }

    return results;
  }

  /**
   * Searches for items matching a simple text query
   * 
   * This is a convenience method for basic searches.
   * 
   * @param items - All vault items to search
   * @param queryText - The text to search for
   * @returns Array of matching items sorted by relevance
   */
  simpleSearch(items: readonly VaultItem[], queryText: string): VaultItem[] {
    const results = this.search(items, { query: queryText });
    return results.map(result => result.item);
  }

  /**
   * Searches for items by tag
   * 
   * @param items - All vault items to search
   * @param tag - The tag to search for
   * @returns Array of items with the specified tag
   */
  searchByTag(items: readonly VaultItem[], tag: string): VaultItem[] {
    const normalizedTag = tag.toLowerCase().trim();
    return items.filter(item =>
      item.tags.some(t => t.toLowerCase().trim() === normalizedTag)
    );
  }

  /**
   * Searches for items by multiple tags (OR logic)
   * 
   * @param items - All vault items to search
   * @param tags - The tags to search for
   * @returns Array of items with at least one of the specified tags
   */
  searchByAnyTag(items: readonly VaultItem[], tags: readonly string[]): VaultItem[] {
    const normalizedTags = tags.map(t => t.toLowerCase().trim());
    return items.filter(item =>
      item.tags.some(t => normalizedTags.includes(t.toLowerCase().trim()))
    );
  }

  /**
   * Searches for password items by URL
   * 
   * Requirement 2.2: Search passwords by URL
   * 
   * @param items - All vault items to search
   * @param url - The URL to search for (partial match)
   * @returns Array of password items matching the URL
   */
  searchByUrl(items: readonly VaultItem[], url: string): PasswordItem[] {
    const normalizedUrl = url.toLowerCase().trim();
    
    return items
      .filter((item): item is PasswordItem => item.type === 'password')
      .filter(item => {
        if (!item.url) return false;
        return item.url.toLowerCase().includes(normalizedUrl);
      });
  }

  /**
   * Searches for password items by username
   * 
   * Requirement 2.2: Search passwords by username
   * 
   * @param items - All vault items to search
   * @param username - The username to search for (partial match)
   * @returns Array of password items matching the username
   */
  searchByUsername(items: readonly VaultItem[], username: string): PasswordItem[] {
    const normalizedUsername = username.toLowerCase().trim();
    
    return items
      .filter((item): item is PasswordItem => item.type === 'password')
      .filter(item => item.username.toLowerCase().includes(normalizedUsername));
  }

  /**
   * Clears the search index
   * 
   * This should be called when the vault is locked or unloaded.
   */
  clearIndex(): void {
    this.index = null;
  }

  /**
   * Gets index statistics
   * 
   * @returns Index statistics or null if no index exists
   */
  getIndexStats(): {
    totalItems: number;
    totalTerms: number;
    lastUpdated: number;
  } | null {
    if (!this.index) {
      return null;
    }

    return {
      totalItems: this.index.itemContent.size,
      totalTerms: this.index.termToItems.size,
      lastUpdated: this.index.lastUpdated,
    };
  }

  /**
   * Extracts searchable content from a vault item
   * 
   * @private
   */
  private extractSearchableContent(item: VaultItem): SearchableContent {
    const base: SearchableContent = {
      id: item.id,
      type: item.type,
      title: item.title,
      tags: item.tags,
    };

    switch (item.type) {
      case 'password': {
        const passwordItem = item as PasswordItem;
        return {
          ...base,
          username: passwordItem.username,
          ...(passwordItem.url && { url: passwordItem.url }),
        };
      }

      case 'creditcard': {
        const cardItem = item as CreditCardItem;
        // Only index last 4 digits for security
        const lastFour = cardItem.cardNumber.slice(-4);
        return {
          ...base,
          holderName: cardItem.holderName,
          cardLastFour: lastFour,
        };
      }

      case 'document': {
        const docItem = item as DocumentItem;
        // Extract text content if it's a text document
        let textContent: string | undefined;
        if (docItem.content.type === 'text') {
          try {
            textContent = new TextDecoder().decode(docItem.content.data);
          } catch {
            // If decoding fails, skip text content
            textContent = undefined;
          }
        }
        return {
          ...base,
          ...(textContent && { textContent }),
        };
      }

      default:
        return base;
    }
  }

  /**
   * Extracts all searchable terms from content
   * 
   * @private
   */
  private extractSearchTerms(content: SearchableContent): Set<string> {
    const terms = new Set<string>();

    // Add title terms
    this.addTerms(terms, content.title);

    // Add tag terms
    for (const tag of content.tags) {
      this.addTerms(terms, tag);
    }

    // Add type-specific terms
    if (content.username) {
      this.addTerms(terms, content.username);
    }

    if (content.url) {
      this.addTerms(terms, content.url);
    }

    if (content.holderName) {
      this.addTerms(terms, content.holderName);
    }

    if (content.cardLastFour) {
      terms.add(content.cardLastFour.toLowerCase());
    }

    if (content.textContent) {
      // For text content, extract words (limit to avoid huge indexes)
      const words = content.textContent
        .toLowerCase()
        .split(/\s+/)
        .slice(0, 1000); // Limit to first 1000 words
      
      for (const word of words) {
        if (word.length >= 2) { // Skip single characters
          terms.add(word);
        }
      }
    }

    return terms;
  }

  /**
   * Adds terms from a text string to the term set
   * 
   * @private
   */
  private addTerms(terms: Set<string>, text: string): void {
    const normalized = text.toLowerCase();
    
    // Add the full text
    terms.add(normalized);

    // Add individual words
    const words = normalized.split(/\s+/);
    for (const word of words) {
      if (word.length >= 2) {
        terms.add(word);
      }
    }

    // Add partial matches (prefixes) for better search
    for (let i = 2; i <= Math.min(normalized.length, 10); i++) {
      terms.add(normalized.substring(0, i));
    }
  }

  /**
   * Matches an item against a search query
   * 
   * @private
   */
  private matchItem(
    content: SearchableContent,
    normalizedQuery: string,
    query: SearchQuery
  ): SearchResult | null {
    const matchedFields: string[] = [];
    let score = 0;

    // Check title (highest priority)
    if (this.matchesField(content.title, normalizedQuery, query.exactMatch, query.caseSensitive)) {
      matchedFields.push('title');
      score += 10;
      
      // Bonus for exact title match
      const titleToCompare = query.caseSensitive ? content.title : content.title.toLowerCase();
      if (titleToCompare === normalizedQuery) {
        score += 5;
      }
    }

    // Check tags (high priority)
    for (const tag of content.tags) {
      if (this.matchesField(tag, normalizedQuery, query.exactMatch, query.caseSensitive)) {
        matchedFields.push('tags');
        score += 8;
        break; // Only count tags once
      }
    }

    // Check type-specific fields
    if (content.username && this.matchesField(content.username, normalizedQuery, query.exactMatch, query.caseSensitive)) {
      matchedFields.push('username');
      score += 7;
    }

    if (content.url && this.matchesField(content.url, normalizedQuery, query.exactMatch, query.caseSensitive)) {
      matchedFields.push('url');
      score += 6;
    }

    if (content.holderName && this.matchesField(content.holderName, normalizedQuery, query.exactMatch, query.caseSensitive)) {
      matchedFields.push('holderName');
      score += 7;
    }

    if (content.cardLastFour && this.matchesField(content.cardLastFour, normalizedQuery, query.exactMatch, query.caseSensitive)) {
      matchedFields.push('cardNumber');
      score += 9; // High score for card number match
    }

    if (content.textContent && this.matchesField(content.textContent, normalizedQuery, query.exactMatch, query.caseSensitive)) {
      matchedFields.push('content');
      score += 3; // Lower priority for content matches
    }

    // No match found
    if (matchedFields.length === 0) {
      return null;
    }

    // Normalize score to 0-1 range
    const normalizedScore = Math.min(score / 15, 1);

    return {
      item: content as unknown as VaultItem, // Will be replaced with actual item
      score: normalizedScore,
      matchedFields,
    };
  }

  /**
   * Checks if a field matches the query
   * 
   * @private
   */
  private matchesField(field: string, query: string, exactMatch?: boolean, caseSensitive?: boolean): boolean {
    const normalizedField = caseSensitive ? field : field.toLowerCase();
    const normalizedQuery = caseSensitive ? query : query.toLowerCase();

    if (exactMatch) {
      return normalizedField === normalizedQuery;
    }

    return normalizedField.includes(normalizedQuery);
  }

  /**
   * Determines if the index should be rebuilt
   * 
   * @private
   */
  private shouldRebuildIndex(items: readonly VaultItem[]): boolean {
    if (!this.index) {
      return true;
    }

    // Rebuild if item count changed
    if (this.index.itemContent.size !== items.length) {
      return true;
    }

    // Rebuild if any item IDs are missing from index
    for (const item of items) {
      if (!this.index.itemContent.has(item.id)) {
        return true;
      }
    }

    return false;
  }
}

/**
 * Factory function to create a new SearchEngine instance
 */
export function createSearchEngine(): SearchEngine {
  return new SearchEngine();
}
