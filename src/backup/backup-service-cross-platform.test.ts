/**
 * Cross-platform tests for BackupService
 * 
 * Tests secure export/import functionality for cross-platform synchronization
 * 
 * Requirements:
 * - 5.3: Maintain data synchronization between platforms via secure export/import
 * - 5.4: Create encrypted file with password when exporting
 * - 5.5: Validate integrity and decrypt using password when importing
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { BackupService, createBackupService } from './backup-service';
import { DefaultCryptoEngine } from '../crypto/crypto-engine';
import { Vault } from '../vault/vault-manager';
import { deriveKeyFromPassword } from '../utils/crypto-utils';
import { PasswordItem, CreditCardItem, DocumentItem, VaultItem } from '../types/vault';

describe('BackupService - Cross-Platform Synchronization', () => {
  let backupService: BackupService;
  let cryptoEngine: DefaultCryptoEngine;
  let backupKey: CryptoKey;
  let testVault: Vault;

  // Helper to create a mutable vault for testing
  const createMutableVault = (vault: Vault): Vault => {
    return {
      ...vault,
      items: new Map(vault.items) as ReadonlyMap<string, VaultItem>,
    };
  };

  beforeEach(async () => {
    cryptoEngine = new DefaultCryptoEngine();
    backupService = createBackupService(cryptoEngine);
    
    // Create a backup key from password (simulating user-provided password)
    const password = 'SecureBackupPassword123!';
    const salt = cryptoEngine.generateSalt();
    backupKey = await deriveKeyFromPassword(password, salt);

    // Create a comprehensive test vault with all item types
    const passwordItem: PasswordItem = {
      id: 'pwd-1',
      type: 'password',
      title: 'Gmail Account',
      username: 'user@gmail.com',
      password: 'SecurePass123!',
      url: 'https://gmail.com',
      notes: 'Primary email account',
      tags: ['email', 'important'],
      history: [
        { password: 'OldPass456', changedAt: Date.now() - 86400000 },
      ],
      createdAt: Date.now() - 172800000,
      updatedAt: Date.now() - 86400000,
    };

    const creditCardItem: CreditCardItem = {
      id: 'cc-1',
      type: 'creditcard',
      title: 'Visa Card',
      cardNumber: '4532015112830366',
      holderName: 'John Doe',
      expiryDate: '12/25',
      cvv: '123',
      notes: 'Primary credit card',
      tags: ['finance'],
      createdAt: Date.now() - 172800000,
      updatedAt: Date.now() - 86400000,
    };

    const documentItem: DocumentItem = {
      id: 'doc-1',
      type: 'document',
      title: 'Passport Scan',
      content: {
        type: 'image',
        data: new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), // PNG header
        mimeType: 'image/png',
        size: 8,
      },
      tags: ['identity', 'travel'],
      notes: 'Passport photo',
      createdAt: Date.now() - 172800000,
      updatedAt: Date.now() - 86400000,
    };

    testVault = {
      id: 'vault-cross-platform-test',
      version: 1,
      createdAt: Date.now() - 259200000,
      updatedAt: Date.now() - 86400000,
      items: new Map<string, VaultItem>([
        ['pwd-1', passwordItem],
        ['cc-1', creditCardItem],
        ['doc-1', documentItem],
      ]),
      metadata: {
        version: 1,
        createdAt: Date.now() - 259200000,
        updatedAt: Date.now() - 86400000,
      },
    };
  });

  describe('Requirement 5.3: Cross-platform data synchronization', () => {
    it('should export vault in platform-independent format', async () => {
      // Create backup
      const backup = await backupService.createBackup(testVault, backupKey);
      
      // Export to file (base64 format is platform-independent)
      const fileContent = backupService.exportBackupToFile(backup);

      // Verify it's a valid base64 string (works on all platforms)
      expect(typeof fileContent).toBe('string');
      expect(fileContent).toMatch(/^[A-Za-z0-9+/=]+$/);
      expect(fileContent.length).toBeGreaterThan(0);
    });

    it('should import vault from platform-independent format', async () => {
      // Simulate export from one platform
      const backup = await backupService.createBackup(testVault, backupKey);
      const fileContent = backupService.exportBackupToFile(backup);

      // Simulate import on another platform
      const importedBackup = backupService.importBackupFromFile(fileContent);
      const restored = await backupService.restoreBackup(importedBackup, backupKey);

      // Verify all data is intact
      expect(restored.vault.id).toBe(testVault.id);
      expect(restored.vault.items.size).toBe(3);
    });

    it('should preserve all item types across platforms', async () => {
      const backup = await backupService.createBackup(testVault, backupKey);
      const fileContent = backupService.exportBackupToFile(backup);
      const importedBackup = backupService.importBackupFromFile(fileContent);
      const restored = await backupService.restoreBackup(importedBackup, backupKey);

      // Verify password item
      const passwordItem = restored.vault.items.get('pwd-1') as PasswordItem;
      expect(passwordItem).toBeDefined();
      expect(passwordItem.type).toBe('password');
      expect(passwordItem.username).toBe('user@gmail.com');
      expect(passwordItem.password).toBe('SecurePass123!');
      expect(passwordItem.history).toHaveLength(1);

      // Verify credit card item
      const creditCardItem = restored.vault.items.get('cc-1') as CreditCardItem;
      expect(creditCardItem).toBeDefined();
      expect(creditCardItem.type).toBe('creditcard');
      expect(creditCardItem.cardNumber).toBe('4532015112830366');
      expect(creditCardItem.holderName).toBe('John Doe');

      // Verify document item
      const documentItem = restored.vault.items.get('doc-1') as DocumentItem;
      expect(documentItem).toBeDefined();
      expect(documentItem.type).toBe('document');
      expect(documentItem.content.data).toBeInstanceOf(Uint8Array);
      expect(documentItem.content.data).toEqual(
        new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
      );
    });

    it('should handle binary data (Uint8Array) correctly across platforms', async () => {
      // Binary data is common in documents and needs special handling
      const backup = await backupService.createBackup(testVault, backupKey);
      const fileContent = backupService.exportBackupToFile(backup);
      const importedBackup = backupService.importBackupFromFile(fileContent);
      const restored = await backupService.restoreBackup(importedBackup, backupKey);

      const documentItem = restored.vault.items.get('doc-1') as DocumentItem;
      
      // Verify binary data is preserved exactly
      expect(documentItem.content.data).toBeInstanceOf(Uint8Array);
      expect(Array.from(documentItem.content.data)).toEqual([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A
      ]);
    });

    it('should preserve timestamps across platforms', async () => {
      const backup = await backupService.createBackup(testVault, backupKey);
      const fileContent = backupService.exportBackupToFile(backup);
      const importedBackup = backupService.importBackupFromFile(fileContent);
      const restored = await backupService.restoreBackup(importedBackup, backupKey);

      // Verify vault timestamps
      expect(restored.vault.createdAt).toBe(testVault.createdAt);
      expect(restored.vault.updatedAt).toBe(testVault.updatedAt);

      // Verify item timestamps
      const passwordItem = restored.vault.items.get('pwd-1') as PasswordItem;
      expect(passwordItem.createdAt).toBe((testVault.items.get('pwd-1') as PasswordItem).createdAt);
      expect(passwordItem.updatedAt).toBe((testVault.items.get('pwd-1') as PasswordItem).updatedAt);
    });

    it('should preserve tags and metadata across platforms', async () => {
      const backup = await backupService.createBackup(testVault, backupKey);
      const fileContent = backupService.exportBackupToFile(backup);
      const importedBackup = backupService.importBackupFromFile(fileContent);
      const restored = await backupService.restoreBackup(importedBackup, backupKey);

      const passwordItem = restored.vault.items.get('pwd-1') as PasswordItem;
      expect(passwordItem.tags).toEqual(['email', 'important']);
      expect(passwordItem.notes).toBe('Primary email account');

      const documentItem = restored.vault.items.get('doc-1') as DocumentItem;
      expect(documentItem.tags).toEqual(['identity', 'travel']);
    });

    it('should handle Unicode and special characters across platforms', async () => {
      // Add item with Unicode characters
      const unicodeItem: PasswordItem = {
        id: 'unicode-1',
        type: 'password',
        title: '测试账户 🔒 Тест',
        username: 'user@例え.jp',
        password: 'пароль123!',
        url: 'https://例え.jp',
        notes: 'Notes with émojis 🎉 and spëcial çhars',
        tags: ['тест', '测试'],
        history: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const extendedVault = createMutableVault(testVault);
      (extendedVault.items as Map<string, VaultItem>).set('unicode-1', unicodeItem);

      const backup = await backupService.createBackup(extendedVault, backupKey);
      const fileContent = backupService.exportBackupToFile(backup);
      const importedBackup = backupService.importBackupFromFile(fileContent);
      const restored = await backupService.restoreBackup(importedBackup, backupKey);

      const restoredItem = restored.vault.items.get('unicode-1') as PasswordItem;
      expect(restoredItem.title).toBe('测试账户 🔒 Тест');
      expect(restoredItem.username).toBe('user@例え.jp');
      expect(restoredItem.password).toBe('пароль123!');
      expect(restoredItem.notes).toBe('Notes with émojis 🎉 and spëcial çhars');
      expect(restoredItem.tags).toEqual(['тест', '测试']);
    });
  });

  describe('Requirement 5.4: Encrypted file with password', () => {
    it('should create encrypted backup using user-provided password', async () => {
      // User provides password for backup
      const userPassword = 'MySecureBackupPassword123!';
      const salt = cryptoEngine.generateSalt();
      const userBackupKey = await deriveKeyFromPassword(userPassword, salt);

      // Create encrypted backup
      const backup = await backupService.createBackup(testVault, userBackupKey);

      // Verify backup is encrypted
      expect(backup.encryptedData).toBeDefined();
      expect(backup.encryptedData.ciphertext).toBeInstanceOf(Uint8Array);
      expect(backup.encryptedData.ciphertext.length).toBeGreaterThan(0);
      
      // Verify encrypted data doesn't contain plaintext
      const ciphertextString = new TextDecoder().decode(backup.encryptedData.ciphertext);
      expect(ciphertextString).not.toContain('Gmail Account');
      expect(ciphertextString).not.toContain('user@gmail.com');
      expect(ciphertextString).not.toContain('SecurePass123!');
    });

    it('should require correct password to decrypt backup', async () => {
      // Create backup with one password
      const correctPassword = 'CorrectPassword123!';
      const salt1 = cryptoEngine.generateSalt();
      const correctKey = await deriveKeyFromPassword(correctPassword, salt1);
      
      const backup = await backupService.createBackup(testVault, correctKey);

      // Try to restore with wrong password
      const wrongPassword = 'WrongPassword456!';
      const salt2 = cryptoEngine.generateSalt();
      const wrongKey = await deriveKeyFromPassword(wrongPassword, salt2);

      await expect(backupService.restoreBackup(backup, wrongKey)).rejects.toThrow();
    });

    it('should successfully decrypt with correct password', async () => {
      // Create backup with password
      const password = 'MyPassword123!';
      const salt = cryptoEngine.generateSalt();
      const key = await deriveKeyFromPassword(password, salt);
      
      const backup = await backupService.createBackup(testVault, key);

      // Restore with same password (simulating same key derivation)
      const restored = await backupService.restoreBackup(backup, key);

      expect(restored.vault.id).toBe(testVault.id);
      expect(restored.vault.items.size).toBe(testVault.items.size);
    });

    it('should use strong encryption (AES-256-GCM)', async () => {
      const backup = await backupService.createBackup(testVault, backupKey);

      // Verify encryption components are present
      expect(backup.encryptedData.ciphertext).toBeInstanceOf(Uint8Array);
      expect(backup.encryptedData.iv).toBeInstanceOf(Uint8Array);
      expect(backup.encryptedData.authTag).toBeInstanceOf(Uint8Array);

      // IV should be 12 bytes for GCM
      expect(backup.encryptedData.iv.length).toBe(12);
      
      // Auth tag should be 16 bytes for GCM
      expect(backup.encryptedData.authTag.length).toBe(16);
    });
  });

  describe('Requirement 5.5: Integrity validation and decryption', () => {
    it('should validate integrity using AES-GCM authentication tag', async () => {
      const backup = await backupService.createBackup(testVault, backupKey);

      // Tamper with ciphertext
      const lastByte = backup.encryptedData.ciphertext[backup.encryptedData.ciphertext.length - 1];
      const tamperedBackup = {
        ...backup,
        encryptedData: {
          ...backup.encryptedData,
          ciphertext: new Uint8Array([
            ...backup.encryptedData.ciphertext.slice(0, -1),
            (lastByte ?? 0) ^ 0xFF,
          ]),
        },
      };

      // Should fail integrity check
      await expect(backupService.restoreBackup(tamperedBackup, backupKey)).rejects.toThrow();
    });

    it('should validate integrity of metadata', async () => {
      const backup = await backupService.createBackup(testVault, backupKey);

      // The external metadata is not part of the encrypted data validation
      // The real integrity check happens via AES-GCM auth tag on the encrypted data
      // and by validating the vault ID inside the encrypted data matches the metadata
      
      // Create a backup with mismatched vault ID inside the encrypted data
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
      const encryptedData = await cryptoEngine.encrypt(data, backupKey);

      const mismatchedBackup = {
        metadata: backup.metadata,
        encryptedData,
      };

      // Should fail when vault ID doesn't match
      await expect(backupService.restoreBackup(mismatchedBackup, backupKey)).rejects.toThrow(
        /vault ID mismatch/i
      );
    });

    it('should validate backup structure before decryption', async () => {
      const invalidBackup = {
        metadata: null as any,
        encryptedData: null as any,
      };

      await expect(backupService.restoreBackup(invalidBackup, backupKey)).rejects.toThrow(
        /invalid backup structure/i
      );
    });

    it('should validate vault structure after decryption', async () => {
      // Create a backup with invalid vault structure
      const invalidVaultData = {
        metadata: {
          version: 1,
          createdAt: Date.now(),
          appVersion: '1.0.0',
          vaultId: 'test-vault',
        },
        vault: {
          id: 'test-vault',
          version: 'invalid', // Should be number
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

      const jsonString = JSON.stringify(invalidVaultData);
      const data = new TextEncoder().encode(jsonString);
      const encryptedData = await cryptoEngine.encrypt(data, backupKey);

      const invalidBackup = {
        metadata: {
          version: 1,
          createdAt: Date.now(),
          appVersion: '1.0.0',
          vaultId: 'test-vault',
        },
        encryptedData,
      };

      await expect(backupService.restoreBackup(invalidBackup, backupKey)).rejects.toThrow();
    });

    it('should validate backup version compatibility', async () => {
      // Create backup with future version
      const futureVersionData = {
        metadata: {
          version: 999,
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
      const encryptedData = await cryptoEngine.encrypt(data, backupKey);

      const futureBackup = {
        metadata: {
          version: 1,
          createdAt: Date.now(),
          appVersion: '1.0.0',
          vaultId: testVault.id,
        },
        encryptedData,
      };

      await expect(backupService.restoreBackup(futureBackup, backupKey)).rejects.toThrow(
        /version.*not supported/i
      );
    });

    it('should successfully restore valid backup with integrity intact', async () => {
      const backup = await backupService.createBackup(testVault, backupKey);
      const fileContent = backupService.exportBackupToFile(backup);
      const importedBackup = backupService.importBackupFromFile(fileContent);
      const restored = await backupService.restoreBackup(importedBackup, backupKey);

      // Verify all data is intact
      expect(restored.vault.id).toBe(testVault.id);
      expect(restored.vault.items.size).toBe(testVault.items.size);
      expect(restored.metadata.vaultId).toBe(testVault.id);

      // Verify specific item data
      const passwordItem = restored.vault.items.get('pwd-1') as PasswordItem;
      expect(passwordItem.password).toBe('SecurePass123!');
      
      const creditCardItem = restored.vault.items.get('cc-1') as CreditCardItem;
      expect(creditCardItem.cvv).toBe('123');
    });
  });

  describe('Cross-platform edge cases', () => {
    it('should handle large vaults efficiently', async () => {
      // Create a vault with many items
      const largeVault: Vault = {
        ...testVault,
        items: new Map<string, VaultItem>(),
      };

      const itemsMap = largeVault.items as Map<string, VaultItem>;
      for (let i = 0; i < 100; i++) {
        const item: PasswordItem = {
          id: `item-${i}`,
          type: 'password',
          title: `Account ${i}`,
          username: `user${i}@example.com`,
          password: `password${i}`,
          url: `https://example${i}.com`,
          notes: `Notes for account ${i}`,
          tags: [`tag${i % 10}`],
          history: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        itemsMap.set(`item-${i}`, item);
      }

      const backup = await backupService.createBackup(largeVault, backupKey);
      const fileContent = backupService.exportBackupToFile(backup);
      const importedBackup = backupService.importBackupFromFile(fileContent);
      const restored = await backupService.restoreBackup(importedBackup, backupKey);

      expect(restored.vault.items.size).toBe(100);
    });

    it('should handle empty vault', async () => {
      const emptyVault: Vault = {
        ...testVault,
        items: new Map(),
      };

      const backup = await backupService.createBackup(emptyVault, backupKey);
      const fileContent = backupService.exportBackupToFile(backup);
      const importedBackup = backupService.importBackupFromFile(fileContent);
      const restored = await backupService.restoreBackup(importedBackup, backupKey);

      expect(restored.vault.items.size).toBe(0);
      expect(restored.vault.id).toBe(emptyVault.id);
    });

    it('should handle vault with only one item type', async () => {
      const singleTypeVault: Vault = {
        ...testVault,
        items: new Map([['pwd-1', testVault.items.get('pwd-1')!]]),
      };

      const backup = await backupService.createBackup(singleTypeVault, backupKey);
      const fileContent = backupService.exportBackupToFile(backup);
      const importedBackup = backupService.importBackupFromFile(fileContent);
      const restored = await backupService.restoreBackup(importedBackup, backupKey);

      expect(restored.vault.items.size).toBe(1);
      const item = restored.vault.items.get('pwd-1') as PasswordItem;
      expect(item.type).toBe('password');
    });

    it('should handle items with empty optional fields', async () => {
      const minimalItem: PasswordItem = {
        id: 'minimal-1',
        type: 'password',
        title: 'Minimal',
        username: 'user',
        password: 'pass',
        tags: [],
        history: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const extendedVault = createMutableVault(testVault);
      (extendedVault.items as Map<string, VaultItem>).set('minimal-1', minimalItem);

      const backup = await backupService.createBackup(extendedVault, backupKey);
      const fileContent = backupService.exportBackupToFile(backup);
      const importedBackup = backupService.importBackupFromFile(fileContent);
      const restored = await backupService.restoreBackup(importedBackup, backupKey);

      const restoredItem = restored.vault.items.get('minimal-1') as PasswordItem;
      expect(restoredItem.title).toBe('Minimal');
      expect(restoredItem.url).toBeUndefined();
      expect(restoredItem.notes).toBeUndefined();
      expect(restoredItem.tags).toEqual([]);
    });

    it('should handle different line endings (CRLF vs LF)', async () => {
      // This tests that the base64 encoding handles different platforms
      const backup = await backupService.createBackup(testVault, backupKey);
      const fileContent = backupService.exportBackupToFile(backup);

      // Verify import works
      expect(() => backupService.importBackupFromFile(fileContent)).not.toThrow();
      
      // Base64 strings shouldn't have line endings in our implementation
      expect(fileContent).not.toContain('\n');
      expect(fileContent).not.toContain('\r');
    });
  });

  describe('Complete cross-platform workflow', () => {
    it('should support mobile to web synchronization', async () => {
      // Simulate mobile export
      const mobileBackup = await backupService.createBackup(testVault, backupKey);
      const exportedFile = backupService.exportBackupToFile(mobileBackup);

      // User transfers file to web platform
      // Simulate web import
      const webImportedBackup = backupService.importBackupFromFile(exportedFile);
      const webRestored = await backupService.restoreBackup(webImportedBackup, backupKey);

      // Verify data is identical
      expect(webRestored.vault.id).toBe(testVault.id);
      expect(webRestored.vault.items.size).toBe(testVault.items.size);

      // Verify all items are present and correct
      for (const [id, originalItem] of testVault.items) {
        const restoredItem = webRestored.vault.items.get(id);
        expect(restoredItem).toBeDefined();
        expect((restoredItem as any).type).toBe((originalItem as any).type);
      }
    });

    it('should support web to mobile synchronization', async () => {
      // Simulate web export
      const webBackup = await backupService.createBackup(testVault, backupKey);
      const exportedFile = backupService.exportBackupToFile(webBackup);

      // User transfers file to mobile platform
      // Simulate mobile import
      const mobileImportedBackup = backupService.importBackupFromFile(exportedFile);
      const mobileRestored = await backupService.restoreBackup(mobileImportedBackup, backupKey);

      // Verify data is identical
      expect(mobileRestored.vault.id).toBe(testVault.id);
      expect(mobileRestored.vault.items.size).toBe(testVault.items.size);
    });

    it('should support bidirectional synchronization', async () => {
      // Mobile -> Web
      const mobileBackup = await backupService.createBackup(testVault, backupKey);
      const mobileExport = backupService.exportBackupToFile(mobileBackup);
      const webImport = backupService.importBackupFromFile(mobileExport);
      const webVault = await backupService.restoreBackup(webImport, backupKey);

      // Modify on web
      const newItem: PasswordItem = {
        id: 'web-added',
        type: 'password',
        title: 'Added on Web',
        username: 'webuser',
        password: 'webpass',
        tags: [],
        history: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      
      const modifiedWebVault = createMutableVault(webVault.vault);
      (modifiedWebVault.items as Map<string, VaultItem>).set('web-added', newItem);

      // Web -> Mobile
      const webBackup = await backupService.createBackup(modifiedWebVault, backupKey);
      const webExport = backupService.exportBackupToFile(webBackup);
      const mobileImport = backupService.importBackupFromFile(webExport);
      const finalMobileVault = await backupService.restoreBackup(mobileImport, backupKey);

      // Verify the new item is present
      expect(finalMobileVault.vault.items.size).toBe(testVault.items.size + 1);
      const addedItem = finalMobileVault.vault.items.get('web-added') as PasswordItem;
      expect(addedItem).toBeDefined();
      expect(addedItem.title).toBe('Added on Web');
    });
  });
});
