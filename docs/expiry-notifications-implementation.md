# Credit Card Expiry Notification System

## Overview

The expiry notification system provides functionality to monitor credit cards and alert users when cards are approaching their expiration date. This implements **Requirement 3.5**: Show warning when card expires within 30 days.

## Implementation

### Core Components

1. **`calculateDaysUntilExpiry(expiryDate: string): number`**
   - Calculates the number of days until a card expires
   - Returns negative values for expired cards
   - Handles MM/YY format expiry dates

2. **`createExpiryNotification(card: CreditCardItem, config?: ExpiryNotificationConfig): ExpiryNotification | null`**
   - Creates a notification for a single credit card
   - Returns `null` if the card is not expiring within the threshold
   - Supports custom configuration for warning and critical thresholds

3. **`checkExpiringCards(cards: CreditCardItem[], config?: ExpiryNotificationConfig): ExpiryNotification[]`**
   - Checks multiple credit cards and returns notifications for expiring cards
   - Automatically sorts notifications by urgency (most urgent first)
   - Main function for batch checking cards

### Notification Severity Levels

- **Warning**: Card expires within 30 days (default) but more than 7 days away
- **Critical**: Card expires within 7 days (default) or has already expired

### Configuration

```typescript
interface ExpiryNotificationConfig {
  warningThreshold: number;  // Days before expiry to show warning (default: 30)
  criticalThreshold: number; // Days before expiry to show critical alert (default: 7)
}
```

## Usage Examples

### Basic Usage - Check All Cards

```typescript
import { checkExpiringCards } from './creditcard/expiry-notifications';
import { CreditCardItem } from './types/vault';

// Get all credit cards from vault
const cards: CreditCardItem[] = vault.getItemsByType('creditcard');

// Check for expiring cards
const notifications = checkExpiringCards(cards);

// Display notifications to user
if (notifications.length > 0) {
  console.log(`You have ${notifications.length} card(s) expiring soon:`);
  notifications.forEach(notification => {
    console.log(`- ${notification.message}`);
  });
}
```

### Filter by Severity

```typescript
import { 
  checkExpiringCards, 
  filterNotificationsBySeverity,
  getExpiryNotificationCounts 
} from './creditcard/expiry-notifications';

const notifications = checkExpiringCards(cards);

// Get counts by severity
const counts = getExpiryNotificationCounts(notifications);
console.log(`Critical: ${counts.critical}, Warning: ${counts.warning}`);

// Show only critical notifications
const criticalNotifications = filterNotificationsBySeverity(notifications, 'critical');
if (criticalNotifications.length > 0) {
  console.log('URGENT: The following cards need immediate attention:');
  criticalNotifications.forEach(n => console.log(`- ${n.message}`));
}
```

### Custom Configuration

```typescript
import { checkExpiringCards } from './creditcard/expiry-notifications';

// Custom thresholds: warn at 60 days, critical at 14 days
const config = {
  warningThreshold: 60,
  criticalThreshold: 14,
};

const notifications = checkExpiringCards(cards, config);
```

### Check Single Card

```typescript
import { createExpiryNotification } from './creditcard/expiry-notifications';

const card: CreditCardItem = vault.getItem('card-id');
const notification = createExpiryNotification(card);

if (notification) {
  console.log(notification.message);
  console.log(`Days until expiry: ${notification.daysUntilExpiry}`);
  console.log(`Severity: ${notification.severity}`);
}
```

### Integration with UI

```typescript
import { checkExpiringCards } from './creditcard/expiry-notifications';

function displayExpiryWarnings(cards: CreditCardItem[]) {
  const notifications = checkExpiringCards(cards);
  
  // Group by severity for display
  const critical = notifications.filter(n => n.severity === 'critical');
  const warnings = notifications.filter(n => n.severity === 'warning');
  
  // Display critical alerts prominently
  if (critical.length > 0) {
    showCriticalAlert({
      title: 'Cards Expiring Soon!',
      message: `${critical.length} card(s) need immediate attention`,
      items: critical.map(n => ({
        title: n.cardTitle,
        message: n.message,
        daysLeft: n.daysUntilExpiry,
      })),
    });
  }
  
  // Display warnings in notification area
  if (warnings.length > 0) {
    showWarningBadge(warnings.length);
  }
}
```

### Scheduled Checks

```typescript
import { checkExpiringCards } from './creditcard/expiry-notifications';

// Check for expiring cards daily
function scheduleDailyExpiryCheck() {
  setInterval(() => {
    const cards = vault.getItemsByType('creditcard');
    const notifications = checkExpiringCards(cards);
    
    if (notifications.length > 0) {
      // Send push notification or email
      sendExpiryNotifications(notifications);
    }
  }, 24 * 60 * 60 * 1000); // 24 hours
}
```

## Notification Object Structure

```typescript
interface ExpiryNotification {
  cardId: string;              // Unique ID of the credit card
  cardTitle: string;           // User-friendly title of the card
  expiryDate: string;          // Expiry date in MM/YY format
  daysUntilExpiry: number;     // Days until expiry (negative if expired)
  severity: 'warning' | 'critical';  // Notification severity
  message: string;             // Human-readable notification message
}
```

## Message Examples

The system generates contextual messages based on the expiry status:

- **Expired**: "Credit card "My Visa" has expired"
- **Expires today**: "Credit card "My Visa" expires today"
- **Expires tomorrow**: "Credit card "My Visa" expires tomorrow"
- **Critical (2-7 days)**: "URGENT: Credit card "My Visa" expires in 5 days"
- **Warning (8-30 days)**: "Credit card "My Visa" expires in 20 days"

## Testing

The implementation includes comprehensive tests:

- **Unit tests**: Specific examples and edge cases
- **Property-based tests**: Universal properties verified across random inputs
- **Integration tests**: Full workflow testing with multiple cards

Run tests:
```bash
npm test -- src/creditcard/expiry-notifications.test.ts
```

## Implementation Notes

1. **Date Calculation**: Expiry dates are calculated to the last day of the expiry month at 23:59:59
2. **Sorting**: Notifications are automatically sorted by urgency (cards expiring soonest first)
3. **Performance**: Efficient O(n) scanning with O(n log n) sorting
4. **Immutability**: All functions are pure and return new objects
5. **Type Safety**: Full TypeScript type coverage with strict null checks

## Related Files

- `src/creditcard/expiry-notifications.ts` - Main implementation
- `src/creditcard/expiry-notifications.test.ts` - Test suite
- `src/creditcard/creditcard-utils.ts` - Utility functions (includes `isExpiringSoon`)
- `src/types/vault.ts` - Type definitions for `CreditCardItem`
