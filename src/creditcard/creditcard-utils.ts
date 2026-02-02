/**
 * Credit card utility functions for the Password Manager application
 * 
 * This module provides utilities for credit card validation and masking.
 * 
 * Requirements: 3.2, 3.4
 */

/**
 * Masks a credit card number, showing only the last 4 digits
 * 
 * Requirement 3.2: Mask card number showing only last 4 digits
 * 
 * @param cardNumber - The full card number to mask
 * @param maskChar - The character to use for masking (default: '*')
 * @returns Masked card number (e.g., "**** **** **** 1234")
 * 
 * @example
 * maskCardNumber("4532015112830366") // Returns "**** **** **** 0366"
 * maskCardNumber("4532-0151-1283-0366") // Returns "**** **** **** 0366"
 * maskCardNumber("4532 0151 1283 0366") // Returns "**** **** **** 0366"
 */
export function maskCardNumber(cardNumber: string, maskChar: string = '*'): string {
  // Remove any spaces or dashes
  const cleaned = cardNumber.replace(/[\s-]/g, '');
  
  // Validate input
  if (cleaned.length < 4) {
    // If less than 4 digits, mask everything
    return maskChar.repeat(cleaned.length);
  }
  
  // Get last 4 digits
  const lastFour = cleaned.slice(-4);
  
  // Calculate number of digits to mask
  const maskedLength = cleaned.length - 4;
  
  // Create masked portion
  const masked = maskChar.repeat(maskedLength);
  
  // Format with spaces every 4 characters for readability
  const combined = masked + lastFour;
  const formatted = combined.match(/.{1,4}/g)?.join(' ') || combined;
  
  return formatted;
}

/**
 * Validates a credit card number using the Luhn algorithm
 * 
 * Requirement 3.4: Validate card number using Luhn algorithm
 * 
 * The Luhn algorithm (also known as the "modulus 10" or "mod 10" algorithm)
 * is a checksum formula used to validate credit card numbers.
 * 
 * Algorithm:
 * 1. Starting from the rightmost digit (check digit), double every second digit
 * 2. If doubling results in a two-digit number, subtract 9 from it
 * 3. Sum all the digits
 * 4. If the sum is divisible by 10, the number is valid
 * 
 * @param cardNumber - The card number to validate (can include spaces or dashes)
 * @returns true if valid according to Luhn algorithm, false otherwise
 * 
 * @example
 * validateLuhn("4532015112830366") // Returns true (valid Visa)
 * validateLuhn("4532015112830367") // Returns false (invalid check digit)
 * validateLuhn("4532-0151-1283-0366") // Returns true (spaces/dashes ignored)
 */
export function validateLuhn(cardNumber: string): boolean {
  // Remove any spaces or dashes
  const cleaned = cardNumber.replace(/[\s-]/g, '');

  // Check if it contains only digits
  if (!/^\d+$/.test(cleaned)) {
    return false;
  }

  // Must be at least 13 digits (shortest valid card numbers)
  if (cleaned.length < 13) {
    return false;
  }

  // Reject all zeros (invalid card)
  if (/^0+$/.test(cleaned)) {
    return false;
  }

  // Luhn algorithm implementation
  let sum = 0;
  let isEven = false;

  // Loop through values starting from the rightmost digit
  for (let i = cleaned.length - 1; i >= 0; i--) {
    let digit = parseInt(cleaned[i] ?? '0', 10);

    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    isEven = !isEven;
  }

  return sum % 10 === 0;
}

/**
 * Detects the credit card type based on the card number
 * 
 * Uses industry-standard BIN (Bank Identification Number) ranges
 * to identify the card issuer.
 * 
 * @param cardNumber - The card number to analyze
 * @returns The detected card type or 'unknown'
 * 
 * @example
 * detectCardType("4532015112830366") // Returns "visa"
 * detectCardType("5425233430109903") // Returns "mastercard"
 * detectCardType("378282246310005") // Returns "amex"
 */
