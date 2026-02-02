/**
 * Unit tests for BackupService
 * 
 * Tests backup creation, restoration, and file import/export functionality
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { BackupService, createBackupService } from './backup-service';
import { DefaultCryptoEngine } from '../crypto/crypto-engine';
import { Vault } from '../vault/vault-manager';
import { deriveKeyFromPassword } from '../utils/crypto-utils';
import { PasswordItem } from '../types/vault';

describe('BackupService', () => {
  let backupService: BackupService;
  let cryptoEngine: DefaultCryptoEngine;
  let masterKey: CryptoKey;
  let testVault: Vault;

  beforeEach(async () => {
    cryptoEngine = new DefaultCryptoEngine();
    backupService = createBackupService(cryptoEngine);
    
    // Create a test master key
    const pin = '123456';
    const salt = cryptoEngine.generateSalt();
    masterKey = await deriveKeyFromPassword(pin, salt);

    // Create a test vault with some items
    const passwordItem: PasswordItem = {
      id: 'test-id-1',
      type: 'password',
      title: 'Test Password',
      username: 'testuser',
      password: 'testpass123',
      url: 'https://example.com',
      notes: 'Test notes',
      tags: ['test'],
      history: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    testVault = {
      id: 'vault-123',
      version: 1,
      createdAt: Date.now() - 1000,
      updatedAt: Date.now(),
      items: new Map([['test-id-1', passwordItem]]),
      metadata: {
        version: 1,
        createdAt: Date.now() - 1000,
        updatedAt: Date.now(),
      },
    };
  });

  describe('createBackup', () => {
    it('should create an encrypted backup with metadata', async () => {
      const backup = await backupService.createBackup(testVault, masterKey);

      expect(backup).toBeDefined();
      expect(backup.metadata).toBeDefined();
      expect(backup.metadata.version).toBe(1);
      expect(backup.metadata.createdAt).toBeGreaterThan(0);
      expect(backup.metadata.appVersion).toBe('1.0.0');
      expect(backup.metadata.vaultId).toBe('vault-123');
      expect(backup.encryptedData).toBeDefined();
      expect(backup.encryptedData.ciphertext).toBeInstanceOf(Uint8Array);
      expect(backup.encryptedData.iv).toBeInstanceOf(Uint8Array);
      expect(backup.encryptedData.authTag).toBeInstanceOf(Uint8Array);
    });

    it('should create backup with current timestamp', async () => {
      const beforeTime = Date.now();
      const backup = await backupService.createBackup(testVault, masterKey);
      const afterTime = Date.now();

      expect(backup.metadata.createdAt).toBeGreaterThanOrEqual(beforeTime);
      expect(backup.metadata.createdAt).toBeLessThanOrEqual(afterTime);
    });

    it('should include vault ID in metadata', async () => {
      const backup = await backupService.createBackup(testVault, masterKey);

      expect(backup.metadata.vaultId).toBe(testVault.id);
    });

    it('should create different encrypted data for same vault with different keys', async () => {
      const pin2 = '654321';
      const salt2 = cryptoEngine.generateSalt();
      const masterKey2 = await deriveKeyFromPassword(pin2, salt2);

      const backup1 = await backupService.createBackup(testVault, masterKey);
      const backup2 = await backupService.createBackup(testVault, masterKey2);

      // Encrypted data should be different
      expect(backup1.encryptedData.ciphertext).not.toEqual(backup2.encryptedData.ciphertext);
    });

    it('should handle empty vault', async () => {
      const emptyVault: Vault = {
        ...testVault,
        items: new Map(),
      };

      const backup = await backupService.createBackup(emptyVault, masterKey);

      expect(backup).toBeDefined();
      expect(backup.metadata).toBeDefined();
      expect(backup.encryptedData).toBeDefined();
    });
  });

  describe('restoreBackup', () => {
    it('should restore vault from encrypted backup', async () => {
      const backup = await backupService.createBackup(testVault, masterKey);
      const restored = await backupService.restoreBackup(backup, masterKey);

      expect(restored).toBeDefined();
      expect(restored.vault.id).toBe(testVault.id);
      expect(restored.vault.version).toBe(testVault.version);
      expect(restored.vault.items.size).toBe(testVault.items.size);
      expect(restored.metadata.vaultId).toBe(testVault.id);
    });

    it('should restore all vault items correctly', async () => {
      const backup = await backupService.createBackup(testVault, masterKey);
      const restored = await backupService.restoreBackup(backup, masterKey);

      const originalItem = testVault.items.get('test-id-1') as PasswordItem;
      const restoredItem = restored.vault.items.get('test-id-1') as PasswordItem;

      expect(restoredItem).toBeDefined();
      expect(restoredItem.title).toBe(originalItem.title);
      expect(restoredItem.username).toBe(originalItem.username);
      expect(restoredItem.password).toBe(originalItem.password);
      expect(restoredItem.url).toBe(originalItem.url);
    });

    it('should restore metadata correctly', async () => {
      const backup = await backupService.createBackup(testVault, masterKey);
      const restored = await backupService.restoreBackup(backup, masterKey);

      expect(restored.metadata.version).toBe(backup.metadata.version);
      expect(restored.metadata.createdAt).toBe(backup.metadata.createdAt);
      expect(restored.metadata.appVersion).toBe(backup.metadata.appVersion);
      expect(restored.metadata.vaultId).toBe(backup.metadata.vaultId);
    });

    it('should fail with wrong decryption key', async () => {
      const backup = await backupService.createBackup(testVault, masterKey);

      // Create a different key
      const wrongPin = '999999';
      const wrongSalt = cryptoEngine.generateSalt();
      const wrongKey = await deriveKeyFromPassword(wrongPin, wrongSalt);

      await expect(backupService.restoreBackup(backup, wrongKey)).rejects.toThrow();
    });

    it('should validate backup integrity', async () => {
      const backup = await backupService.createBackup(testVault, masterKey);
      const restored = await backupService.restoreBackup(backup, masterKey);

      // The restored vault ID should match the metadata vault ID
      expect(restored.vault.id).toBe(restored.metadata.vaultId);
      expect(restored.metadata.vaultId).toBe(testVault.id);
    });

    it('should reject backup with missing encryptedData', async () => {
      const invalidBackup = {
        metadata: {
          version: 1,
          createdAt: Date.now(),
          appVersion: '1.0.0',
          vaultId: 'test-vault',
        },
        encryptedData: null as any,
      };

      await expect(backupService.restoreBackup(invalidBackup, masterKey)).rejects.toThrow(
        /invalid backup structure/i
      );
    });

    it('should reject backup with missing metadata', async () => {
      const backup = await backupService.createBackup(testVault, masterKey);
      const invalidBackup = {
        ...backup,
        metadata: null as any,
      };

      await expect(backupService.restoreBackup(invalidBackup, masterKey)).rejects.toThrow(
        /invalid backup structure/i
      );
    });

    it('should reject backup with invalid metadata structure', async () => {
      const backup = await backupService.createBackup(testVault, masterKey);
      
      // Manually create corrupted backup data
      const corruptedData = {
        metadata: {
          version: 'invalid', // Should be number
          createdAt: Date.now(),
          appVersion: '1.0.0',
          vaultId: 'test-vault',
        },
        vault: {
          id: 'test-vault',
          version: 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          items: {},
          metadata: {
            version: 1,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        },
      };

      const jsonString = JSON.stringify(corruptedData);
      const data = new TextEncoder().encode(jsonString);
      const encryptedData = await cryptoEngine.encrypt(data, masterKey);

      const corruptedBackup = {
        metadata: backup.metadata,
        encryptedData,
      };

      await expect(backupService.restoreBackup(corruptedBackup, masterKey)).rejects.toThrow(
        /invalid backup metadata structure/i
      );
    });

    it('should reject backup with vault ID mismatch', async () => {
      const backup = await backupService.createBackup(testVault, masterKey);
      
      // Create backup with mismatched vault ID
      const mismatchedData = {
        metadata: {
          version: 1,
          createdAt: Date.now(),
          appVersion: '1.0.0',
          vaultId: 'wrong-vault-id', // Different from vault.id
        },
        vault: {
          id: 'correct-vault-id',
          version: 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          items: {},
          metadata: {
            version: 1,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        },
      };

      const jsonString = JSON.stringify(mismatchedData);
      const data = new TextEncoder().encode(jsonString);
      const encryptedData = await cryptoEngine.encrypt(data, masterKey);

      const mismatchedBackup = {
        metadata: backup.metadata,
        encryptedData,
      };

      await expect(backupService.restoreBackup(mismatchedBackup, masterKey)).rejects.toThrow(
        /vault ID mismatch/i
      );
    });

    it('should reject backup with unsupported version', async () => {
      const backup = await backupService.createBackup(testVault, masterKey);
      
      // Create backup with future version
      const futureVersionData = {
        metadata: {
          version: 999, // Future version
          createdAt: Date.now(),
          appVersion: '99.0.0',
          vaultId: testVault.id,
        },
        vault: {
          id: testVault.id,
          version: 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          items: {},
          metadata: {
            version: 1,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        },
      };

      const jsonString = JSON.stringify(futureVersionData);
      const data = new TextEncoder().encode(jsonString);
      const encryptedData = await cryptoEngine.encrypt(data, masterKey);

      const futureBackup = {
        metadata: backup.metadata,
        encryptedData,
      };

      await expect(backupService.restoreBackup(futureBackup, masterKey)).rejects.toThrow(
        /version.*not supported/i
      );
    });

    it('should reject backup with invalid vault structure', async () => {
      const backup = await backupService.createBackup(testVault, masterKey);
      
      // Create backup with invalid vault structure
      const invalidVaultData = {
        metadata: {
          version: 1,
          createdAt: Date.now(),
          appVersion: '1.0.0',
          vaultId: testVault.id,
        },
        vault: {
          id: testVault.id,
          version: 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          items: {}, // Will be deserialized as Map
          metadata: null, // Invalid metadata
        },
      };

      const jsonString = JSON.stringify(invalidVaultData);
      const data = new TextEncoder().encode(jsonString);
      const encryptedData = await cryptoEngine.encrypt(data, masterKey);

      const invalidBackup = {
        metadata: backup.metadata,
        encryptedData,
      };

      await expect(backupService.restoreBackup(invalidBackup, masterKey)).rejects.toThrow(
        /invalid vault/i
      );
    });
  });

  describe('exportBackupToFile', () => {
    it('should export backup to base64 string', async () => {
      const backup = await backupService.createBackup(testVault, masterKey);
      const fileContent = backupService.exportBackupToFile(backup);

      expect(typeof fileContent).toBe('string');
      expect(fileContent.length).toBeGreaterThan(0);
      // Base64 strings only contain these characters
      expect(fileContent).toMatch(/^[A-Za-z0-9+/=]+$/);
    });

    it('should create different exports for different backups', async () => {
      const backup1 = await backupService.createBackup(testVault, masterKey);
      
      // Wait a bit to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const backup2 = await backupService.createBackup(testVault, masterKey);

      const export1 = backupService.exportBackupToFile(backup1);
      const export2 = backupService.exportBackupToFile(backup2);

      expect(export1).not.toBe(export2);
    });
  });

  describe('importBackupFromFile', () => {
    it('should import backup from base64 string', async () => {
      const originalBackup = await backupService.createBackup(testVault, masterKey);
      const fileContent = backupService.exportBackupToFile(originalBackup);

      const importedBackup = backupService.importBackupFromFile(fileContent);

      expect(importedBackup).toBeDefined();
      expect(importedBackup.metadata.version).toBe(originalBackup.metadata.version);
      expect(importedBackup.metadata.vaultId).toBe(originalBackup.metadata.vaultId);
      expect(importedBackup.encryptedData.ciphertext).toEqual(
        originalBackup.encryptedData.ciphertext
      );
    });

    it('should fail with invalid base64 string', () => {
      const invalidContent = 'not-valid-base64!!!';

      expect(() => backupService.importBackupFromFile(invalidContent)).toThrow();
    });

    it('should fail with invalid JSON structure', () => {
      // Create a valid base64 string but with invalid JSON
      const invalidJson = btoa('{"invalid": "structure"}');

      expect(() => backupService.importBackupFromFile(invalidJson)).toThrow(
        /invalid backup file format/i
      );
    });
  });

  describe('round-trip backup and restore', () => {
    it('should successfully backup and restore vault', async () => {
      // Create backup
      const backup = await backupService.createBackup(testVault, masterKey);

      // Export to file
      const fileContent = backupService.exportBackupToFile(backup);

      // Import from file
      const importedBackup = backupService.importBackupFromFile(fileContent);

      // Restore from backup
      const restored = await backupService.restoreBackup(importedBackup, masterKey);

      // Verify vault data is intact
      expect(restored.vault.id).toBe(testVault.id);
      expect(restored.vault.items.size).toBe(testVault.items.size);

      const originalItem = testVault.items.get('test-id-1') as PasswordItem;
      const restoredItem = restored.vault.items.get('test-id-1') as PasswordItem;

      expect(restoredItem.title).toBe(originalItem.title);
      expect(restoredItem.username).toBe(originalItem.username);
      expect(restoredItem.password).toBe(originalItem.password);
    });

    it('should preserve all vault metadata through round-trip', async () => {
      const backup = await backupService.createBackup(testVault, masterKey);
      const fileContent = backupService.exportBackupToFile(backup);
      const importedBackup = backupService.importBackupFromFile(fileContent);
      const restored = await backupService.restoreBackup(importedBackup, masterKey);

      expect(restored.vault.version).toBe(testVault.version);
      expect(restored.vault.createdAt).toBe(testVault.createdAt);
      expect(restored.vault.metadata.version).toBe(testVault.metadata.version);
    });
  });

  describe('edge cases', () => {
    it('should handle vault with multiple items', async () => {
      const multiItemVault: Vault = {
        ...testVault,
        items: new Map([
          ['id-1', { ...testVault.items.get('test-id-1')!, id: 'id-1' }],
          ['id-2', { ...testVault.items.get('test-id-1')!, id: 'id-2', title: 'Item 2' }],
          ['id-3', { ...testVault.items.get('test-id-1')!, id: 'id-3', title: 'Item 3' }],
        ]),
      };

      const backup = await backupService.createBackup(multiItemVault, masterKey);
      const restored = await backupService.restoreBackup(backup, masterKey);

      expect(restored.vault.items.size).toBe(3);
    });

    it('should handle vault with special characters in data', async () => {
      const specialVault: Vault = {
        ...testVault,
        items: new Map([
          [
            'special-id',
            {
              ...testVault.items.get('test-id-1')!,
              id: 'special-id',
              title: 'Test 🔒 Special',
              password: 'p@$$w0rd!#%&*',
              notes: 'Notes with\nnewlines\tand\ttabs',
            },
          ],
        ]),
      };

      const backup = await backupService.createBackup(specialVault, masterKey);
      const restored = await backupService.restoreBackup(backup, masterKey);

      const item = restored.vault.items.get('special-id') as PasswordItem;
      expect(item.title).toBe('Test 🔒 Special');
      expect(item.password).toBe('p@$$w0rd!#%&*');
      expect(item.notes).toBe('Notes with\nnewlines\tand\ttabs');
    });
  });
});
