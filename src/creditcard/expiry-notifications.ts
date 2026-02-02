/**
 * Credit card expiry notification system
 * 
 * This module provides functionality to check for expiring credit cards
 * and generate notifications for cards that are expiring soon.
 * 
 * Requirement 3.5: Show warning when card expires within 30 days
 */

import { CreditCardItem } from '../types/vault';
import { isExpiringSoon } from './creditcard-utils';

/**
 * Notification severity levels
 */
export type NotificationSeverity = 'warning' | 'critical';

/**
 * Expiry notification for a credit card
 */
export interface ExpiryNotification {
  readonly cardId: string;
  readonly cardTitle: string;
  readonly expiryDate: string;
  readonly daysUntilExpiry: number;
  readonly severity: NotificationSeverity;
  readonly message: string;
}

/**
 * Configuration for expiry notifications
 */
export interface ExpiryNotificationConfig {
  readonly warningThreshold: number; // Days before expiry to show warning
  readonly criticalThreshold: number; // Days before expiry to show critical alert
}

/**
 * Default notification configuration
 * Warning at 30 days, critical at 7 days
 */
export const DEFAULT_NOTIFICATION_CONFIG: ExpiryNotificationConfig = {
  warningThreshold: 30,
  criticalThreshold: 7,
};

/**
 * Calculates the number of days until a card expires
 * 
 * @param expiryDate - The expiry date in MM/YY format
 * @returns Number of days until expiry (negative if already expired)
 */
export function calculateDaysUntilExpiry(expiryDate: string): number {
  // Validate format MM/YY
  const expiryRegex = /^(0[1-9]|1[0-2])\/\d{2}$/;
  if (!expiryRegex.test(expiryDate)) {
    return -1;
  }

  // Parse month and year
  const [monthStr, yearStr] = expiryDate.split('/');
  const month = parseInt(monthStr ?? '0', 10);
  const year = 2000 + parseInt(yearStr ?? '0', 10);

  // Create expiry date (last day of the expiry month at 23:59:59)
  const expiryDateObj = new Date(year, month, 0, 23, 59, 59, 999);
  
  // Calculate difference in milliseconds
  const now = new Date();
  const diffMs = expiryDateObj.getTime() - now.getTime();
  
  // Convert to days (rounded down)
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

/**
 * Determines the severity of an expiry notification based on days until expiry
 * 
 * @param daysUntilExpiry - Number of days until the card expires
 * @param config - Notification configuration
 * @returns Notification severity level
 */
export function determineNotificationSeverity(
  daysUntilExpiry: number,
  config: ExpiryNotificationConfig = DEFAULT_NOTIFICATION_CONFIG
): NotificationSeverity {
  if (daysUntilExpiry <= config.criticalThreshold) {
    return 'critical';
  }
  return 'warning';
}

/**
 * Generates a notification message for an expiring card
 * 
 * @param cardTitle - The title of the credit card
 * @param daysUntilExpiry - Number of days until expiry
 * @param severity - Notification severity
 * @returns Formatted notification message
 */
export function generateNotificationMessage(
  cardTitle: string,
  daysUntilExpiry: number,
  severity: NotificationSeverity
): string {
  if (daysUntilExpiry < 0) {
    return `Credit card "${cardTitle}" has expired`;
  }
  
  if (daysUntilExpiry === 0) {
    return `Credit card "${cardTitle}" expires today`;
  }
  
  if (daysUntilExpiry === 1) {
    return `Credit card "${cardTitle}" expires tomorrow`;
  }
  
  if (severity === 'critical') {
    return `URGENT: Credit card "${cardTitle}" expires in ${daysUntilExpiry} days`;
  }
  
  return `Credit card "${cardTitle}" expires in ${daysUntilExpiry} days`;
}

/**
 * Creates an expiry notification for a credit card
 * 
 * @param card - The credit card item
 * @param config - Notification configuration
 * @returns Expiry notification or null if card is not expiring soon
 */
export function createExpiryNotification(
  card: CreditCardItem,
  config: ExpiryNotificationConfig = DEFAULT_NOTIFICATION_CONFIG
): ExpiryNotification | null {
  // Check if card is expiring within the warning threshold
  if (!isExpiringSoon(card.expiryDate, config.warningThreshold)) {
    return null;
  }
  
  const daysUntilExpiry = calculateDaysUntilExpiry(card.expiryDate);
  const severity = determineNotificationSeverity(daysUntilExpiry, config);
  const message = generateNotificationMessage(card.title, daysUntilExpiry, severity);
  
  return {
    cardId: card.id,
    cardTitle: card.title,
    expiryDate: card.expiryDate,
    daysUntilExpiry,
    severity,
    message,
  };
}

/**
 * Checks a list of credit cards and returns notifications for expiring cards
 * 
 * Requirement 3.5: Show warning when card expires within 30 days
 * 
 * @param cards - Array of credit card items to check
 * @param config - Notification configuration
 * @returns Array of expiry notifications, sorted by days until expiry (most urgent first)
 */
export function checkExpiringCards(
  cards: readonly CreditCardItem[],
  config: ExpiryNotificationConfig = DEFAULT_NOTIFICATION_CONFIG
): ExpiryNotification[] {
  const notifications: ExpiryNotification[] = [];
  
  for (const card of cards) {
    const notification = createExpiryNotification(card, config);
    if (notification) {
      notifications.push(notification);
    }
  }
  
  // Sort by days until expiry (most urgent first)
  notifications.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
  
  return notifications;
}

/**
 * Filters notifications by severity level
 * 
 * @param notifications - Array of notifications to filter
 * @param severity - Severity level to filter by
 * @returns Filtered array of notifications
 */
export function filterNotificationsBySeverity(
  notifications: readonly ExpiryNotification[],
  severity: NotificationSeverity
): ExpiryNotification[] {
  return notifications.filter(n => n.severity === severity);
}

/**
 * Gets the count of expiring cards by severity
 * 
 * @param notifications - Array of notifications
 * @returns Object with counts by severity
 */
export function getExpiryNotificationCounts(
  notifications: readonly ExpiryNotification[]
): { warning: number; critical: number; total: number } {
  const warning = notifications.filter(n => n.severity === 'warning').length;
  const critical = notifications.filter(n => n.severity === 'critical').length;
  
  return {
    warning,
    critical,
    total: notifications.length,
  };
}
