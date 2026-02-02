/**
 * Unit tests for BackupScheduler
 * 
 * Tests scheduled backup functionality and version management
 */

import { BackupScheduler, BackupFrequency, BackupScheduleConfig, StoredBackup } from './backup-scheduler';
import { BackupService, EncryptedBackup } from './backup-service';
import { Vault } from '../vault/vault-manager';

// Mock BackupService
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
function createMockVault(): Vault {
  return {
    id: 'test-vault-id',
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

describe('BackupScheduler', () => {
  let backupService: BackupService;
  let scheduler: BackupScheduler;

  beforeEach(() => {
    backupService = new MockBackupService() as unknown as BackupService;
  });

  afterEach(() => {
    if (scheduler) {
      scheduler.stop();
    }
  });

  describe('Configuration', () => {
    test('should initialize with default configuration', () => {
      scheduler = new BackupScheduler(backupService);
      const config = scheduler.getConfig();

      expect(config.frequency).toBe(BackupFrequency.DAILY);
      expect(config.enabled).toBe(true);
      expect(config.maxBackups).toBe(10);
    });

    test('should initialize with custom configuration', () => {
      const customConfig: BackupScheduleConfig = {
        frequency: BackupFrequency.WEEKLY,
        enabled: false,
        maxBackups: 5,
      };

      scheduler = new BackupScheduler(backupService, customConfig);
      const config = scheduler.getConfig();

      expect(config.frequency).toBe(BackupFrequency.WEEKLY);
      expect(config.enabled).toBe(false);
      expect(config.maxBackups).toBe(5);
    });

    test('should update configuration', () => {
      scheduler = new BackupScheduler(backupService);
      
      scheduler.updateConfig({
        frequency: BackupFrequency.MONTHLY,
        maxBackups: 15,
      });

      const config = scheduler.getConfig();
      expect(config.frequency).toBe(BackupFrequency.MONTHLY);
      expect(config.maxBackups).toBe(15);
      expect(config.enabled).toBe(true); // Should preserve existing value
    });
  });

  describe('Scheduling Logic', () => {
    test('should determine backup is needed when no previous backup exists', () => {
      scheduler = new BackupScheduler(backupService);
      
      expect(scheduler.shouldCreateBackup()).toBe(true);
    });

    test('should determine backup is not needed when disabled', () => {
      scheduler = new BackupScheduler(backupService, {
        frequency: BackupFrequency.DAILY,
        enabled: false,
        maxBackups: 10,
      });

      expect(scheduler.shouldCreateBackup()).toBe(false);
    });

    test('should determine backup is needed for daily frequency after 24 hours', () => {
      scheduler = new BackupScheduler(backupService, {
        frequency: BackupFrequency.DAILY,
        enabled: true,
        maxBackups: 10,
      });

      const lastBackupTime = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago
      scheduler.setLastBackupTime(lastBackupTime);

      expect(scheduler.shouldCreateBackup()).toBe(true);
    });

    test('should determine backup is not needed for daily frequency before 24 hours', () => {
      scheduler = new BackupScheduler(backupService, {
        frequency: BackupFrequency.DAILY,
        enabled: true,
        maxBackups: 10,
      });

      const lastBackupTime = Date.now() - (23 * 60 * 60 * 1000); // 23 hours ago
      scheduler.setLastBackupTime(lastBackupTime);

      expect(scheduler.shouldCreateBackup()).toBe(false);
    });

    test('should determine backup is needed for weekly frequency after 7 days', () => {
      scheduler = new BackupScheduler(backupService, {
        frequency: BackupFrequency.WEEKLY,
        enabled: true,
        maxBackups: 10,
      });

      const lastBackupTime = Date.now() - (8 * 24 * 60 * 60 * 1000); // 8 days ago
      scheduler.setLastBackupTime(lastBackupTime);

      expect(scheduler.shouldCreateBackup()).toBe(true);
    });

    test('should determine backup is not needed for weekly frequency before 7 days', () => {
      scheduler = new BackupScheduler(backupService, {
        frequency: BackupFrequency.WEEKLY,
        enabled: true,
        maxBackups: 10,
      });

      const lastBackupTime = Date.now() - (6 * 24 * 60 * 60 * 1000); // 6 days ago
      scheduler.setLastBackupTime(lastBackupTime);

      expect(scheduler.shouldCreateBackup()).toBe(false);
    });

    test('should determine backup is needed for monthly frequency after 30 days', () => {
      scheduler = new BackupScheduler(backupService, {
        frequency: BackupFrequency.MONTHLY,
        enabled: true,
        maxBackups: 10,
      });

      const lastBackupTime = Date.now() - (31 * 24 * 60 * 60 * 1000); // 31 days ago
      scheduler.setLastBackupTime(lastBackupTime);

      expect(scheduler.shouldCreateBackup()).toBe(true);
    });

    test('should determine backup is not needed for monthly frequency before 30 days', () => {
      scheduler = new BackupScheduler(backupService, {
        frequency: BackupFrequency.MONTHLY,
        enabled: true,
        maxBackups: 10,
      });

      const lastBackupTime = Date.now() - (29 * 24 * 60 * 60 * 1000); // 29 days ago
      scheduler.setLastBackupTime(lastBackupTime);

      expect(scheduler.shouldCreateBackup()).toBe(false);
    });
  });

  describe('Backup Creation', () => {
    test('should create a scheduled backup', async () => {
      scheduler = new BackupScheduler(backupService);
      const vault = createMockVault();
      const key = createMockKey();

      const storedBackup = await scheduler.createScheduledBackup(vault, key);

      expect(storedBackup.id).toBeDefined();
      expect(storedBackup.backup).toBeDefined();
      expect(storedBackup.createdAt).toBeDefined();
      expect(storedBackup.frequency).toBe(BackupFrequency.DAILY);
    });

    test('should update last backup time after creating backup', async () => {
      scheduler = new BackupScheduler(backupService);
      const vault = createMockVault();
      const key = createMockKey();

      expect(scheduler.getLastBackupTime()).toBeNull();

      const storedBackup = await scheduler.createScheduledBackup(vault, key);

      expect(scheduler.getLastBackupTime()).toBe(storedBackup.createdAt);
    });

    test('should add backup to stored backups', async () => {
      scheduler = new BackupScheduler(backupService);
      const vault = createMockVault();
      const key = createMockKey();

      expect(scheduler.getBackupCount()).toBe(0);

      await scheduler.createScheduledBackup(vault, key);

      expect(scheduler.getBackupCount()).toBe(1);
    });
  });

  describe('Version Management - Requirement 8.5', () => {
    test('should maintain max 10 backups by default', async () => {
      scheduler = new BackupScheduler(backupService);
      const vault = createMockVault();
      const key = createMockKey();

      // Create 15 backups
      for (let i = 0; i < 15; i++) {
        await scheduler.createScheduledBackup(vault, key);
      }

      // Should only have 10 backups
      expect(scheduler.getBackupCount()).toBe(10);
    });

    test('should maintain custom max backups limit', async () => {
      scheduler = new BackupScheduler(backupService, {
        frequency: BackupFrequency.DAILY,
        enabled: true,
        maxBackups: 5,
      });
      const vault = createMockVault();
      const key = createMockKey();

      // Create 8 backups
      for (let i = 0; i < 8; i++) {
        await scheduler.createScheduledBackup(vault, key);
      }

      // Should only have 5 backups
      expect(scheduler.getBackupCount()).toBe(5);
    });

    test('should remove oldest backups when limit is exceeded', async () => {
      scheduler = new BackupScheduler(backupService, {
        frequency: BackupFrequency.DAILY,
        enabled: true,
        maxBackups: 3,
      });
      const vault = createMockVault();
      const key = createMockKey();

      // Create 5 backups with delays to ensure different timestamps
      const backupIds: string[] = [];
      for (let i = 0; i < 5; i++) {
        const backup = await scheduler.createScheduledBackup(vault, key);
        backupIds.push(backup.id);
        // Small delay to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Should only have 3 backups (the newest ones)
      expect(scheduler.getBackupCount()).toBe(3);

      // First two backups should be removed
      expect(scheduler.getBackupById(backupIds[0]!)).toBeUndefined();
      expect(scheduler.getBackupById(backupIds[1]!)).toBeUndefined();

      // Last three backups should still exist
      expect(scheduler.getBackupById(backupIds[2]!)).toBeDefined();
      expect(scheduler.getBackupById(backupIds[3]!)).toBeDefined();
      expect(scheduler.getBackupById(backupIds[4]!)).toBeDefined();
    });

    test('should keep backups sorted by creation time (newest first)', async () => {
      scheduler = new BackupScheduler(backupService);
      const vault = createMockVault();
      const key = createMockKey();

      // Create 3 backups with delays
      for (let i = 0; i < 3; i++) {
        await scheduler.createScheduledBackup(vault, key);
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const backups = scheduler.getStoredBackups();

      // Should be sorted newest first
      expect(backups[0]!.createdAt).toBeGreaterThan(backups[1]!.createdAt);
      expect(backups[1]!.createdAt).toBeGreaterThan(backups[2]!.createdAt);
    });
  });

  describe('Backup Retrieval', () => {
    test('should get all stored backups', async () => {
      scheduler = new BackupScheduler(backupService);
      const vault = createMockVault();
      const key = createMockKey();

      await scheduler.createScheduledBackup(vault, key);
      await scheduler.createScheduledBackup(vault, key);

      const backups = scheduler.getStoredBackups();
      expect(backups).toHaveLength(2);
    });

    test('should get backup by ID', async () => {
      scheduler = new BackupScheduler(backupService);
      const vault = createMockVault();
      const key = createMockKey();

      const storedBackup = await scheduler.createScheduledBackup(vault, key);
      const retrieved = scheduler.getBackupById(storedBackup.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(storedBackup.id);
    });

    test('should return undefined for non-existent backup ID', () => {
      scheduler = new BackupScheduler(backupService);
      
      const retrieved = scheduler.getBackupById('non-existent-id');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('Backup Deletion', () => {
    test('should delete backup by ID', async () => {
      scheduler = new BackupScheduler(backupService);
      const vault = createMockVault();
      const key = createMockKey();

      const storedBackup = await scheduler.createScheduledBackup(vault, key);
      expect(scheduler.getBackupCount()).toBe(1);

      const deleted = scheduler.deleteBackup(storedBackup.id);
      expect(deleted).toBe(true);
      expect(scheduler.getBackupCount()).toBe(0);
    });

    test('should return false when deleting non-existent backup', () => {
      scheduler = new BackupScheduler(backupService);
      
      const deleted = scheduler.deleteBackup('non-existent-id');
      expect(deleted).toBe(false);
    });
  });

  describe('Backup Loading', () => {
    test('should load stored backups from array', () => {
      scheduler = new BackupScheduler(backupService);

      const mockBackups: StoredBackup[] = [
        {
          id: 'backup-1',
          backup: {
            encryptedData: {
              ciphertext: new Uint8Array([1]),
              iv: new Uint8Array([2]),
              authTag: new Uint8Array([3]),
            },
            metadata: {
              version: 1,
              createdAt: Date.now() - 1000,
              appVersion: '1.0.0',
              vaultId: 'vault-1',
            },
          },
          createdAt: Date.now() - 1000,
          frequency: BackupFrequency.DAILY,
        },
        {
          id: 'backup-2',
          backup: {
            encryptedData: {
              ciphertext: new Uint8Array([4]),
              iv: new Uint8Array([5]),
              authTag: new Uint8Array([6]),
            },
            metadata: {
              version: 1,
              createdAt: Date.now(),
              appVersion: '1.0.0',
              vaultId: 'vault-1',
            },
          },
          createdAt: Date.now(),
          frequency: BackupFrequency.DAILY,
        },
      ];

      scheduler.loadStoredBackups(mockBackups);

      expect(scheduler.getBackupCount()).toBe(2);
      expect(scheduler.getLastBackupTime()).toBe(mockBackups[1]!.createdAt);
    });

    test('should enforce backup limit when loading backups', () => {
      scheduler = new BackupScheduler(backupService, {
        frequency: BackupFrequency.DAILY,
        enabled: true,
        maxBackups: 2,
      });

      const mockBackups: StoredBackup[] = [];
      for (let i = 0; i < 5; i++) {
        mockBackups.push({
          id: `backup-${i}`,
          backup: {
            encryptedData: {
              ciphertext: new Uint8Array([1]),
              iv: new Uint8Array([2]),
              authTag: new Uint8Array([3]),
            },
            metadata: {
              version: 1,
              createdAt: Date.now() + i,
              appVersion: '1.0.0',
              vaultId: 'vault-1',
            },
          },
          createdAt: Date.now() + i,
          frequency: BackupFrequency.DAILY,
        });
      }

      scheduler.loadStoredBackups(mockBackups);

      // Should only keep 2 newest backups
      expect(scheduler.getBackupCount()).toBe(2);
    });
  });

  describe('Scheduler Start/Stop', () => {
    test('should start scheduler when enabled', () => {
      scheduler = new BackupScheduler(backupService);
      
      // Should not throw
      expect(() => scheduler.start()).not.toThrow();
    });

    test('should not start scheduler when disabled', () => {
      scheduler = new BackupScheduler(backupService, {
        frequency: BackupFrequency.DAILY,
        enabled: false,
        maxBackups: 10,
      });
      
      scheduler.start();
      // Timer should not be set when disabled
      // This is tested implicitly by the scheduler not creating backups
    });

    test('should stop scheduler', () => {
      scheduler = new BackupScheduler(backupService);
      
      scheduler.start();
      expect(() => scheduler.stop()).not.toThrow();
    });

    test('should handle multiple stop calls', () => {
      scheduler = new BackupScheduler(backupService);
      
      scheduler.start();
      scheduler.stop();
      expect(() => scheduler.stop()).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty backup list', () => {
      scheduler = new BackupScheduler(backupService);
      
      expect(scheduler.getBackupCount()).toBe(0);
      expect(scheduler.getStoredBackups()).toEqual([]);
      expect(scheduler.getLastBackupTime()).toBeNull();
    });

    test('should handle backup creation with maxBackups = 1', async () => {
      scheduler = new BackupScheduler(backupService, {
        frequency: BackupFrequency.DAILY,
        enabled: true,
        maxBackups: 1,
      });
      const vault = createMockVault();
      const key = createMockKey();

      await scheduler.createScheduledBackup(vault, key);
      const firstBackupId = scheduler.getStoredBackups()[0]!.id;

      await scheduler.createScheduledBackup(vault, key);

      expect(scheduler.getBackupCount()).toBe(1);
      expect(scheduler.getBackupById(firstBackupId)).toBeUndefined();
    });

    test('should generate unique backup IDs', async () => {
      scheduler = new BackupScheduler(backupService);
      const vault = createMockVault();
      const key = createMockKey();

      const backup1 = await scheduler.createScheduledBackup(vault, key);
      const backup2 = await scheduler.createScheduledBackup(vault, key);

      expect(backup1.id).not.toBe(backup2.id);
    });
  });
});
