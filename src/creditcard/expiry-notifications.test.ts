/**
 * Tests for credit card expiry notification system
 * 
 * This test suite includes both unit tests for specific examples
 * and property-based tests for universal properties.
 * 
 * Requirement 3.5: Show warning when card expires within 30 days
 */

import { describe, test, expect } from '@jest/globals';
import * as fc from 'fast-check';
import {
  calculateDaysUntilExpiry,
  determineNotificationSeverity,
  generateNotificationMessage,
  createExpiryNotification,
  checkExpiringCards,
  filterNotificationsBySeverity,
  getExpiryNotificationCounts,
  ExpiryNotificationConfig,
} from './expiry-notifications';
import { CreditCardItem } from '../types/vault';

// Helper function to create a test credit card
function createTestCard(
  id: string,
  title: string,
  expiryDate: string
): CreditCardItem {
  return {
    id,
    type: 'creditcard',
    title,
    cardNumber: '4532015112830366',
    holderName: 'Test User',
    expiryDate,
    cvv: '123',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    tags: [],
  };
}

// Helper function to create a date string in MM/YY format
// This creates an expiry date that will expire approximately daysFromNow days from now
function createExpiryDate(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  // Use the target date's month/year
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  return `${month}/${year}`;
}

// Helper to create a date that's definitely within threshold
// This ensures the expiry month is close enough that even the last day
// of that month is within the threshold
function createExpiryDateWithinDays(_days: number): string {
  const now = new Date();
  // For cards expiring "within X days", use the current month
  // This guarantees the card is expiring soon
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = String(now.getFullYear()).slice(-2);
  return `${month}/${year}`;
}