export function detectCardType(cardNumber: string): string {
  const cleaned = cardNumber.replace(/[\s-]/g, '');
  
  // Visa: starts with 4
  if (/^4/.test(cleaned)) {
    return 'visa';
  }
  
  // Mastercard: starts with 51-55 or 2221-2720
  if (/^5[1-5]/.test(cleaned) || /^2[2-7]/.test(cleaned)) {
    return 'mastercard';
  }
  
  // American Express: starts with 34 or 37
  if (/^3[47]/.test(cleaned)) {
    return 'amex';
  }
  
  // Discover: starts with 6011, 622126-622925, 644-649, or 65
  if (/^6011/.test(cleaned) || /^622[1-9]/.test(cleaned) || 
      /^64[4-9]/.test(cleaned) || /^65/.test(cleaned)) {
    return 'discover';
  }
  
  // Diners Club: starts with 36 or 38
  if (/^3[68]/.test(cleaned)) {
    return 'diners';
  }
  
  // JCB: starts with 35
  if (/^35/.test(cleaned)) {
    return 'jcb';
  }
  
  return 'unknown';
}

/**
 * Formats a credit card number with spaces for better readability
 * 
 * @param cardNumber - The card number to format
 * @returns Formatted card number with spaces
 * 
 * @example
 * formatCardNumber("4532015112830366") // Returns "4532 0151 1283 0366"
 */
export function formatCardNumber(cardNumber: string): string {
  const cleaned = cardNumber.replace(/[\s-]/g, '');
  
  // American Express uses 4-6-5 format
  const cardType = detectCardType(cleaned);
  if (cardType === 'amex' && cleaned.length === 15) {
    return cleaned.replace(/(\d{4})(\d{6})(\d{5})/, '$1 $2 $3');
  }
  
  // Most cards use 4-4-4-4 format
  return cleaned.match(/.{1,4}/g)?.join(' ') || cleaned;
}

/**
 * Checks if a credit card is expiring soon (within specified days)
 * 
 * Requirement 3.5: Show warning when card expires within 30 days
 * 
 * @param expiryDate - The expiry date in MM/YY format
 * @param daysThreshold - Number of days to check (default: 30)
 * @returns true if card expires within threshold, false otherwise
 * 
 * @example
 * isExpiringSoon("12/24", 30) // Returns true if current date is within 30 days of Dec 2024
 */
export function isExpiringSoon(expiryDate: string, daysThreshold: number = 30): boolean {
  // Validate format MM/YY
  const expiryRegex = /^(0[1-9]|1[0-2])\/\d{2}$/;
  if (!expiryRegex.test(expiryDate)) {
    return false;
  }

  // Parse month and year
  const [monthStr, yearStr] = expiryDate.split('/');
  const month = parseInt(monthStr ?? '0', 10);
  const year = 2000 + parseInt(yearStr ?? '0', 10);

  // Create expiry date (last day of the expiry month at 23:59:59)
  const expiryDateObj = new Date(year, month, 0, 23, 59, 59, 999);
  
  // Calculate threshold date (now + threshold days)
  const now = new Date();
  const thresholdDate = new Date(now.getTime() + daysThreshold * 24 * 60 * 60 * 1000);

  // Check if expiry date is before or equal to threshold date
  // This means the card expires within the threshold period
  return expiryDateObj <= thresholdDate;
}

/**
 * Validates expiry date format and checks if it's not expired
 * 
 * @param expiryDate - The expiry date in MM/YY format
 * @returns true if valid and not expired, false otherwise
 * 
 * @example
 * validateExpiryDate("12/25") // Returns true if current date is before Dec 2025
 * validateExpiryDate("01/20") // Returns false if current date is after Jan 2020
 */
export function validateExpiryDate(expiryDate: string): boolean {
  // Check format MM/YY
  const expiryRegex = /^(0[1-9]|1[0-2])\/\d{2}$/;
  if (!expiryRegex.test(expiryDate)) {
    return false;
  }

  // Parse month and year
  const [monthStr, yearStr] = expiryDate.split('/');
  const month = parseInt(monthStr ?? '0', 10);
  const year = 2000 + parseInt(yearStr ?? '0', 10);

  // Check if expired
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // getMonth() is 0-indexed

  if (year < currentYear) {
    return false;
  }

  if (year === currentYear && month < currentMonth) {
    return false;
  }

  return true;
}
