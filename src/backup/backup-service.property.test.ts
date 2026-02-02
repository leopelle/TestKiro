/**
 * Property-Based Tests for BackupService
 * 
 * These tests verify universal properties that should hold for all backup operations
 * using property-based testing with fast-check.
 * 
 * Feature: password-manager-app
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import * as fc from 'fast-check';
import { BackupService, createBackupService } from './backup-service';
import { DefaultCryptoEngine } from '../crypto/crypto-engine';
import { Vault } from '../vault/vault-manager';
import { deriveKeyFromPassword } from '../utils/crypto-utils';
import { PasswordItem, CreditCardItem, DocumentItem } from '../types/vault';

describe('BackupService Property-Based Tests', () => {
  let backupService: BackupService;
  let cryptoEngine: DefaultCryptoEngine;
  let masterKey: CryptoKey;

  beforeEach(async () => {
    cryptoEngine = new DefaultCryptoEngine();
    backupService = createBackupService(cryptoEngine);
    
    // Create a test master key
    const pin = '123456';
    const salt = cryptoEngine.generateSalt();
    masterKey = await deriveKeyFromPassword(pin, salt);
  });

  /**
   * Property 21: Completezza Backup
   * 
   * For any backup operation, the resulting file should contain all vault data
   * and required metadata (version, date).
   * 
   * This property verifies that:
   * 1. All vault items are included in the backup
   * 2. All vault metadata is preserved in the backup
   * 3. Backup metadata includes version and creation date
   * 4. Backup metadata includes app version and vault ID
   * 5. Restored vault contains exactly the same data as the original
   * 6. No data is lost during backup and restore cycle
   * 
   * **Validates: Requirements 8.1, 8.4**
   * 
   * Feature: password-manager-app, Property 21: Completezza Backup
   */
  describe('Property 21: Completezza Backup', () => {
    test('backup contains all vault data and required metadata', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate arbitrary vault with various items
          fc.record({
            id: fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length >= 5),
            version: fc.integer({ min: 1, max: 100 }),
            createdAt: fc.integer({ min: 1000000000000, max: Date.now() }),
            updatedAt: fc.integer({ min: 1000000000000, max: Date.now() }),
            items: fc.array(
              fc.oneof(
                // Password items
                fc.record({
                  id: fc.uuid(),
                  type: fc.constant('password' as const),
                  title: fc.string({ minLength: 4, maxLength: 100 }).filter(s => s.trim().length >= 4),
                  username: fc.string({ minLength: 4, maxLength: 100 }).filter(s => s.trim().length >= 4),
                  password: fc.string({ minLength: 8, maxLength: 100 }).filter(s => s.trim().length >= 8),
                  url: fc.option(fc.webUrl(), { nil: undefined }),
                  notes: fc.option(fc.string({ maxLength: 500 }), { nil: undefined }),
                  tags: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 10 }),
                  history: fc.array(
                    fc.record({
                      password: fc.string({ minLength: 8, maxLength: 50 }),
                      changedAt: fc.integer({ min: 1000000000000, max: Date.now() }),
                    }),
                    { maxLength: 5 }
                  ),
                  createdAt: fc.integer({ min: 1000000000000, max: Date.now() }),
                  updatedAt: fc.integer({ min: 1000000000000, max: Date.now() }),
                }),
                // Credit card items
                fc.record({
                  id: fc.uuid(),
                  type: fc.constant('creditcard' as const),
                  title: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
                  cardNumber: fc.constantFrom('4532015112830366', '5425233430109903', '374245455400126'),
                  holderName: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
                  expiryDate: fc.constantFrom('12/25', '06/26', '09/27', '12/30'),
                  cvv: fc.constantFrom('123', '456', '789', '1234'),
                  notes: fc.option(fc.string({ maxLength: 500 }), { nil: undefined }),
                  tags: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 10 }),
                  createdAt: fc.integer({ min: 1000000000000, max: Date.now() }),
                  updatedAt: fc.integer({ min: 1000000000000, max: Date.now() }),
                }),
                // Document items
                fc.record({
                  id: fc.uuid(),
                  type: fc.constant('document' as const),
                  title: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
                  content: fc.record({
                    type: fc.constantFrom('text' as const, 'image' as const, 'pdf' as const),
                    data: fc.uint8Array({ minLength: 1, maxLength: 1000 }),
                    mimeType: fc.constantFrom('text/plain', 'image/jpeg', 'image/png', 'application/pdf'),
                    size: fc.nat({ max: 1000 }),
                  }).chain(content => 
                    fc.constant({
                      ...content,
                      size: content.data.length,
                    })
                  ),
                  notes: fc.option(fc.string({ maxLength: 500 }), { nil: undefined }),
                  tags: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 10 }),
                  createdAt: fc.integer({ min: 1000000000000, max: Date.now() }),
                  updatedAt: fc.integer({ min: 1000000000000, max: Date.now() }),
                })
              ),
              { minLength: 0, maxLength: 10 }
            ),
          }).chain(vaultData => {
            // Ensure updatedAt >= createdAt
            const createdAt = vaultData.createdAt;
            const updatedAt = Math.max(vaultData.updatedAt, createdAt);
            
            // Convert items array to Map
            const itemsMap = new Map();
            for (const item of vaultData.items) {
              itemsMap.set(item.id, item);
            }
            
            return fc.constant({
              id: vaultData.id,
              version: vaultData.version,
              createdAt,
              updatedAt,
              items: itemsMap,
              metadata: {
                version: vaultData.version,
                createdAt,
                updatedAt,
              },
            } as Vault);
          }),
          async (vault) => {
            // Create backup
            const backup = await backupService.createBackup(vault, masterKey);
            
            // Property 1: Backup must have metadata
            expect(backup.metadata).toBeDefined();
            expect(backup.metadata).not.toBeNull();
            
            // Property 2: Backup metadata must include version
            expect(backup.metadata.version).toBeDefined();
            expect(typeof backup.metadata.version).toBe('number');
            expect(backup.metadata.version).toBeGreaterThan(0);
            
            // Property 3: Backup metadata must include creation date
            expect(backup.metadata.createdAt).toBeDefined();
            expect(typeof backup.metadata.createdAt).toBe('number');
            expect(backup.metadata.createdAt).toBeGreaterThan(0);
            expect(backup.metadata.createdAt).toBeLessThanOrEqual(Date.now());
            
            // Property 4: Backup metadata must include app version
            expect(backup.metadata.appVersion).toBeDefined();
            expect(typeof backup.metadata.appVersion).toBe('string');
            expect(backup.metadata.appVersion.length).toBeGreaterThan(0);
            
            // Property 5: Backup metadata must include vault ID
            expect(backup.metadata.vaultId).toBeDefined();
            expect(backup.metadata.vaultId).toBe(vault.id);
            
            // Property 6: Backup must have encrypted data
            expect(backup.encryptedData).toBeDefined();
            expect(backup.encryptedData.ciphertext).toBeInstanceOf(Uint8Array);
            expect(backup.encryptedData.iv).toBeInstanceOf(Uint8Array);
            expect(backup.encryptedData.authTag).toBeInstanceOf(Uint8Array);
            
            // Property 7: Restore backup and verify all data is preserved
            const restored = await backupService.restoreBackup(backup, masterKey);
            
            // Property 8: Restored vault must have same ID
            expect(restored.vault.id).toBe(vault.id);
            
            // Property 9: Restored vault must have same version
            expect(restored.vault.version).toBe(vault.version);
            
            // Property 10: Restored vault must have same timestamps
            expect(restored.vault.createdAt).toBe(vault.createdAt);
            expect(restored.vault.updatedAt).toBe(vault.updatedAt);
            
            // Property 11: Restored vault must have same number of items
            expect(restored.vault.items.size).toBe(vault.items.size);
            
            // Property 12: All vault items must be present in restored vault
            for (const [itemId, originalItem] of vault.items) {
              const restoredItem = restored.vault.items.get(itemId);
              
              expect(restoredItem).toBeDefined();
              expect(restoredItem).not.toBeNull();
              
              // Verify item type
              expect(restoredItem?.type).toBe(originalItem.type);
              
              // Verify common fields
              expect(restoredItem?.id).toBe(originalItem.id);
              expect(restoredItem?.title).toBe(originalItem.title);
              expect(restoredItem?.createdAt).toBe(originalItem.createdAt);
              expect(restoredItem?.updatedAt).toBe(originalItem.updatedAt);
              
              // Verify type-specific fields
              if (originalItem.type === 'password') {
                const originalPassword = originalItem as PasswordItem;
                const restoredPassword = restoredItem as PasswordItem;
                
                expect(restoredPassword.username).toBe(originalPassword.username);
                expect(restoredPassword.password).toBe(originalPassword.password);
                expect(restoredPassword.url).toBe(originalPassword.url);
                expect(restoredPassword.notes).toBe(originalPassword.notes);
                expect(restoredPassword.tags).toEqual(originalPassword.tags);
                expect(restoredPassword.history.length).toBe(originalPassword.history.length);
                
                // Verify password history
                for (let i = 0; i < originalPassword.history.length; i++) {
                  const restoredHistoryItem = restoredPassword.history[i];
                  const originalHistoryItem = originalPassword.history[i];
                  expect(restoredHistoryItem).toBeDefined();
                  expect(originalHistoryItem).toBeDefined();
                  expect(restoredHistoryItem?.password).toBe(originalHistoryItem?.password);
                  expect(restoredHistoryItem?.changedAt).toBe(originalHistoryItem?.changedAt);
                }
              } else if (originalItem.type === 'creditcard') {
                const originalCard = originalItem as CreditCardItem;
                const restoredCard = restoredItem as CreditCardItem;
                
                expect(restoredCard.cardNumber).toBe(originalCard.cardNumber);
                expect(restoredCard.holderName).toBe(originalCard.holderName);
                expect(restoredCard.expiryDate).toBe(originalCard.expiryDate);
                expect(restoredCard.cvv).toBe(originalCard.cvv);
                expect(restoredCard.notes).toBe(originalCard.notes);
                expect(restoredCard.tags).toEqual(originalCard.tags);
              } else if (originalItem.type === 'document') {
                const originalDoc = originalItem as DocumentItem;
                const restoredDoc = restoredItem as DocumentItem;
                
                expect(restoredDoc.content.type).toBe(originalDoc.content.type);
                expect(restoredDoc.content.mimeType).toBe(originalDoc.content.mimeType);
                expect(restoredDoc.content.size).toBe(originalDoc.content.size);
                expect(restoredDoc.content.data).toEqual(originalDoc.content.data);
                expect(restoredDoc.notes).toBe(originalDoc.notes);
                expect(restoredDoc.tags).toEqual(originalDoc.tags);
              }
            }
            
            // Property 13: Restored vault metadata must match original
            expect(restored.vault.metadata.version).toBe(vault.metadata.version);
            expect(restored.vault.metadata.createdAt).toBe(vault.metadata.createdAt);
            expect(restored.vault.metadata.updatedAt).toBe(vault.metadata.updatedAt);
            
            // Property 14: Restored backup metadata must match backup metadata
            expect(restored.metadata.version).toBe(backup.metadata.version);
            expect(restored.metadata.createdAt).toBe(backup.metadata.createdAt);
            expect(restored.metadata.appVersion).toBe(backup.metadata.appVersion);
            expect(restored.metadata.vaultId).toBe(backup.metadata.vaultId);
          }
        ),
        { numRuns: 10 }
      );
    });

    test('backup preserves empty vault correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length >= 5),
            version: fc.integer({ min: 1, max: 100 }),
            createdAt: fc.integer({ min: 1000000000000, max: Date.now() }),
            updatedAt: fc.integer({ min: 1000000000000, max: Date.now() }),
          }).chain(vaultData => {
            const createdAt = vaultData.createdAt;
            const updatedAt = Math.max(vaultData.updatedAt, createdAt);
            
            return fc.constant({
              id: vaultData.id,
              version: vaultData.version,
              createdAt,
              updatedAt,
              items: new Map(),
              metadata: {
                version: vaultData.version,
                createdAt,
                updatedAt,
              },
            } as Vault);
          }),
          async (emptyVault) => {
            // Create backup of empty vault
            const backup = await backupService.createBackup(emptyVault, masterKey);
            
            // Verify backup has metadata
            expect(backup.metadata).toBeDefined();
            expect(backup.metadata.version).toBeGreaterThan(0);
            expect(backup.metadata.createdAt).toBeGreaterThan(0);
            expect(backup.metadata.vaultId).toBe(emptyVault.id);
            
            // Restore and verify
            const restored = await backupService.restoreBackup(backup, masterKey);
            
            expect(restored.vault.id).toBe(emptyVault.id);
            expect(restored.vault.items.size).toBe(0);
            expect(restored.vault.version).toBe(emptyVault.version);
          }
        ),
        { numRuns: 10 }
      );
    });

    test('backup preserves vault with single item correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length >= 5),
            version: fc.integer({ min: 1, max: 100 }),
            createdAt: fc.integer({ min: 1000000000000, max: Date.now() }),
            updatedAt: fc.integer({ min: 1000000000000, max: Date.now() }),
            item: fc.record({
              id: fc.uuid(),
              type: fc.constant('password' as const),
              title: fc.string({ minLength: 4, maxLength: 50 }).filter(s => s.trim().length >= 4),
              username: fc.string({ minLength: 4, maxLength: 50 }).filter(s => s.trim().length >= 4),
              password: fc.string({ minLength: 8, maxLength: 50 }).filter(s => s.trim().length >= 8),
              url: fc.option(fc.webUrl(), { nil: undefined }),
              notes: fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
              tags: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 5 }),
              history: fc.constant([]),
              createdAt: fc.integer({ min: 1000000000000, max: Date.now() }),
              updatedAt: fc.integer({ min: 1000000000000, max: Date.now() }),
            }),
          }).chain(vaultData => {
            const createdAt = vaultData.createdAt;
            const updatedAt = Math.max(vaultData.updatedAt, createdAt);
            
            const itemsMap = new Map();
            itemsMap.set(vaultData.item.id, vaultData.item);
            
            return fc.constant({
              id: vaultData.id,
              version: vaultData.version,
              createdAt,
              updatedAt,
              items: itemsMap,
              metadata: {
                version: vaultData.version,
                createdAt,
                updatedAt,
              },
            } as Vault);
          }),
          async (vault) => {
            // Create backup
            const backup = await backupService.createBackup(vault, masterKey);
            
            // Restore and verify
            const restored = await backupService.restoreBackup(backup, masterKey);
            
            // Verify single item is preserved
            expect(restored.vault.items.size).toBe(1);
            
            const originalItem = Array.from(vault.items.values())[0] as PasswordItem;
            const restoredItem = Array.from(restored.vault.items.values())[0] as PasswordItem;
            
            expect(restoredItem.id).toBe(originalItem.id);
            expect(restoredItem.title).toBe(originalItem.title);
            expect(restoredItem.username).toBe(originalItem.username);
            expect(restoredItem.password).toBe(originalItem.password);
            expect(restoredItem.url).toBe(originalItem.url);
            expect(restoredItem.notes).toBe(originalItem.notes);
            expect(restoredItem.tags).toEqual(originalItem.tags);
          }
        ),
        { numRuns: 10 }
      );
    });

    test('backup preserves special characters and unicode correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.uuid(),
            version: fc.constant(1),
            createdAt: fc.constant(Date.now() - 1000),
            updatedAt: fc.constant(Date.now()),
            item: fc.record({
              id: fc.uuid(),
              type: fc.constant('password' as const),
              title: fc.string({ minLength: 4, maxLength: 50 }).filter(s => s.trim().length >= 4),
              username: fc.string({ minLength: 4, maxLength: 50 }).filter(s => s.trim().length >= 4),
              password: fc.string({ minLength: 8, maxLength: 50 }).filter(s => s.trim().length >= 8),
              notes: fc.option(
                fc.constantFrom(
                  'Test with emoji 🔒🔑',
                  'Test with\nnewlines\nand\ttabs',
                  'Test with special chars: !@#$%^&*()',
                  'Test with unicode: 你好世界',
                  'Test with quotes: "double" and \'single\''
                ),
                { nil: undefined }
              ),
              tags: fc.constant([]),
              history: fc.constant([]),
              createdAt: fc.constant(Date.now() - 1000),
              updatedAt: fc.constant(Date.now()),
            }),
          }).chain(vaultData => {
            const itemsMap = new Map();
            itemsMap.set(vaultData.item.id, vaultData.item);
            
            return fc.constant({
              id: vaultData.id,
              version: vaultData.version,
              createdAt: vaultData.createdAt,
              updatedAt: vaultData.updatedAt,
              items: itemsMap,
              metadata: {
                version: vaultData.version,
                createdAt: vaultData.createdAt,
                updatedAt: vaultData.updatedAt,
              },
            } as Vault);
          }),
          async (vault) => {
            // Create backup
            const backup = await backupService.createBackup(vault, masterKey);
            
            // Restore and verify
            const restored = await backupService.restoreBackup(backup, masterKey);
            
            const originalItem = Array.from(vault.items.values())[0] as PasswordItem;
            const restoredItem = Array.from(restored.vault.items.values())[0] as PasswordItem;
            
            // Special characters and unicode should be preserved exactly
            expect(restoredItem.notes).toBe(originalItem.notes);
          }
        ),
        { numRuns: 10 }
      );
    });

    test('backup file export and import preserves all data', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.uuid(),
            version: fc.integer({ min: 1, max: 10 }),
            createdAt: fc.integer({ min: 1000000000000, max: Date.now() }),
            updatedAt: fc.integer({ min: 1000000000000, max: Date.now() }),
            items: fc.array(
              fc.record({
                id: fc.uuid(),
                type: fc.constant('password' as const),
                title: fc.string({ minLength: 4, maxLength: 30 }).filter(s => s.trim().length >= 4),
                username: fc.string({ minLength: 4, maxLength: 30 }).filter(s => s.trim().length >= 4),
                password: fc.string({ minLength: 8, maxLength: 30 }).filter(s => s.trim().length >= 8),
                tags: fc.constant([]),
                history: fc.constant([]),
                createdAt: fc.integer({ min: 1000000000000, max: Date.now() }),
                updatedAt: fc.integer({ min: 1000000000000, max: Date.now() }),
              }),
              { minLength: 1, maxLength: 3 }
            ),
          }).chain(vaultData => {
            const createdAt = vaultData.createdAt;
            const updatedAt = Math.max(vaultData.updatedAt, createdAt);
            
            const itemsMap = new Map();
            for (const item of vaultData.items) {
              itemsMap.set(item.id, item);
            }
            
            return fc.constant({
              id: vaultData.id,
              version: vaultData.version,
              createdAt,
              updatedAt,
              items: itemsMap,
              metadata: {
                version: vaultData.version,
                createdAt,
                updatedAt,
              },
            } as Vault);
          }),
          async (vault) => {
            // Create backup
            const backup = await backupService.createBackup(vault, masterKey);
            
            // Export to file
            const fileContent = backupService.exportBackupToFile(backup);
            
            // Import from file
            const importedBackup = backupService.importBackupFromFile(fileContent);
            
            // Restore from imported backup
            const restored = await backupService.restoreBackup(importedBackup, masterKey);
            
            // Verify all data is preserved through export/import cycle
            expect(restored.vault.id).toBe(vault.id);
            expect(restored.vault.items.size).toBe(vault.items.size);
            
            for (const [itemId, originalItem] of vault.items) {
              const restoredItem = restored.vault.items.get(itemId) as PasswordItem;
              const original = originalItem as PasswordItem;
              
              expect(restoredItem).toBeDefined();
              expect(restoredItem.title).toBe(original.title);
              expect(restoredItem.username).toBe(original.username);
              expect(restoredItem.password).toBe(original.password);
            }
          }
        ),
        { numRuns: 10 }
      );
    });
  });
});
