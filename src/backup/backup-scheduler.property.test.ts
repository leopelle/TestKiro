/**
 * Property-Based Tests for BackupScheduler
 * 
 * These tests verify universal properties that should hold for backup scheduling
 * using property-based testing with fast-check.
 * 
 * Feature: password-manager-app
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import * as fc from 'fast-check';
import { BackupScheduler, BackupFrequency, BackupScheduleConfig } from './backup-scheduler';
import { BackupService, EncryptedBackup } from './backup-service';
import { Vault } from '../vault/vault-manager';

// Mock BackupService for testing
class MockBackupService {
  async createBackup(vault: Vault, _backupKey: CryptoKey): Promise<EncryptedBackup> {
    return {
      encryptedData: {
        ciphertext: new Uint8Array([1, 2, 3]),
        iv: new Uint8Array([4, 5, 6]),
        authTag: new Uint8Array([7, 8, 9]),
      },
      metadata: {
        version: 1,
        createdAt: Date.now(),
        appVersion: '1.0.0',
        vaultId: vault.id,
      },
    };
  }
}

// Helper to create a mock vault
function createMockVault(id: string = 'test-vault'): Vault {
  return {
    id,
    version: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    items: new Map(),
    metadata: {
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  };
}

// Helper to create a mock crypto key
function createMockKey(): CryptoKey {
  return {} as CryptoKey;
}

/**
 * Arbitrary for generating backup frequencies
 */
const backupFrequencyArbitrary = fc.constantFrom(
  BackupFrequency.DAILY,
  BackupFrequency.WEEKLY,
  BackupFrequency.MONTHLY
);

/**
 * Arbitrary for generating backup schedule configurations
 */
const backupScheduleConfigArbitrary = fc.record({
  frequency: backupFrequencyArbitrary,
  enabled: fc.boolean(),
  maxBackups: fc.integer({ min: 1, max: 20 }),
});

/**
 * Arbitrary for generating time intervals in milliseconds
 * Represents time elapsed since last backup
 */
const timeIntervalArbitrary = fc.integer({ min: 0, max: 35 * 24 * 60 * 60 * 1000 }); // 0 to 35 days

