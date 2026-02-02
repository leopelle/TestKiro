# Universal Search Engine Implementation

## Overview

The Universal Search Engine provides comprehensive search functionality across all vault items (passwords, credit cards, and documents) in the Password Manager application. It implements efficient indexing for performance optimization and supports searching by multiple fields.

## Requirements

- **Requirement 2.2**: Search passwords by title, username, or URL
- **Requirement 4.5**: Search documents by title, content, and tags

## Features

### Search Capabilities

The search engine supports searching across the following fields:

#### Password Items
- **Title**: Full and partial matching
- **Username**: Full and partial matching
- **URL**: Full and partial matching
- **Tags**: Exact tag matching

#### Credit Card Items
- **Title**: Full and partial matching
- **Holder Name**: Full and partial matching
- **Card Number**: Last 4 digits only (for security)
- **Tags**: Exact tag matching

#### Document Items
- **Title**: Full and partial matching
- **Text Content**: Full text search (for text documents only)
- **Tags**: Exact tag matching

### Search Options

The search engine supports various search options:

```typescript
interface SearchQuery {
  query: string;              // The search term
  caseSensitive?: boolean;    // Case-sensitive search (default: false)
  exactMatch?: boolean;       // Exact matching (default: false, uses partial)
  itemType?: string;          // Filter by item type
  tags?: string[];            // Filter by tags (OR logic)
  limit?: number;             // Maximum results to return
}
```

### Relevance Scoring

Search results are ranked by relevance with the following priority:

1. **Title matches** (highest priority, score: 10)
   - Bonus +5 for exact title match
2. **Tag matches** (high priority, score: 8)
3. **Card number matches** (high priority, score: 9)
4. **Username matches** (medium priority, score: 7)
5. **Holder name matches** (medium priority, score: 7)
6. **URL matches** (medium priority, score: 6)
7. **Content matches** (lowest priority, score: 3)

Scores are normalized to a 0-1 range for consistency.

### Indexing

The search engine implements automatic indexing for performance:

- **Index Building**: Extracts searchable terms from all vault items
- **Term Extraction**: Creates searchable terms from:
  - Full field values
  - Individual words
  - Partial prefixes (2-10 characters)
- **Auto-Rebuild**: Automatically rebuilds index when items change
- **Index Statistics**: Provides stats on indexed items and terms

#### Index Structure

```typescript
interface SearchIndex {
  termToItems: Map<string, Set<string>>;  // Term → Item IDs
  itemContent: Map<string, SearchableContent>;  // Item ID → Content
  lastUpdated: number;  // Timestamp
}
```

### Security Considerations

- **Credit Card Numbers**: Only the last 4 digits are indexed for security
- **Sensitive Data**: Full card numbers and CVVs are never indexed
- **Index Clearing**: Index can be cleared when vault is locked

## API Reference

### Core Methods

#### `buildIndex(items: VaultItem[]): void`

Builds or rebuilds the search index from vault items.

```typescript
searchEngine.buildIndex(vaultItems);
```

#### `search(items: VaultItem[], query: SearchQuery): SearchResult[]`

Performs a comprehensive search with options.

```typescript
const results = searchEngine.search(vaultItems, {
  query: 'github',
  itemType: 'password',
  limit: 10
});
```

#### `simpleSearch(items: VaultItem[], queryText: string): VaultItem[]`

Convenience method for basic text search.

```typescript
const items = searchEngine.simpleSearch(vaultItems, 'github');
```

### Specialized Search Methods

#### `searchByTag(items: VaultItem[], tag: string): VaultItem[]`

Searches for items with a specific tag.

```typescript
const workItems = searchEngine.searchByTag(vaultItems, 'work');
```

#### `searchByAnyTag(items: VaultItem[], tags: string[]): VaultItem[]`

Searches for items with any of the specified tags (OR logic).

```typescript
const items = searchEngine.searchByAnyTag(vaultItems, ['work', 'personal']);
```

#### `searchByUrl(items: VaultItem[], url: string): PasswordItem[]`

Searches password items by URL.

```typescript
const githubPasswords = searchEngine.searchByUrl(vaultItems, 'github.com');
```

