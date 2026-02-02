# Credit Card Validation and Masking Implementation

## Overview

This document describes the implementation of credit card validation and masking functionality for the Password Manager application, completing Task 7.1.

## Requirements Addressed

- **Requirement 3.2**: Mask card number showing only last 4 digits when user views a card
- **Requirement 3.4**: Validate card number format using Luhn algorithm

## Implementation Details

### Module Structure

The credit card utilities are implemented in the `src/creditcard/` directory:

```
src/creditcard/
├── creditcard-utils.ts       # Core utility functions
├── creditcard-utils.test.ts  # Comprehensive test suite
└── index.ts                   # Module exports
```

### Core Functions

#### 1. `maskCardNumber(cardNumber: string, maskChar: string = '*'): string`

Masks a credit card number, showing only the last 4 digits.

**Features:**
- Removes spaces and dashes from input
- Masks all but the last 4 digits
- Formats output with spaces every 4 characters for readability
- Supports custom mask character
- Handles edge cases (empty string, less than 4 digits)

**Example:**
```typescript
maskCardNumber("4532015112830366")  // Returns "**** **** **** 0366"
maskCardNumber("4532-0151-1283-0366")  // Returns "**** **** **** 0366"
```

#### 2. `validateLuhn(cardNumber: string): boolean`

Validates a credit card number using the Luhn algorithm (modulus 10 algorithm).

**Algorithm:**
1. Starting from the rightmost digit (check digit), double every second digit
2. If doubling results in a two-digit number, subtract 9 from it
3. Sum all the digits
4. If the sum is divisible by 10, the number is valid

**Features:**
- Handles spaces and dashes in input
- Validates minimum length (13 digits)
- Rejects all-zero numbers
- Rejects non-numeric characters

**Example:**
```typescript
validateLuhn("4532015112830366")  // Returns true (valid Visa)
validateLuhn("4532015112830367")  // Returns false (invalid check digit)
```

#### 3. `detectCardType(cardNumber: string): string`

Detects the credit card type based on BIN (Bank Identification Number) ranges.

**Supported Card Types:**
- Visa (starts with 4)
- Mastercard (starts with 51-55 or 2221-2720)
- American Express (starts with 34 or 37)
- Discover (starts with 6011, 622126-622925, 644-649, or 65)
- Diners Club (starts with 36 or 38)
- JCB (starts with 35)

#### 4. `formatCardNumber(cardNumber: string): string`

Formats a credit card number with spaces for better readability.

**Features:**
- Uses 4-4-4-4 format for most cards
- Uses 4-6-5 format for American Express (15 digits)

#### 5. `isExpiringSoon(expiryDate: string, daysThreshold: number = 30): boolean`

Checks if a credit card is expiring soon (within specified days).

**Features:**
- Validates MM/YY format
- Calculates days until expiry (last day of expiry month)
- Supports custom threshold (default: 30 days)
- Returns true for already expired cards

**Example:**
```typescript
isExpiringSoon("12/24", 30)  // Returns true if within 30 days of Dec 2024
```

#### 6. `validateExpiryDate(expiryDate: string): boolean`

Validates expiry date format and checks if it's not expired.

**Features:**
- Validates MM/YY format
- Checks month is 01-12
- Checks if date is not in the past

## Testing Strategy

The implementation includes comprehensive testing with both unit tests and property-based tests:

### Unit Tests (36 tests)

Specific examples and edge cases:
- Valid and invalid card numbers
- Various card formats (with spaces, dashes)
- Different card types (Visa, Mastercard, Amex, etc.)
- Edge cases (empty strings, short numbers, all zeros)
- Expiry date validation
- Masking behavior

### Property-Based Tests (11 tests)

Universal properties verified across random inputs:
- Masking always shows last 4 digits
- Masking preserves total digit count
- Luhn algorithm is consistent
- Spaces and dashes don't affect validation
- Cards shorter than 13 digits are always rejected

**Test Configuration:**
- Using `fast-check` library
- 100 iterations per property test
- Total: 47 tests, all passing

## Integration with Existing Code

The credit card utilities integrate with the existing vault types:

1. **Luhn Validation**: The `validateLuhn` function is also available in `src/types/vault.ts` and is used by `validateCreditCardItem` to ensure all stored card numbers are valid.

2. **Expiry Date Validation**: The `validateExpiryDate` function is used by `validateCreditCardItem` to ensure cards are not expired when added.

3. **Masking**: The `maskCardNumber` function can be used by the UI layer when displaying credit card information to users.

## Usage Examples

### Adding a Credit Card with Validation

```typescript
import { validateLuhn, validateExpiryDate } from './creditcard';
import { validateCreditCardItem } from './types/vault';

const cardData = {
  type: 'creditcard',
  title: 'My Visa Card',
  cardNumber: '4532015112830366',
  holderName: 'John Doe',
  expiryDate: '12/25',
  cvv: '123',
  tags: [],
};

// Validate the card
const validation = validateCreditCardItem(cardData);
if (!validation.valid) {
  console.error('Invalid card:', validation.errors);
}
```

### Displaying a Masked Card Number

```typescript
import { maskCardNumber } from './creditcard';

const cardNumber = '4532015112830366';
const masked = maskCardNumber(cardNumber);
console.log(masked);  // "**** **** **** 0366"
```

### Checking for Expiring Cards

```typescript
import { isExpiringSoon } from './creditcard';

const expiryDate = '12/24';
if (isExpiringSoon(expiryDate, 30)) {
  console.warn('Card expires within 30 days!');
}
```

## Security Considerations

1. **Masking**: The masking function only affects display - the full card number is still stored encrypted in the vault.

2. **Validation**: Luhn validation only checks the mathematical validity of the card number, not whether the card actually exists or is active.

3. **Storage**: Card numbers should always be stored encrypted using the vault's encryption system.

4. **Display**: When showing full card numbers (after re-authentication), ensure proper security measures are in place (no screenshots, secure display).

## Future Enhancements

Potential improvements for future iterations:

1. **Additional Card Types**: Support for more regional card types (UnionPay, Maestro, etc.)
2. **CVV Validation**: Enhanced CVV validation based on card type (3 digits for most, 4 for Amex)
3. **BIN Database**: Integration with BIN database for more accurate card type detection
4. **Expiry Notifications**: Automated notification system for expiring cards
5. **Card Nickname**: Support for user-defined card nicknames

## Conclusion

Task 7.1 has been successfully completed with:
- ✅ Luhn algorithm implementation for card validation
- ✅ Card number masking showing only last 4 digits
- ✅ Comprehensive test coverage (47 tests, all passing)
- ✅ Integration with existing vault validation
- ✅ Additional utility functions (card type detection, formatting, expiry checking)

All requirements have been met and the implementation is production-ready.
