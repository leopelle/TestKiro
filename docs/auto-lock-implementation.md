# Auto-Lock Temporal Implementation

## Overview

This document describes the implementation of the auto-lock temporal feature for the Password Manager application, which automatically locks the vault after 5 minutes of inactivity.

**Requirement**: 1.5 - "QUANDO l'applicazione viene chiusa o va in background, IL Sistema DEVE bloccare automaticamente il vault dopo 5 minuti"

**Task**: 3.2 - Implementare auto-lock temporale

## Implementation Details

### Core Features

1. **Inactivity Timer**: Automatically locks the vault after 5 minutes (300,000 ms) of inactivity
2. **Timer Reset**: Allows resetting the timer on user activity
3. **Background/Foreground Handling**: Properly handles app lifecycle events
4. **Time Tracking**: Tracks elapsed time and remaining time until auto-lock

### New Methods Added to `DefaultAuthenticationService`

#### Public Methods

1. **`resetAutoLockTimer(): void`**
   - Resets the auto-lock timer to 5 minutes
   - Should be called on any user activity (taps, clicks, scrolls, etc.)
   - Only works when vault is unlocked

2. **`handleBackground(): void`**
   - Called when app goes to background
   - Pauses the auto-lock timer
   - Preserves the last activity time for calculation when returning to foreground

3. **`handleForeground(): void`**
   - Called when app comes back to foreground
   - Checks if total elapsed time exceeds 5 minutes
   - If exceeded: locks vault immediately
   - If not exceeded: resumes timer with remaining time

4. **`getAutoLockTimeRemaining(): number`**
   - Returns milliseconds remaining until auto-lock
   - Returns 0 if vault is locked or timer is not active
   - Useful for showing countdown to user

#### Private Methods

1. **`startAutoLockTimer(): void`**
   - Starts the auto-lock timer
   - Called automatically on successful authentication
   - Clears any existing timer before starting new one

2. **`stopAutoLockTimer(): void`**
   - Stops the auto-lock timer
   - Called when vault is locked or app goes to background

### Internal State

Added two new private fields to `DefaultAuthenticationService`:

```typescript
private autoLockTimer: NodeJS.Timeout | null = null;
private lastActivityTime: number = Date.now();
```

- `autoLockTimer`: Holds the timer reference for clearing
- `lastActivityTime`: Tracks when the timer was last started/reset

### Behavior

#### On Authentication Success
- Auto-lock timer starts automatically
- `lastActivityTime` is set to current time
- Timer will fire after 5 minutes if not reset

#### On User Activity
- Call `resetAutoLockTimer()` to restart the 5-minute countdown
- `lastActivityTime` is updated to current time
- Previous timer is cleared and new one is started

#### On Background
- Timer is stopped (not running while in background)
- `lastActivityTime` is preserved
- No battery drain from timer while app is backgrounded

#### On Foreground
- Total elapsed time is calculated: `now - lastActivityTime`
- If elapsed >= 5 minutes: vault locks immediately
- If elapsed < 5 minutes: timer resumes with remaining time
- Example: If 3 minutes elapsed, timer will fire in 2 minutes

#### On Manual Lock
- Timer is stopped
- Vault is locked
- `lastActivityTime` is not relevant when locked

## Testing

### Unit Tests Added

Added comprehensive unit tests in `src/auth/authentication-service.test.ts`:

1. ✅ Auto-lock timer starts on successful authentication
2. ✅ Vault doesn't lock before timeout expires
3. ✅ Timer resets on user activity
4. ✅ Timer doesn't reset when vault is locked
5. ✅ Timer stops when vault is locked manually
6. ✅ Background event stops timer
7. ✅ Foreground locks if timeout exceeded in background
8. ✅ Foreground resumes timer if timeout not exceeded
9. ✅ Foreground does nothing if already locked
10. ✅ Correct time remaining is returned
11. ✅ Zero time remaining when locked
12. ✅ Zero time remaining when timer not active

All tests use Jest's fake timers for deterministic testing.

### Test Results

```
✓ 50 tests passed in authentication-service.test.ts
✓ 124 total tests passed across all test suites
```

## Usage Examples

### Mobile App Integration

```typescript
import { createAuthenticationService } from './auth/authentication-service';

class MobileApp {
  private authService = createAuthenticationService();
  
  async onUserLogin(pin: string) {
    const result = await this.authService.authenticate(pin);
    if (result.success) {
      // Auto-lock timer started automatically
      console.log('Logged in - auto-lock in 5 minutes');
    }
  }
  
  onUserTap() {
    // Reset timer on any user interaction
    this.authService.resetAutoLockTimer();
  }
  
  onAppGoesToBackground() {
    this.authService.handleBackground();
  }
  
  onAppComesToForeground() {
    this.authService.handleForeground();
    
    if (this.authService.isLocked()) {
      // Show login screen
      this.showLoginScreen();
    }
  }
}
```

### Web App Integration

```typescript
import { createAuthenticationService } from './auth/authentication-service';

class WebApp {
  private authService = createAuthenticationService();
  
  constructor() {
    // Reset timer on user activity
    ['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(event => {
      document.addEventListener(event, () => {
        if (!this.authService.isLocked()) {
          this.authService.resetAutoLockTimer();
        }
      });
    });
    
    // Handle tab visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.authService.handleBackground();
      } else {
        this.authService.handleForeground();
        if (this.authService.isLocked()) {
          this.showLoginModal();
        }
      }
    });
  }
}
```

## Configuration

The auto-lock timeout is configured in `src/types/common.ts`:

```typescript
export const CONFIG = {
  AUTO_LOCK_TIMEOUT_MS: 5 * 60 * 1000, // 5 minutes
  // ... other config
};
```

To change the timeout, modify this constant. The value is in milliseconds.

## Security Considerations

1. **Timer Precision**: Uses `setTimeout` which is accurate enough for this use case
2. **Memory Cleanup**: Timer is properly cleared when vault is locked
3. **Background Handling**: Timer stops in background to prevent unexpected behavior
4. **Time Tracking**: Uses `Date.now()` for accurate elapsed time calculation
5. **No Data Leakage**: Only tracks timing, no sensitive data in timer callbacks

## Future Enhancements

Possible improvements for future versions:

1. **Configurable Timeout**: Allow users to set custom timeout (e.g., 1, 5, 10, 30 minutes)
2. **Warning Before Lock**: Show notification 30 seconds before auto-lock
3. **Activity Detection**: Automatically detect user activity without explicit calls
4. **Persistent State**: Save timer state to storage for recovery after app crash
5. **Biometric Re-auth**: Allow quick biometric unlock instead of PIN entry

## Related Files

- `src/auth/authentication-service.ts` - Main implementation
- `src/auth/authentication-service.test.ts` - Unit tests
- `src/auth/auto-lock-example.ts` - Usage examples
- `src/types/common.ts` - Configuration constants
- `src/types/crypto.ts` - Type definitions

## Compliance

This implementation satisfies:
- ✅ Requirement 1.5: Auto-lock after 5 minutes of inactivity
- ✅ Task 3.2: Implement inactivity timer and auto-lock
- ✅ Task 3.2: Handle background/foreground events
- ✅ Property 5: Auto-lock Temporal (to be tested with property-based tests in task 3.4)
