# Password History Implementation

## Overview

This document describes the implementation of password history management for the Password Manager application, fulfilling **Requirement 2.5**: "QUANDO l'utente modifica una password esistente, IL Sistema DEVE mantenere uno storico delle ultime 5 versioni".

## Implementation Details

### Core Functionality

The password history feature is implemented in the `VaultManager` class with the following key behaviors:

1. **Automatic History Tracking**: When a password is updated, the old password is automatically added to the history
2. **Limit of 5 Versions**: The system maintains only the last 5 password versions
3. **Automatic Rotation**: When the 6th password change occurs, the oldest entry is automatically removed
4. **Chronological Order**: History entries are stored with the most recent change first

### Implementation Location

- **File**: `src/vault/vault-manager.ts`
- **Methods**:
  - `updateItem()`: Enhanced to detect password changes and trigger history updates
  - `updatePasswordHistory()`: Private method that manages the history array

### Data Structure

Password history is stored in the `PasswordItem` interface:

```typescript
interface PasswordHistory {
  readonly password: string;
  readonly changedAt: Timestamp;
}

interface PasswordItem extends VaultItem {
  readonly type: 'password';
  readonly username: string;
  readonly password: string;
  readonly url?: string;
  readonly history: readonly PasswordHistory[];
}
```

### Key Features

#### 1. Smart Change Detection

The system only adds to history when the password actually changes:

```typescript
// Only add to history if password actually changed
if (newPassword !== oldPassword) {
  finalUpdates = this.updatePasswordHistory(passwordItem, oldPassword, now, updates);
}
```

This prevents unnecessary history entries when:
- Updating other fields (title, username, URL, etc.)
- Setting the password to the same value

#### 2. Automatic Rotation

The history is automatically limited to 5 entries:

```typescript
// Add to beginning of history array
existingHistory.unshift(newHistoryEntry);

// Limit to 5 most recent entries (automatic rotation)
const limitedHistory = existingHistory.slice(0, 5);
```

When a 6th password change occurs, the oldest entry is automatically removed.

#### 3. Timestamp Tracking

Each history entry includes a timestamp:

```typescript
const newHistoryEntry = {
  password: oldPassword,
  changedAt: timestamp,
};
```

This allows tracking when each password was used.

#### 4. Persistence

Password history is:
- Encrypted along with the rest of the vault data
- Persisted across save/load cycles
- Validated during deserialization

## Usage Examples

### Adding a Password Item

```typescript
const passwordItem: Omit<PasswordItem, 'id' | 'createdAt' | 'updatedAt'> = {
  type: 'password',
  title: 'My Account',
  username: 'user@example.com',
  password: 'initialPassword123',
  url: 'https://example.com',
  tags: [],
  history: [], // Empty history for new items
};

const id = await vaultManager.addItem(passwordItem, masterKey);
```

### Updating a Password

```typescript
// Update the password
await vaultManager.updateItem(id, { password: 'newPassword456' }, masterKey);

// Retrieve the item to see history
const item = vaultManager.getItem(id) as PasswordItem;
console.log(item.password); // 'newPassword456'
console.log(item.history.length); // 1
console.log(item.history[0]?.password); // 'initialPassword123'
```

### Multiple Password Changes

```typescript
// Change password multiple times
await vaultManager.updateItem(id, { password: 'password2' }, masterKey);
await vaultManager.updateItem(id, { password: 'password3' }, masterKey);
await vaultManager.updateItem(id, { password: 'password4' }, masterKey);

const item = vaultManager.getItem(id) as PasswordItem;
console.log(item.password); // 'password4'
console.log(item.history.length); // 3
console.log(item.history[0]?.password); // 'password3' (most recent)
console.log(item.history[1]?.password); // 'password2'
console.log(item.history[2]?.password); // 'initialPassword123' (oldest)
```

### Automatic Rotation After 5 Changes

```typescript
// Change password 7 times total
for (let i = 2; i <= 8; i++) {
  await vaultManager.updateItem(id, { password: `password${i}` }, masterKey);
}

const item = vaultManager.getItem(id) as PasswordItem;
console.log(item.password); // 'password8'
console.log(item.history.length); // 5 (limited to 5)
console.log(item.history[0]?.password); // 'password7'
console.log(item.history[4]?.password); // 'password3'
// 'initialPassword123' and 'password2' have been rotated out
```

## Testing

Comprehensive tests have been implemented in `src/vault/vault-manager.test.ts`:

### Test Coverage

1. **Basic History Addition**: Verifies old password is added to history
2. **No Change Detection**: Ensures history is not updated when password doesn't change
3. **Same Value Detection**: Ensures history is not updated when password is set to same value
4. **Chronological Order**: Verifies history is maintained with newest first
5. **Automatic Rotation**: Verifies only 5 entries are kept
6. **Existing History Preservation**: Verifies new entries are added to existing history
7. **Persistence**: Verifies history survives save/load cycles
8. **Mixed Updates**: Verifies password history works with other field updates
9. **Non-Password Items**: Verifies other item types are not affected

### Running Tests

```bash
npm test -- src/vault/vault-manager.test.ts
```

All 35 tests pass, including 9 specific password history tests.

## Security Considerations

1. **Encryption**: Password history is encrypted along with the rest of the vault data
2. **No Plaintext Storage**: History entries are never stored in plaintext
3. **Access Control**: History is only accessible when the vault is unlocked
4. **Memory Management**: History entries are cleared when the vault is locked

## Validation

The password history is validated as part of the `PasswordItem` validation:

```typescript
// Validate history limit
if (item.history && item.history.length > CONFIG.PASSWORD_HISTORY_LIMIT) {
  errors.push(`Password history cannot exceed ${CONFIG.PASSWORD_HISTORY_LIMIT} entries`);
}
```

This ensures that:
- History never exceeds 5 entries
- Invalid history data is rejected during deserialization
- Data integrity is maintained

## Future Enhancements

Potential future improvements:

1. **Configurable Limit**: Allow users to configure the history limit
2. **History Viewing UI**: Add UI to view and restore previous passwords
3. **History Export**: Include history in backup exports
4. **History Search**: Allow searching through password history
5. **History Comparison**: Show differences between password versions

## Compliance

This implementation fully satisfies **Requirement 2.5**:
- ✅ Maintains history of last 5 versions
- ✅ Automatic rotation when limit is exceeded
- ✅ Timestamps for each change
- ✅ Encrypted storage
- ✅ Persistence across sessions

## Related Files

- `src/vault/vault-manager.ts` - Main implementation
- `src/vault/vault-manager.test.ts` - Test suite
- `src/types/vault.ts` - Type definitions and validation
- `src/types/common.ts` - Configuration constants
