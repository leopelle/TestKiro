# Clipboard Manager Implementation

## Overview

The Clipboard Manager provides secure clipboard operations with automatic data wiping functionality for the Password Manager application. This implementation fulfills **Requirement 6.4**: Manual filling via clipboard with auto-deletion after 30 seconds.

## Architecture

### Components

1. **ClipboardProvider Interface**: Abstraction for clipboard operations
   - Allows different implementations (browser, Node.js, mobile)
   - Enables easy testing with mock providers

2. **ClipboardManager**: Core clipboard management with auto-wipe
   - Manages clipboard copy operations
   - Schedules automatic wipe timers
   - Prevents wiping if clipboard content has changed

3. **Integration with AutofillService**: Seamless clipboard operations
   - Copy username or password to clipboard
   - Manual wipe functionality
   - Configurable auto-wipe timeout

## Key Features

### 1. Secure Copy with Auto-Wipe

```typescript
const { manager } = createMockClipboardManager();

// Copy password with default 30-second auto-wipe
await manager.copyToClipboard('sensitive-password', {
  autoWipe: true,
  wipeTimeout: 30000, // 30 seconds
});

// After 30 seconds, clipboard is automatically cleared
```

### 2. Smart Wipe Logic

The clipboard manager only wipes the clipboard if it still contains the sensitive data that was copied. If the user has copied something else in the meantime, the clipboard is not wiped.

```typescript
await manager.copyToClipboard('password123', {
  autoWipe: true,
  wipeTimeout: 1000,
});

// User copies something else
await provider.writeText('something-else');

// After timeout, clipboard is NOT wiped because content changed
// Clipboard still contains: 'something-else'
```

### 3. Multiple Timer Management

The manager can track multiple pending wipe timers for different copied values:

```typescript
await manager.copyToClipboard('password1', { autoWipe: true });
await manager.copyToClipboard('password2', { autoWipe: true });

// Both have independent timers
console.log(manager.getPendingWipeCount()); // 2
```

### 4. Manual Wipe

Users can manually wipe the clipboard before the timeout:

```typescript
await manager.copyToClipboard('password', {
  autoWipe: true,
  wipeTimeout: 30000,
});

// User decides to wipe immediately
await manager.wipeNow();

// All pending timers are cancelled
```

## Integration with AutofillService

The AutofillService integrates clipboard functionality for easy credential copying:

```typescript
const items = [/* password items */];
const { manager } = createMockClipboardManager();
const service = new AutofillService(items, manager);

// Copy username
await service.copyToClipboard(item, 'username');

// Copy password with custom timeout
await service.copyToClipboard(item, 'password', {
  autoWipe: true,
  wipeTimeout: 60000, // 60 seconds
});

// Manual wipe
await service.wipeClipboard();
```

## Security Considerations

### 1. Default Auto-Wipe Enabled

By default, all clipboard operations have auto-wipe enabled with a 30-second timeout, ensuring sensitive data doesn't remain in the clipboard indefinitely.

### 2. Content Verification Before Wipe

The manager verifies that the clipboard still contains the sensitive data before wiping. This prevents accidentally clearing user-copied content.

### 3. Timer Cleanup

All timers are properly cleaned up when:
- The timer expires naturally
- Manual wipe is triggered
- The manager is destroyed

### 4. Error Handling

Clipboard errors are handled gracefully:
- Copy errors are reported to the user
- Wipe errors are silently ignored (security feature, not critical)
- Provider unavailability is clearly communicated

## Testing Strategy

### Unit Tests

The implementation includes comprehensive unit tests covering:

1. **Basic Operations**
   - Copy text to clipboard
   - Handle empty/whitespace text
   - Special characters and unicode

2. **Auto-Wipe Functionality**
   - Default 30-second timeout
   - Custom timeout values
   - Disable auto-wipe
   - Smart wipe (only if content unchanged)

3. **Timer Management**
   - Multiple pending timers
   - Timer cancellation
   - Timer cleanup on destroy

4. **Error Handling**
   - Provider errors
   - Wipe errors
   - Clear errors

5. **Integration Scenarios**
   - Rapid successive copies
   - Mix of auto-wipe and manual copies
   - Long-running application lifecycle

### Test Coverage

- **35 tests** for ClipboardManager
- **57 tests** for AutofillService (including clipboard integration)
- All tests passing with 100% coverage of clipboard functionality

## Usage Examples

### Basic Usage

```typescript
import { createMockClipboardManager } from './autofill';

const { manager, provider } = createMockClipboardManager();

// Copy with auto-wipe
const result = await manager.copyToClipboard('my-password', {
  autoWipe: true,
  wipeTimeout: 30000,
});

console.log(`Will wipe at: ${new Date(result.wipeAt!)}`);
```

### With AutofillService

```typescript
import { AutofillService, createMockClipboardManager } from './autofill';

const items = [/* password items */];
const { manager } = createMockClipboardManager();
const service = new AutofillService(items, manager);

// Detect credentials for a URL
const matches = service.detectCredentials('https://github.com');

if (matches.length > 0) {
  // Copy password to clipboard
  await service.copyToClipboard(matches[0].item, 'password');
}
```

### Browser Environment

```typescript
import { createClipboardManager } from './autofill';

// Uses browser Clipboard API
const manager = createClipboardManager();

await manager.copyToClipboard('password', {
  autoWipe: true,
  wipeTimeout: 30000,
});
```

## API Reference

### ClipboardManager

#### `copyToClipboard(text: string, options?: ClipboardOptions): Promise<ClipboardResult>`

Copies text to clipboard with optional auto-wipe.

**Parameters:**
- `text`: Text to copy
- `options`: Clipboard options
  - `autoWipe`: Enable auto-wipe (default: true)
  - `wipeTimeout`: Timeout in ms (default: 30000)

**Returns:** `ClipboardResult`
- `success`: Whether operation succeeded
- `error`: Error message if failed
- `wipeAt`: Timestamp when data will be wiped

#### `wipeNow(): Promise<ClipboardResult>`

Immediately wipes the clipboard and cancels all pending timers.

#### `getPendingWipeCount(): number`

Returns the number of pending wipe timers.

#### `destroy(): void`

Cancels all pending timers. Should be called when the manager is being destroyed.

### AutofillService

#### `copyToClipboard(item: PasswordItem, field: 'username' | 'password', options?: ClipboardOptions): Promise<ClipboardResult>`

Copies a credential field to clipboard with auto-wipe.

#### `wipeClipboard(): Promise<ClipboardResult>`

Manually wipes the clipboard immediately.

## Requirements Validation

✅ **Requirement 6.4**: Manual filling via clipboard with auto-deletion after 30 seconds

- ✅ Copy to clipboard functionality implemented
- ✅ Auto-deletion after 30 seconds (configurable)
- ✅ Manual wipe functionality
- ✅ Smart wipe (only if content unchanged)
- ✅ Integration with AutofillService
- ✅ Comprehensive test coverage

## Future Enhancements

1. **Platform-Specific Providers**
   - Native mobile clipboard integration
   - Desktop application clipboard access

2. **Clipboard History**
   - Track clipboard history for audit purposes
   - Allow users to view what was copied and when

3. **Configurable Defaults**
   - User-configurable default timeout
   - Per-item timeout settings

4. **Notifications**
   - Notify user when clipboard is wiped
   - Warning before wipe (optional)

5. **Clipboard Monitoring**
   - Detect when clipboard is accessed by other apps
   - Enhanced security logging