describe('BackupScheduler Property-Based Tests', () => {
  let backupService: BackupService;

  beforeEach(() => {
    backupService = new MockBackupService() as unknown as BackupService;
  });

  /**
   * Property 22: Scheduling Backup Automatici
   * 
   * **Validates: Requirements 8.3**
   * 
   * For any backup schedule configuration (daily, weekly, monthly), backups should
   * be created according to the specified schedule.
   * 
   * This property verifies that:
   * 1. Daily backups are created after 24 hours have elapsed
   * 2. Weekly backups are created after 7 days have elapsed
   * 3. Monthly backups are created after 30 days have elapsed
   * 4. Backups are NOT created before the scheduled time
   * 5. The first backup is always created (no previous backup exists)
   * 6. Disabled schedules never trigger backups
   * 7. The scheduling logic is consistent across all frequencies
   * 8. Time calculations are accurate and deterministic
   */
  describe('Property 22: Scheduling Backup Automatici', () => {
    test('backups should be created according to daily schedule', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 20 }), // maxBackups
          fc.integer({ min: 0, max: 50 * 60 * 60 * 1000 }), // time since last backup (0 to 50 hours)
          async (maxBackups, timeSinceLastBackup) => {
            const config: BackupScheduleConfig = {
              frequency: BackupFrequency.DAILY,
              enabled: true,
              maxBackups,
            };

            const scheduler = new BackupScheduler(backupService, config);

            try {
              const currentTime = Date.now();
              const lastBackupTime = currentTime - timeSinceLastBackup;

              // Set last backup time
              scheduler.setLastBackupTime(lastBackupTime);

              // Check if backup should be created
              const shouldCreate = scheduler.shouldCreateBackup(currentTime);

              // Property: Backup should be created if and only if 24 hours have elapsed
              const expectedInterval = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
              const expectedShouldCreate = timeSinceLastBackup >= expectedInterval;

              expect(shouldCreate).toBe(expectedShouldCreate);
            } finally {
              scheduler.stop();
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    test('backups should be created according to weekly schedule', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 20 }), // maxBackups
          fc.integer({ min: 0, max: 15 * 24 * 60 * 60 * 1000 }), // time since last backup (0 to 15 days)
          async (maxBackups, timeSinceLastBackup) => {
            const config: BackupScheduleConfig = {
              frequency: BackupFrequency.WEEKLY,
              enabled: true,
              maxBackups,
            };

            const scheduler = new BackupScheduler(backupService, config);

            try {
              const currentTime = Date.now();
              const lastBackupTime = currentTime - timeSinceLastBackup;

              scheduler.setLastBackupTime(lastBackupTime);

              const shouldCreate = scheduler.shouldCreateBackup(currentTime);

              // Property: Backup should be created if and only if 7 days have elapsed
              const expectedInterval = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
              const expectedShouldCreate = timeSinceLastBackup >= expectedInterval;

              expect(shouldCreate).toBe(expectedShouldCreate);
            } finally {
              scheduler.stop();
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    test('backups should be created according to monthly schedule', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 20 }), // maxBackups
          fc.integer({ min: 0, max: 35 * 24 * 60 * 60 * 1000 }), // time since last backup (0 to 35 days)
          async (maxBackups, timeSinceLastBackup) => {
            const config: BackupScheduleConfig = {
              frequency: BackupFrequency.MONTHLY,
              enabled: true,
              maxBackups,
            };

            const scheduler = new BackupScheduler(backupService, config);

            try {
              const currentTime = Date.now();
              const lastBackupTime = currentTime - timeSinceLastBackup;

              scheduler.setLastBackupTime(lastBackupTime);

              const shouldCreate = scheduler.shouldCreateBackup(currentTime);

              // Property: Backup should be created if and only if 30 days have elapsed
              const expectedInterval = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
              const expectedShouldCreate = timeSinceLastBackup >= expectedInterval;

              expect(shouldCreate).toBe(expectedShouldCreate);
            } finally {
              scheduler.stop();
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    test('first backup should always be created when no previous backup exists', async () => {
      await fc.assert(
        fc.asyncProperty(
          backupScheduleConfigArbitrary,
          fc.integer({ min: 0, max: Date.now() }), // current time
          async (config, currentTime) => {
            // Only test when enabled
            fc.pre(config.enabled);

            const scheduler = new BackupScheduler(backupService, config);

            try {
              // No last backup time set (null)
              expect(scheduler.getLastBackupTime()).toBeNull();

              // Property: Should always create backup when no previous backup exists
              const shouldCreate = scheduler.shouldCreateBackup(currentTime);
              expect(shouldCreate).toBe(true);
            } finally {
              scheduler.stop();
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    test('disabled schedules should never trigger backups', async () => {
      await fc.assert(
        fc.asyncProperty(
          backupFrequencyArbitrary,
          fc.integer({ min: 1, max: 20 }), // maxBackups
          timeIntervalArbitrary, // time since last backup
          async (frequency, maxBackups, timeSinceLastBackup) => {
            const config: BackupScheduleConfig = {
              frequency,
              enabled: false, // Disabled
              maxBackups,
            };

            const scheduler = new BackupScheduler(backupService, config);

            try {
              const currentTime = Date.now();
              const lastBackupTime = currentTime - timeSinceLastBackup;

              scheduler.setLastBackupTime(lastBackupTime);

              // Property: Disabled schedules should never trigger backups
              const shouldCreate = scheduler.shouldCreateBackup(currentTime);
              expect(shouldCreate).toBe(false);
            } finally {
              scheduler.stop();
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    test('scheduling logic should be consistent for all frequencies', async () => {
      await fc.assert(
        fc.asyncProperty(
          backupFrequencyArbitrary,
          fc.integer({ min: 1, max: 20 }), // maxBackups
          timeIntervalArbitrary,
          async (frequency, maxBackups, timeSinceLastBackup) => {
            const config: BackupScheduleConfig = {
              frequency,
              enabled: true,
              maxBackups,
            };

            const scheduler = new BackupScheduler(backupService, config);

            try {
              const currentTime = Date.now();
              const lastBackupTime = currentTime - timeSinceLastBackup;

              scheduler.setLastBackupTime(lastBackupTime);

              const shouldCreate = scheduler.shouldCreateBackup(currentTime);

              // Determine expected interval based on frequency
              let expectedInterval: number;
              switch (frequency) {
                case BackupFrequency.DAILY:
                  expectedInterval = 24 * 60 * 60 * 1000;
                  break;
                case BackupFrequency.WEEKLY:
                  expectedInterval = 7 * 24 * 60 * 60 * 1000;
                  break;
                case BackupFrequency.MONTHLY:
                  expectedInterval = 30 * 24 * 60 * 60 * 1000;
                  break;
                default:
                  expectedInterval = 24 * 60 * 60 * 1000; // Default to daily
              }

              // Property: Scheduling decision should be consistent with expected interval
              const expectedShouldCreate = timeSinceLastBackup >= expectedInterval;
              expect(shouldCreate).toBe(expectedShouldCreate);
            } finally {
              scheduler.stop();
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    test('backups should not be created before scheduled time', async () => {
      await fc.assert(
        fc.asyncProperty(
          backupFrequencyArbitrary,
          fc.integer({ min: 1, max: 20 }), // maxBackups
          async (frequency, maxBackups) => {
            const config: BackupScheduleConfig = {
              frequency,
              enabled: true,
              maxBackups,
            };

            const scheduler = new BackupScheduler(backupService, config);

            try {
              // Determine required interval
              let requiredInterval: number;
              switch (frequency) {
                case BackupFrequency.DAILY:
                  requiredInterval = 24 * 60 * 60 * 1000;
                  break;
                case BackupFrequency.WEEKLY:
                  requiredInterval = 7 * 24 * 60 * 60 * 1000;
                  break;
                case BackupFrequency.MONTHLY:
                  requiredInterval = 30 * 24 * 60 * 60 * 1000;
                  break;
                default:
                  requiredInterval = 24 * 60 * 60 * 1000;
              }

              const currentTime = Date.now();
              // Set last backup time to just before the required interval
              const timeSinceLastBackup = requiredInterval - 1000; // 1 second before
              const lastBackupTime = currentTime - timeSinceLastBackup;

              scheduler.setLastBackupTime(lastBackupTime);

              // Property: Should NOT create backup before scheduled time
              const shouldCreate = scheduler.shouldCreateBackup(currentTime);
              expect(shouldCreate).toBe(false);
            } finally {
              scheduler.stop();
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    test('backups should be created exactly at scheduled time', async () => {
      await fc.assert(
        fc.asyncProperty(
          backupFrequencyArbitrary,
          fc.integer({ min: 1, max: 20 }), // maxBackups
          async (frequency, maxBackups) => {
            const config: BackupScheduleConfig = {
              frequency,
              enabled: true,
              maxBackups,
            };

            const scheduler = new BackupScheduler(backupService, config);

            try {
              // Determine required interval
              let requiredInterval: number;
              switch (frequency) {
                case BackupFrequency.DAILY:
                  requiredInterval = 24 * 60 * 60 * 1000;
                  break;
                case BackupFrequency.WEEKLY:
                  requiredInterval = 7 * 24 * 60 * 60 * 1000;
                  break;
                case BackupFrequency.MONTHLY:
                  requiredInterval = 30 * 24 * 60 * 60 * 1000;
                  break;
                default:
                  requiredInterval = 24 * 60 * 60 * 1000;
              }

              const currentTime = Date.now();
              // Set last backup time to exactly the required interval
              const lastBackupTime = currentTime - requiredInterval;

              scheduler.setLastBackupTime(lastBackupTime);

              // Property: Should create backup exactly at scheduled time
              const shouldCreate = scheduler.shouldCreateBackup(currentTime);
              expect(shouldCreate).toBe(true);
            } finally {
              scheduler.stop();
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    test('time calculations should be accurate and deterministic', async () => {
      await fc.assert(
        fc.asyncProperty(
          backupFrequencyArbitrary,
          fc.integer({ min: 1, max: 20 }), // maxBackups
          fc.integer({ min: 1000000000000, max: Date.now() }), // last backup time
          fc.integer({ min: 1000000000000, max: Date.now() }), // current time
          async (frequency, maxBackups, lastBackupTime, currentTime) => {
            // Ensure current time is after last backup time
            fc.pre(currentTime >= lastBackupTime);

            const config: BackupScheduleConfig = {
              frequency,
              enabled: true,
              maxBackups,
            };

            const scheduler = new BackupScheduler(backupService, config);

            try {
              scheduler.setLastBackupTime(lastBackupTime);

              // Call shouldCreateBackup multiple times with same parameters
              const result1 = scheduler.shouldCreateBackup(currentTime);
              const result2 = scheduler.shouldCreateBackup(currentTime);
              const result3 = scheduler.shouldCreateBackup(currentTime);

              // Property: Results should be deterministic (same every time)
              expect(result1).toBe(result2);
              expect(result2).toBe(result3);

              // Property: Result should match expected calculation
              const timeSinceLastBackup = currentTime - lastBackupTime;
              let expectedInterval: number;
              switch (frequency) {
                case BackupFrequency.DAILY:
                  expectedInterval = 24 * 60 * 60 * 1000;
                  break;
                case BackupFrequency.WEEKLY:
                  expectedInterval = 7 * 24 * 60 * 60 * 1000;
                  break;
                case BackupFrequency.MONTHLY:
                  expectedInterval = 30 * 24 * 60 * 60 * 1000;
                  break;
                default:
                  expectedInterval = 24 * 60 * 60 * 1000;
              }

              const expectedResult = timeSinceLastBackup >= expectedInterval;
              expect(result1).toBe(expectedResult);
            } finally {
              scheduler.stop();
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    test('created backups should have correct frequency metadata', async () => {
      await fc.assert(
        fc.asyncProperty(
          backupFrequencyArbitrary,
          fc.integer({ min: 1, max: 20 }), // maxBackups
          async (frequency, maxBackups) => {
            const config: BackupScheduleConfig = {
              frequency,
              enabled: true,
              maxBackups,
            };

            const scheduler = new BackupScheduler(backupService, config);
            const vault = createMockVault();
            const key = createMockKey();

            try {
              // Create a scheduled backup
              const storedBackup = await scheduler.createScheduledBackup(vault, key);

              // Property: Backup should have correct frequency metadata
              expect(storedBackup.frequency).toBe(frequency);

              // Property: Backup should have valid metadata
              expect(storedBackup.id).toBeDefined();
              expect(storedBackup.backup).toBeDefined();
              expect(storedBackup.createdAt).toBeDefined();
              expect(storedBackup.createdAt).toBeGreaterThan(0);
              expect(storedBackup.createdAt).toBeLessThanOrEqual(Date.now());
            } finally {
              scheduler.stop();
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    test('scheduler should update last backup time after creating backup', async () => {
      await fc.assert(
        fc.asyncProperty(
          backupScheduleConfigArbitrary,
          async (config) => {
            const scheduler = new BackupScheduler(backupService, config);
            const vault = createMockVault();
            const key = createMockKey();

            try {
              // Initially no last backup time
              expect(scheduler.getLastBackupTime()).toBeNull();

              // Create a backup
              const storedBackup = await scheduler.createScheduledBackup(vault, key);

              // Property: Last backup time should be updated
              const lastBackupTime = scheduler.getLastBackupTime();
              expect(lastBackupTime).not.toBeNull();
              expect(lastBackupTime).toBe(storedBackup.createdAt);

              // Property: Last backup time should be recent
              expect(lastBackupTime).toBeGreaterThan(Date.now() - 1000);
              expect(lastBackupTime).toBeLessThanOrEqual(Date.now());
            } finally {
              scheduler.stop();
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    test('multiple backups should be created at correct intervals', async () => {
      await fc.assert(
        fc.asyncProperty(
          backupFrequencyArbitrary,
          fc.integer({ min: 1, max: 10 }), // maxBackups
          fc.integer({ min: 2, max: 5 }), // number of backups to create
          async (frequency, maxBackups, numBackups) => {
            const config: BackupScheduleConfig = {
              frequency,
              enabled: true,
              maxBackups,
            };

            const scheduler = new BackupScheduler(backupService, config);
            const vault = createMockVault();
            const key = createMockKey();

            try {
              // Determine interval
              let interval: number;
              switch (frequency) {
                case BackupFrequency.DAILY:
                  interval = 24 * 60 * 60 * 1000;
                  break;
                case BackupFrequency.WEEKLY:
                  interval = 7 * 24 * 60 * 60 * 1000;
                  break;
                case BackupFrequency.MONTHLY:
                  interval = 30 * 24 * 60 * 60 * 1000;
                  break;
                default:
                  interval = 24 * 60 * 60 * 1000;
              }

              let currentTime = Date.now();
              const backupTimes: number[] = [];

              // Create multiple backups at scheduled intervals
              for (let i = 0; i < numBackups; i++) {
                // Set last backup time
                if (i > 0) {
                  scheduler.setLastBackupTime(backupTimes[i - 1]!);
                  currentTime = backupTimes[i - 1]! + interval;
                }

                // Property: Should create backup at scheduled time
                expect(scheduler.shouldCreateBackup(currentTime)).toBe(true);

                // Create backup
                const backup = await scheduler.createScheduledBackup(vault, key);
                backupTimes.push(backup.createdAt);
              }

              // Property: All backups should be created
              expect(backupTimes.length).toBe(numBackups);

              // Property: Should not exceed maxBackups
              const storedCount = scheduler.getBackupCount();
              expect(storedCount).toBeLessThanOrEqual(maxBackups);
            } finally {
              scheduler.stop();
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    test('configuration changes should affect scheduling decisions', async () => {
      await fc.assert(
        fc.asyncProperty(
          backupFrequencyArbitrary,
          backupFrequencyArbitrary,
          fc.integer({ min: 1, max: 20 }), // maxBackups
          async (initialFrequency, newFrequency, maxBackups) => {
            // Skip if frequencies are the same
            fc.pre(initialFrequency !== newFrequency);

            const initialConfig: BackupScheduleConfig = {
              frequency: initialFrequency,
              enabled: true,
              maxBackups,
            };

            const scheduler = new BackupScheduler(backupService, initialConfig);

            try {
              const currentTime = Date.now();
              
              // Set last backup time to 25 hours ago
              const lastBackupTime = currentTime - (25 * 60 * 60 * 1000);
              scheduler.setLastBackupTime(lastBackupTime);

              // Check with initial frequency
              const shouldCreateInitial = scheduler.shouldCreateBackup(currentTime);

              // Update configuration
              scheduler.updateConfig({ frequency: newFrequency });

              // Check with new frequency
              const shouldCreateAfterUpdate = scheduler.shouldCreateBackup(currentTime);

              // Property: Scheduling decision may change based on frequency
              // For 25 hours elapsed:
              // - DAILY: should create (>= 24 hours)
              // - WEEKLY: should not create (< 7 days)
              // - MONTHLY: should not create (< 30 days)
              
              if (initialFrequency === BackupFrequency.DAILY) {
                expect(shouldCreateInitial).toBe(true);
              } else {
                expect(shouldCreateInitial).toBe(false);
              }

              if (newFrequency === BackupFrequency.DAILY) {
                expect(shouldCreateAfterUpdate).toBe(true);
              } else {
                expect(shouldCreateAfterUpdate).toBe(false);
              }
            } finally {
              scheduler.stop();
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    test('enabling and disabling schedule should affect backup creation', async () => {
      await fc.assert(
        fc.asyncProperty(
          backupFrequencyArbitrary,
          fc.integer({ min: 1, max: 20 }), // maxBackups
          timeIntervalArbitrary,
          async (frequency, maxBackups, timeSinceLastBackup) => {
            const config: BackupScheduleConfig = {
              frequency,
              enabled: true,
              maxBackups,
            };

            const scheduler = new BackupScheduler(backupService, config);

            try {
              const currentTime = Date.now();
              const lastBackupTime = currentTime - timeSinceLastBackup;
              scheduler.setLastBackupTime(lastBackupTime);

              // Check when enabled
              const shouldCreateWhenEnabled = scheduler.shouldCreateBackup(currentTime);

              // Disable schedule
              scheduler.updateConfig({ enabled: false });

              // Property: Should not create backup when disabled
              const shouldCreateWhenDisabled = scheduler.shouldCreateBackup(currentTime);
              expect(shouldCreateWhenDisabled).toBe(false);

              // Re-enable schedule
              scheduler.updateConfig({ enabled: true });

              // Property: Should return to original decision when re-enabled
              const shouldCreateWhenReEnabled = scheduler.shouldCreateBackup(currentTime);
              expect(shouldCreateWhenReEnabled).toBe(shouldCreateWhenEnabled);
            } finally {
              scheduler.stop();
            }
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  /**
   * Property 23: Invariante Gestione Versioni Backup
   * 
   * **Validates: Requirements 8.5**
   * 
   * For any backup system, there should never exist more than 10 backups simultaneously.
   * 
   * This property verifies that:
   * 1. The backup system enforces a maximum limit of backups (default 10)
   * 2. When the limit is exceeded, oldest backups are automatically removed
   * 3. The invariant holds regardless of how many backups are created
   * 4. The invariant holds for different maxBackups configurations
   * 5. After enforcement, the count never exceeds the configured maximum
   * 6. The most recent backups are preserved when limit is enforced
   * 7. The oldest backups are removed first when limit is exceeded
   */
  describe('Property 23: Invariante Gestione Versioni Backup', () => {
    test('backup count should never exceed configured maximum', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 20 }), // maxBackups configuration
          fc.integer({ min: 1, max: 30 }), // number of backups to create
          async (maxBackups, numBackupsToCreate) => {
            const config: BackupScheduleConfig = {
              frequency: BackupFrequency.DAILY,
              enabled: true,
              maxBackups,
            };

            const scheduler = new BackupScheduler(backupService, config);
            const vault = createMockVault();
            const key = createMockKey();

            try {
              // Create multiple backups
              for (let i = 0; i < numBackupsToCreate; i++) {
                await scheduler.createScheduledBackup(vault, key);
              }

              // Property: Backup count should never exceed maxBackups
              const backupCount = scheduler.getBackupCount();
              expect(backupCount).toBeLessThanOrEqual(maxBackups);

              // Property: If we created more than maxBackups, count should equal maxBackups
              if (numBackupsToCreate > maxBackups) {
                expect(backupCount).toBe(maxBackups);
              } else {
                expect(backupCount).toBe(numBackupsToCreate);
              }
            } finally {
              scheduler.stop();
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    test('oldest backups should be removed when limit is exceeded', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 3, max: 10 }), // maxBackups (at least 3 for meaningful test)
          fc.integer({ min: 5, max: 20 }), // number of backups to create (more than max)
          async (maxBackups, numBackupsToCreate) => {
            // Ensure we create more backups than the limit
            fc.pre(numBackupsToCreate > maxBackups);

            const config: BackupScheduleConfig = {
              frequency: BackupFrequency.DAILY,
              enabled: true,
              maxBackups,
            };

            const scheduler = new BackupScheduler(backupService, config);
            const vault = createMockVault();
            const key = createMockKey();

            try {
              const createdBackupIds: string[] = [];

              // Create backups and track their IDs
              for (let i = 0; i < numBackupsToCreate; i++) {
                const backup = await scheduler.createScheduledBackup(vault, key);
                createdBackupIds.push(backup.id);
                
                // Small delay to ensure different timestamps
                await new Promise(resolve => setTimeout(resolve, 1));
              }

              // Get stored backups
              const storedBackups = scheduler.getStoredBackups();

              // Property: Only maxBackups should remain
              expect(storedBackups.length).toBe(maxBackups);

              // Property: The most recent maxBackups should be preserved
              const expectedRemainingIds = createdBackupIds.slice(-maxBackups);
              const actualIds = storedBackups.map(b => b.id);

              // All remaining backups should be from the most recent ones
              for (const id of actualIds) {
                expect(expectedRemainingIds).toContain(id);
              }

              // Property: The oldest backups should be removed
              const removedIds = createdBackupIds.slice(0, numBackupsToCreate - maxBackups);
              for (const id of removedIds) {
                expect(actualIds).not.toContain(id);
              }
            } finally {
              scheduler.stop();
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    test('most recent backups should be preserved when limit is enforced', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 10 }), // maxBackups
          fc.integer({ min: 3, max: 15 }), // number of backups to create
          async (maxBackups, numBackupsToCreate) => {
            // Ensure we create more backups than the limit
            fc.pre(numBackupsToCreate > maxBackups);

            const config: BackupScheduleConfig = {
              frequency: BackupFrequency.DAILY,
              enabled: true,
              maxBackups,
            };

            const scheduler = new BackupScheduler(backupService, config);
            const vault = createMockVault();
            const key = createMockKey();

            try {
              const backupTimestamps: number[] = [];

              // Create backups and track timestamps
              for (let i = 0; i < numBackupsToCreate; i++) {
                const backup = await scheduler.createScheduledBackup(vault, key);
                backupTimestamps.push(backup.createdAt);
                
                // Small delay to ensure different timestamps
                await new Promise(resolve => setTimeout(resolve, 1));
              }

              // Get stored backups
              const storedBackups = scheduler.getStoredBackups();

              // Property: Stored backups should be the most recent ones
              const storedTimestamps = storedBackups.map(b => b.createdAt).sort((a, b) => a - b);
              const expectedTimestamps = backupTimestamps.slice(-maxBackups).sort((a, b) => a - b);

              expect(storedTimestamps).toEqual(expectedTimestamps);

              // Property: All stored backups should be newer than removed ones
              if (backupTimestamps.length > maxBackups) {
                const oldestRemovedTimestamp = Math.max(...backupTimestamps.slice(0, numBackupsToCreate - maxBackups));
                const newestStoredTimestamp = Math.min(...storedTimestamps);
                
                // The newest stored backup should be newer than or equal to the oldest removed backup
                expect(newestStoredTimestamp).toBeGreaterThanOrEqual(oldestRemovedTimestamp);
              }
            } finally {
              scheduler.stop();
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    test('invariant should hold for different maxBackups configurations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 20 }), // maxBackups
          fc.integer({ min: 1, max: 25 }), // number of backups to create
          async (maxBackups, numBackupsToCreate) => {
            const config: BackupScheduleConfig = {
              frequency: BackupFrequency.DAILY,
              enabled: true,
              maxBackups,
            };

            const scheduler = new BackupScheduler(backupService, config);
            const vault = createMockVault();
            const key = createMockKey();

            try {
              // Create backups
              for (let i = 0; i < numBackupsToCreate; i++) {
                await scheduler.createScheduledBackup(vault, key);
                
                // Property: At every step, count should not exceed maxBackups
                const currentCount = scheduler.getBackupCount();
                expect(currentCount).toBeLessThanOrEqual(maxBackups);
              }

              // Property: Final count should not exceed maxBackups
              const finalCount = scheduler.getBackupCount();
              expect(finalCount).toBeLessThanOrEqual(maxBackups);
              expect(finalCount).toBe(Math.min(numBackupsToCreate, maxBackups));
            } finally {
              scheduler.stop();
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    test('loading backups should enforce limit immediately', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 5, max: 15 }), // maxBackups
          fc.integer({ min: 10, max: 30 }), // number of backups to load
          async (maxBackups, numBackupsToLoad) => {
            // Ensure we load more backups than the limit
            fc.pre(numBackupsToLoad > maxBackups);

            const config: BackupScheduleConfig = {
              frequency: BackupFrequency.DAILY,
              enabled: true,
              maxBackups,
            };

            const scheduler = new BackupScheduler(backupService, config);
            const vault = createMockVault();
            const key = createMockKey();

            try {
              // Create backups to load
              const backupsToLoad = [];
              for (let i = 0; i < numBackupsToLoad; i++) {
                const backup = await backupService.createBackup(vault, key);
                backupsToLoad.push({
                  id: `backup-${i}`,
                  backup,
                  createdAt: Date.now() + i, // Ensure different timestamps
                  frequency: BackupFrequency.DAILY,
                });
              }

              // Load backups
              scheduler.loadStoredBackups(backupsToLoad);

              // Property: Count should be enforced immediately after loading
              const backupCount = scheduler.getBackupCount();
              expect(backupCount).toBeLessThanOrEqual(maxBackups);
              expect(backupCount).toBe(maxBackups);

              // Property: Most recent backups should be kept
              const storedBackups = scheduler.getStoredBackups();
              const expectedIds = backupsToLoad.slice(-maxBackups).map(b => b.id);
              const actualIds = storedBackups.map(b => b.id);

              for (const id of actualIds) {
                expect(expectedIds).toContain(id);
              }
            } finally {
              scheduler.stop();
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    test('updating maxBackups configuration should enforce new limit', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 10, max: 20 }), // initial maxBackups (higher)
          fc.integer({ min: 3, max: 9 }), // new maxBackups (lower)
          fc.integer({ min: 15, max: 25 }), // number of backups to create
          async (initialMaxBackups, newMaxBackups, numBackupsToCreate) => {
            // Ensure new limit is lower and we create enough backups
            fc.pre(newMaxBackups < initialMaxBackups);
            fc.pre(numBackupsToCreate > initialMaxBackups);

            const config: BackupScheduleConfig = {
              frequency: BackupFrequency.DAILY,
              enabled: true,
              maxBackups: initialMaxBackups,
            };

            const scheduler = new BackupScheduler(backupService, config);
            const vault = createMockVault();
            const key = createMockKey();

            try {
              // Create backups with initial limit
              for (let i = 0; i < numBackupsToCreate; i++) {
                await scheduler.createScheduledBackup(vault, key);
              }

              // Property: Should have initialMaxBackups
              expect(scheduler.getBackupCount()).toBe(initialMaxBackups);

              // Update configuration to lower limit
              scheduler.updateConfig({ maxBackups: newMaxBackups });

              // Create one more backup to trigger enforcement
              await scheduler.createScheduledBackup(vault, key);

              // Property: Should now have newMaxBackups
              const finalCount = scheduler.getBackupCount();
              expect(finalCount).toBeLessThanOrEqual(newMaxBackups);
              expect(finalCount).toBe(newMaxBackups);
            } finally {
              scheduler.stop();
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    test('invariant should hold across multiple backup creation cycles', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 5, max: 10 }), // maxBackups
          fc.array(fc.integer({ min: 1, max: 10 }), { minLength: 2, maxLength: 5 }), // cycles of backups to create
          async (maxBackups, backupCycles) => {
            const config: BackupScheduleConfig = {
              frequency: BackupFrequency.DAILY,
              enabled: true,
              maxBackups,
            };

            const scheduler = new BackupScheduler(backupService, config);
            const vault = createMockVault();
            const key = createMockKey();

            try {
              // Create backups in multiple cycles
              for (const numBackups of backupCycles) {
                for (let i = 0; i < numBackups; i++) {
                  await scheduler.createScheduledBackup(vault, key);
                  
                  // Property: Invariant should hold after each backup
                  const currentCount = scheduler.getBackupCount();
                  expect(currentCount).toBeLessThanOrEqual(maxBackups);
                }

                // Property: Invariant should hold after each cycle
                const cycleCount = scheduler.getBackupCount();
                expect(cycleCount).toBeLessThanOrEqual(maxBackups);
              }

              // Property: Final invariant check
              const finalCount = scheduler.getBackupCount();
              expect(finalCount).toBeLessThanOrEqual(maxBackups);
            } finally {
              scheduler.stop();
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    test('deleting backups should maintain invariant', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 5, max: 15 }), // maxBackups
          fc.integer({ min: 10, max: 20 }), // number of backups to create
          fc.integer({ min: 1, max: 5 }), // number of backups to delete
          async (maxBackups, numBackupsToCreate, numToDelete) => {
            // Ensure we create more than we delete
            fc.pre(numBackupsToCreate > numToDelete);

            const config: BackupScheduleConfig = {
              frequency: BackupFrequency.DAILY,
              enabled: true,
              maxBackups,
            };

            const scheduler = new BackupScheduler(backupService, config);
            const vault = createMockVault();
            const key = createMockKey();

            try {
              // Create backups
              const backupIds: string[] = [];
              for (let i = 0; i < numBackupsToCreate; i++) {
                const backup = await scheduler.createScheduledBackup(vault, key);
                backupIds.push(backup.id);
              }

              // Property: Count should not exceed maxBackups
              const countBeforeDelete = scheduler.getBackupCount();
              expect(countBeforeDelete).toBeLessThanOrEqual(maxBackups);

              // Get the stored backups to know which ones actually exist
              const storedBackups = scheduler.getStoredBackups();
              const storedIds = storedBackups.map(b => b.id);

              // Delete some backups (only those that actually exist)
              const idsToDelete = backupIds.slice(0, Math.min(numToDelete, backupIds.length));
              let successfulDeletions = 0;
              for (const id of idsToDelete) {
                if (storedIds.includes(id)) {
                  const deleted = scheduler.deleteBackup(id);
                  if (deleted) {
                    successfulDeletions++;
                  }
                }
              }

              // Property: Count should still not exceed maxBackups
              const finalCount = scheduler.getBackupCount();
              expect(finalCount).toBeLessThanOrEqual(maxBackups);

              // Property: Count should be reduced by number of successful deletions
              const expectedCount = countBeforeDelete - successfulDeletions;
              expect(finalCount).toBe(expectedCount);
            } finally {
              scheduler.stop();
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    test('default configuration should enforce 10 backup limit', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 15, max: 30 }), // number of backups to create (more than 10)
          async (numBackupsToCreate) => {
            // Use default configuration (maxBackups: 10)
            const scheduler = new BackupScheduler(backupService);
            const vault = createMockVault();
            const key = createMockKey();

            try {
              // Create backups
              for (let i = 0; i < numBackupsToCreate; i++) {
                await scheduler.createScheduledBackup(vault, key);
              }

              // Property: Default limit of 10 should be enforced
              const backupCount = scheduler.getBackupCount();
              expect(backupCount).toBeLessThanOrEqual(10);
              expect(backupCount).toBe(10);

              // Property: Configuration should reflect default
              const config = scheduler.getConfig();
              expect(config.maxBackups).toBe(10);
            } finally {
              scheduler.stop();
            }
          }
        ),
        { numRuns: 10 }
      );
    });
  });
});