#### `searchByUsername(items: VaultItem[], username: string): PasswordItem[]`

Searches password items by username.

```typescript
const userPasswords = searchEngine.searchByUsername(vaultItems, 'john.doe');
```

### Index Management

#### `clearIndex(): void`

Clears the search index (useful when locking vault).

```typescript
searchEngine.clearIndex();
```

#### `getIndexStats(): IndexStats | null`

Gets statistics about the current index.

```typescript
const stats = searchEngine.getIndexStats();
console.log(`Indexed ${stats.totalItems} items with ${stats.totalTerms} terms`);
```

## Usage Examples

### Basic Search

```typescript
import { createSearchEngine } from './search';

const searchEngine = createSearchEngine();

// Build index
searchEngine.buildIndex(vaultItems);

// Simple search
const results = searchEngine.simpleSearch(vaultItems, 'github');
```

### Advanced Search

```typescript
// Search with filters
const results = searchEngine.search(vaultItems, {
  query: 'john',
  itemType: 'password',
  tags: ['work'],
  limit: 5
});

// Process results
results.forEach(result => {
  console.log(`Found: ${result.item.title}`);
  console.log(`Score: ${result.score}`);
  console.log(`Matched fields: ${result.matchedFields.join(', ')}`);
});
```

### Case-Sensitive Search

```typescript
const results = searchEngine.search(vaultItems, {
  query: 'GitHub',
  caseSensitive: true
});
```

### Exact Match Search

```typescript
const results = searchEngine.search(vaultItems, {
  query: 'GitHub Account',
  exactMatch: true
});
```

### Search by Multiple Tags

```typescript
const workItems = searchEngine.searchByAnyTag(vaultItems, ['work', 'development']);
```

### Search Passwords by URL

```typescript
const githubPasswords = searchEngine.searchByUrl(vaultItems, 'github.com');
```

## Integration with VaultManager

The search engine is designed to work seamlessly with the VaultManager:

```typescript
import { createVaultManager } from './vault';
import { createSearchEngine } from './search';

const vaultManager = createVaultManager(cryptoEngine);
const searchEngine = createSearchEngine();

// Load vault
await vaultManager.loadVault(masterKey);

// Get all items
const items = vaultManager.getAllItems();

// Build search index
searchEngine.buildIndex(items);

// Search
const results = searchEngine.search(items, { query: 'github' });
```

## Performance Considerations

### Index Building

- Index building is O(n × m) where n is the number of items and m is the average number of terms per item
- Recommended to build index once after loading vault
- Auto-rebuild triggers when item count changes

### Search Performance

- Search is O(k) where k is the number of items (with index)
- Without index, search would be O(n × m) for each query
- Index provides significant performance improvement for large vaults

### Memory Usage

- Index stores term mappings and searchable content
- Memory usage is proportional to vault size
- Index can be cleared to free memory when vault is locked

## Testing

The search engine includes comprehensive unit tests covering:

- Basic search functionality
- Password, credit card, and document searches
- Tag-based searching
- Filtering and limiting results
- Relevance scoring
- Case sensitivity
- Edge cases (empty queries, special characters, Unicode)
- Index management

Run tests with:

```bash
npm test -- src/search/search-engine.test.ts
```

## Future Enhancements

Potential improvements for future versions:

1. **Fuzzy Matching**: Support for typo-tolerant search
2. **Search History**: Track and suggest recent searches
3. **Advanced Filters**: Date ranges, file types, etc.
4. **Search Highlighting**: Highlight matched terms in results
5. **Persistent Index**: Save index to disk for faster startup
6. **Full-Text Search**: More advanced text search for documents
7. **Search Suggestions**: Auto-complete and suggestions
8. **Boolean Operators**: Support for AND, OR, NOT in queries

## Security Notes

- The search engine operates on decrypted vault data in memory
- Index should be cleared when vault is locked
- Credit card numbers are only partially indexed (last 4 digits)
- No sensitive data is logged or exposed in search operations
- Search queries are not persisted or transmitted

## Conclusion

The Universal Search Engine provides a robust, efficient, and secure way to search across all vault items. It balances performance with security and provides a flexible API for various search scenarios.