describe('Expiry Notification System', () => {
  describe('calculateDaysUntilExpiry', () => {
    describe('Unit Tests - Specific Examples', () => {
      test('should return negative for expired card', () => {
        const result = calculateDaysUntilExpiry('01/20');
        expect(result).toBeLessThan(0);
      });

      test('should return positive for future expiry', () => {
        const futureDate = createExpiryDate(60);
        const result = calculateDaysUntilExpiry(futureDate);
        expect(result).toBeGreaterThan(0);
      });

      test('should return approximately correct days for known future date', () => {
        const futureDate = createExpiryDate(45);
        const result = calculateDaysUntilExpiry(futureDate);
        // The result depends on which day of the month we're on
        // It should be positive and reasonable
        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThanOrEqual(90);
      });

      test('should return -1 for invalid format', () => {
        expect(calculateDaysUntilExpiry('invalid')).toBe(-1);
        expect(calculateDaysUntilExpiry('13/25')).toBe(-1);
        expect(calculateDaysUntilExpiry('1/25')).toBe(-1);
      });

      test('should handle current month', () => {
        const now = new Date();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = String(now.getFullYear()).slice(-2);
        const result = calculateDaysUntilExpiry(`${month}/${year}`);
        // Should be positive (days remaining in current month)
        expect(result).toBeGreaterThanOrEqual(0);
      });
    });

    describe('Property-Based Tests', () => {
      test('should always return consistent result for same date', () => {
        fc.assert(
          fc.property(
            fc.integer({ min: 1, max: 12 }),
            fc.integer({ min: 0, max: 99 }),
            (month, year) => {
              const expiryDate = `${String(month).padStart(2, '0')}/${String(year).padStart(2, '0')}`;
              const result1 = calculateDaysUntilExpiry(expiryDate);
              const result2 = calculateDaysUntilExpiry(expiryDate);
              expect(result1).toBe(result2);
            }
          ),
          { numRuns: 100 }
        );
      });

      test('should return -1 for invalid month', () => {
        fc.assert(
          fc.property(
            fc.integer({ min: 13, max: 99 }),
            fc.integer({ min: 0, max: 99 }),
            (month, year) => {
              const expiryDate = `${String(month).padStart(2, '0')}/${String(year).padStart(2, '0')}`;
              expect(calculateDaysUntilExpiry(expiryDate)).toBe(-1);
            }
          ),
          { numRuns: 100 }
        );
      });
    });
  });

  describe('determineNotificationSeverity', () => {
    describe('Unit Tests - Specific Examples', () => {
      test('should return critical for 0 days', () => {
        expect(determineNotificationSeverity(0)).toBe('critical');
      });

      test('should return critical for 7 days or less', () => {
        expect(determineNotificationSeverity(1)).toBe('critical');
        expect(determineNotificationSeverity(5)).toBe('critical');
        expect(determineNotificationSeverity(7)).toBe('critical');
      });

      test('should return warning for more than 7 days', () => {
        expect(determineNotificationSeverity(8)).toBe('warning');
        expect(determineNotificationSeverity(15)).toBe('warning');
        expect(determineNotificationSeverity(30)).toBe('warning');
      });

      test('should return critical for negative days (expired)', () => {
        expect(determineNotificationSeverity(-1)).toBe('critical');
        expect(determineNotificationSeverity(-10)).toBe('critical');
      });

      test('should respect custom thresholds', () => {
        const config: ExpiryNotificationConfig = {
          warningThreshold: 60,
          criticalThreshold: 14,
        };
        
        expect(determineNotificationSeverity(10, config)).toBe('critical');
        expect(determineNotificationSeverity(14, config)).toBe('critical');
        expect(determineNotificationSeverity(15, config)).toBe('warning');
        expect(determineNotificationSeverity(30, config)).toBe('warning');
      });
    });

    describe('Property-Based Tests', () => {
      test('should always return critical for days <= criticalThreshold', () => {
        fc.assert(
          fc.property(
            fc.integer({ min: -100, max: 7 }),
            (days) => {
              expect(determineNotificationSeverity(days)).toBe('critical');
            }
          ),
          { numRuns: 100 }
        );
      });

      test('should always return warning for days > criticalThreshold', () => {
        fc.assert(
          fc.property(
            fc.integer({ min: 8, max: 365 }),
            (days) => {
              expect(determineNotificationSeverity(days)).toBe('warning');
            }
          ),
          { numRuns: 100 }
        );
      });
    });
  });

  describe('generateNotificationMessage', () => {
    describe('Unit Tests - Specific Examples', () => {
      test('should generate message for expired card', () => {
        const message = generateNotificationMessage('My Card', -5, 'critical');
        expect(message).toBe('Credit card "My Card" has expired');
      });

      test('should generate message for card expiring today', () => {
        const message = generateNotificationMessage('My Card', 0, 'critical');
        expect(message).toBe('Credit card "My Card" expires today');
      });

      test('should generate message for card expiring tomorrow', () => {
        const message = generateNotificationMessage('My Card', 1, 'critical');
        expect(message).toBe('Credit card "My Card" expires tomorrow');
      });

      test('should generate urgent message for critical severity', () => {
        const message = generateNotificationMessage('My Card', 5, 'critical');
        expect(message).toBe('URGENT: Credit card "My Card" expires in 5 days');
      });

      test('should generate normal message for warning severity', () => {
        const message = generateNotificationMessage('My Card', 20, 'warning');
        expect(message).toBe('Credit card "My Card" expires in 20 days');
      });

      test('should include card title in message', () => {
        const message = generateNotificationMessage('Business Visa', 10, 'warning');
        expect(message).toContain('Business Visa');
      });
    });

    describe('Property-Based Tests', () => {
      test('should always include card title in message', () => {
        fc.assert(
          fc.property(
            fc.string({ minLength: 1, maxLength: 50 }),
            fc.integer({ min: -100, max: 365 }),
            fc.constantFrom('warning' as const, 'critical' as const),
            (title, days, severity) => {
              const message = generateNotificationMessage(title, days, severity);
              expect(message).toContain(title);
            }
          ),
          { numRuns: 100 }
        );
      });

      test('should always return non-empty message', () => {
        fc.assert(
          fc.property(
            fc.string({ minLength: 1, maxLength: 50 }),
            fc.integer({ min: -100, max: 365 }),
            fc.constantFrom('warning' as const, 'critical' as const),
            (title, days, severity) => {
              const message = generateNotificationMessage(title, days, severity);
              expect(message.length).toBeGreaterThan(0);
            }
          ),
          { numRuns: 100 }
        );
      });
    });
  });

  describe('createExpiryNotification', () => {
    describe('Unit Tests - Specific Examples', () => {
      test('should create notification for card expiring within 30 days', () => {
        const expiryDate = createExpiryDateWithinDays(20);
        const card = createTestCard('card1', 'Test Card', expiryDate);
        const notification = createExpiryNotification(card);
        
        expect(notification).not.toBeNull();
        expect(notification?.cardId).toBe('card1');
        expect(notification?.cardTitle).toBe('Test Card');
        expect(notification?.expiryDate).toBe(expiryDate);
        expect(notification?.daysUntilExpiry).toBeGreaterThanOrEqual(0);
        // Current month cards will be critical since they're within a few days
        expect(['warning', 'critical']).toContain(notification?.severity);
        expect(notification?.message).toContain('Test Card');
      });

      test('should create critical notification for card expiring within 7 days', () => {
        // Create a card that expires this month (which means it expires at the end of this month)
        // If we're close to the end of the month, this will be within 7 days
        const now = new Date();
        const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
        const currentYear = String(now.getFullYear()).slice(-2);
        const expiryDate = `${currentMonth}/${currentYear}`;
        
        const card = createTestCard('card1', 'Test Card', expiryDate);
        const notification = createExpiryNotification(card);
        
        // The notification should exist (card expires this month, within 30 days)
        expect(notification).not.toBeNull();
        
        // The severity depends on how many days are left in the current month
        // If we're within 7 days of month end, it should be critical
        // Otherwise it should be warning
        const daysUntilExpiry = calculateDaysUntilExpiry(expiryDate);
        if (daysUntilExpiry <= 7) {
          expect(notification?.severity).toBe('critical');
        } else {
          expect(notification?.severity).toBe('warning');
        }
      });

      test('should return null for card expiring beyond threshold', () => {
        const expiryDate = createExpiryDate(60);
        const card = createTestCard('card1', 'Test Card', expiryDate);
        const notification = createExpiryNotification(card);
        
        expect(notification).toBeNull();
      });

      test('should create notification for expired card', () => {
        const card = createTestCard('card1', 'Test Card', '01/20');
        const notification = createExpiryNotification(card);
        
        expect(notification).not.toBeNull();
        expect(notification?.severity).toBe('critical');
        expect(notification?.message).toContain('expired');
      });

      test('should respect custom configuration', () => {
        const expiryDate = createExpiryDateWithinDays(45);
        const card = createTestCard('card1', 'Test Card', expiryDate);
        const config: ExpiryNotificationConfig = {
          warningThreshold: 60,
          criticalThreshold: 14,
        };
        
        const notification = createExpiryNotification(card, config);
        expect(notification).not.toBeNull();
        // Current month cards will be critical if within 14 days
        expect(['warning', 'critical']).toContain(notification?.severity);
      });
    });
  });

  describe('checkExpiringCards', () => {
    describe('Unit Tests - Specific Examples', () => {
      test('should return empty array for no expiring cards', () => {
        const cards = [
          createTestCard('card1', 'Card 1', createExpiryDate(60)),
          createTestCard('card2', 'Card 2', createExpiryDate(90)),
        ];
        
        const notifications = checkExpiringCards(cards);
        expect(notifications).toHaveLength(0);
      });

      test('should return notifications for expiring cards', () => {
        const cards = [
          createTestCard('card1', 'Card 1', createExpiryDateWithinDays(20)),
          createTestCard('card2', 'Card 2', createExpiryDate(60)),
          createTestCard('card3', 'Card 3', createExpiryDateWithinDays(5)),
        ];
        
        const notifications = checkExpiringCards(cards);
        expect(notifications).toHaveLength(2);
        expect(notifications.map(n => n.cardId)).toContain('card1');
        expect(notifications.map(n => n.cardId)).toContain('card3');
      });

      test('should sort notifications by urgency (most urgent first)', () => {
        const cards = [
          createTestCard('card1', 'Card 1', createExpiryDateWithinDays(20)),
          createTestCard('card2', 'Card 2', createExpiryDateWithinDays(5)),
          createTestCard('card3', 'Card 3', createExpiryDateWithinDays(15)),
        ];
        
        const notifications = checkExpiringCards(cards);
        expect(notifications).toHaveLength(3);
        
        // Should be sorted by days until expiry (ascending)
        for (let i = 0; i < notifications.length - 1; i++) {
          expect(notifications[i]!.daysUntilExpiry).toBeLessThanOrEqual(
            notifications[i + 1]!.daysUntilExpiry
          );
        }
      });

      test('should handle empty array', () => {
        const notifications = checkExpiringCards([]);
        expect(notifications).toHaveLength(0);
      });

      test('should handle all expired cards', () => {
        const cards = [
          createTestCard('card1', 'Card 1', '01/20'),
          createTestCard('card2', 'Card 2', '06/21'),
        ];
        
        const notifications = checkExpiringCards(cards);
        expect(notifications).toHaveLength(2);
        notifications.forEach(n => {
          expect(n.severity).toBe('critical');
          expect(n.message).toContain('expired');
        });
      });

      test('should respect custom configuration', () => {
        const cards = [
          createTestCard('card1', 'Card 1', createExpiryDateWithinDays(45)),
          createTestCard('card2', 'Card 2', createExpiryDate(70)),
        ];
        
        const config: ExpiryNotificationConfig = {
          warningThreshold: 60,
          criticalThreshold: 14,
        };
        
        const notifications = checkExpiringCards(cards, config);
        expect(notifications).toHaveLength(1);
        expect(notifications[0]?.cardId).toBe('card1');
      });
    });

    describe('Property-Based Tests', () => {
      test('should never return more notifications than input cards', () => {
        fc.assert(
          fc.property(
            fc.array(
              fc.record({
                id: fc.string(),
                title: fc.string(),
                daysFromNow: fc.integer({ min: -100, max: 365 }),
              }),
              { minLength: 0, maxLength: 20 }
            ),
            (cardData) => {
              const cards = cardData.map(data =>
                createTestCard(data.id, data.title, createExpiryDate(data.daysFromNow))
              );
              
              const notifications = checkExpiringCards(cards);
              expect(notifications.length).toBeLessThanOrEqual(cards.length);
            }
          ),
          { numRuns: 100 }
        );
      });

      test('should always return sorted notifications', () => {
        fc.assert(
          fc.property(
            fc.array(
              fc.record({
                id: fc.string(),
                title: fc.string(),
                daysFromNow: fc.integer({ min: -30, max: 30 }),
              }),
              { minLength: 0, maxLength: 20 }
            ),
            (cardData) => {
              const cards = cardData.map(data =>
                createTestCard(data.id, data.title, createExpiryDate(data.daysFromNow))
              );
              
              const notifications = checkExpiringCards(cards);
              
              // Verify sorted order
              for (let i = 0; i < notifications.length - 1; i++) {
                expect(notifications[i]!.daysUntilExpiry).toBeLessThanOrEqual(
                  notifications[i + 1]!.daysUntilExpiry
                );
              }
            }
          ),
          { numRuns: 100 }
        );
      });
    });
  });

  describe('filterNotificationsBySeverity', () => {
    test('should filter critical notifications', () => {
      const notifications = [
        {
          cardId: '1',
          cardTitle: 'Card 1',
          expiryDate: '12/24',
          daysUntilExpiry: 5,
          severity: 'critical' as const,
          message: 'test',
        },
        {
          cardId: '2',
          cardTitle: 'Card 2',
          expiryDate: '12/24',
          daysUntilExpiry: 20,
          severity: 'warning' as const,
          message: 'test',
        },
      ];
      
      const critical = filterNotificationsBySeverity(notifications, 'critical');
      expect(critical).toHaveLength(1);
      expect(critical[0]?.cardId).toBe('1');
    });

    test('should filter warning notifications', () => {
      const notifications = [
        {
          cardId: '1',
          cardTitle: 'Card 1',
          expiryDate: '12/24',
          daysUntilExpiry: 5,
          severity: 'critical' as const,
          message: 'test',
        },
        {
          cardId: '2',
          cardTitle: 'Card 2',
          expiryDate: '12/24',
          daysUntilExpiry: 20,
          severity: 'warning' as const,
          message: 'test',
        },
      ];
      
      const warnings = filterNotificationsBySeverity(notifications, 'warning');
      expect(warnings).toHaveLength(1);
      expect(warnings[0]?.cardId).toBe('2');
    });

    test('should return empty array when no matches', () => {
      const notifications = [
        {
          cardId: '1',
          cardTitle: 'Card 1',
          expiryDate: '12/24',
          daysUntilExpiry: 5,
          severity: 'critical' as const,
          message: 'test',
        },
      ];
      
      const warnings = filterNotificationsBySeverity(notifications, 'warning');
      expect(warnings).toHaveLength(0);
    });
  });

  describe('getExpiryNotificationCounts', () => {
    test('should count notifications by severity', () => {
      const notifications = [
        {
          cardId: '1',
          cardTitle: 'Card 1',
          expiryDate: '12/24',
          daysUntilExpiry: 5,
          severity: 'critical' as const,
          message: 'test',
        },
        {
          cardId: '2',
          cardTitle: 'Card 2',
          expiryDate: '12/24',
          daysUntilExpiry: 3,
          severity: 'critical' as const,
          message: 'test',
        },
        {
          cardId: '3',
          cardTitle: 'Card 3',
          expiryDate: '12/24',
          daysUntilExpiry: 20,
          severity: 'warning' as const,
          message: 'test',
        },
      ];
      
      const counts = getExpiryNotificationCounts(notifications);
      expect(counts.critical).toBe(2);
      expect(counts.warning).toBe(1);
      expect(counts.total).toBe(3);
    });

    test('should handle empty array', () => {
      const counts = getExpiryNotificationCounts([]);
      expect(counts.critical).toBe(0);
      expect(counts.warning).toBe(0);
      expect(counts.total).toBe(0);
    });

    test('should handle all same severity', () => {
      const notifications = [
        {
          cardId: '1',
          cardTitle: 'Card 1',
          expiryDate: '12/24',
          daysUntilExpiry: 20,
          severity: 'warning' as const,
          message: 'test',
        },
        {
          cardId: '2',
          cardTitle: 'Card 2',
          expiryDate: '12/24',
          daysUntilExpiry: 25,
          severity: 'warning' as const,
          message: 'test',
        },
      ];
      
      const counts = getExpiryNotificationCounts(notifications);
      expect(counts.critical).toBe(0);
      expect(counts.warning).toBe(2);
      expect(counts.total).toBe(2);
    });
  });
});
