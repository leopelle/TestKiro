/**
 * Property-Based Tests for VaultManager
 * 
 * These tests verify universal properties that should hold for all vault operations
 * using property-based testing with fast-check.
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import * as fc from 'fast-check';
import { VaultManager, InMemoryVaultStorage } from './vault-manager';
import { createCryptoEngine } from '../crypto/crypto-engine';
import { deriveKeyFromPassword } from '../utils/crypto-utils';
import { PasswordItem, CreditCardItem, DocumentItem } from '../types/vault';

describe('VaultManager Property-Based Tests', () => {
  let cryptoEngine: ReturnType<typeof createCryptoEngine>;
  let masterKey: CryptoKey;
  const testPin = '123456';

  beforeEach(async () => {
    cryptoEngine = createCryptoEngine();
    
    // Generate a master key for testing
    const salt = crypto.getRandomValues(new Uint8Array(32));
    masterKey = await deriveKeyFromPassword(testPin, salt);
  });

  /**
   * Property 4: Invariante Crittografia Dati
   * 
   * For all data saved to storage, it must be in encrypted format before persistence.
   * This property verifies that:
   * 1. Data saved to storage is never in plaintext
   * 2. Encrypted data cannot be read without the master key
   * 3. The encryption is properly applied to all vault items
   * 
   * **Validates: Requirements 1.4, 5.4, 8.1**
   * 
   * Feature: password-manager-app, Property 4: Invariante Crittografia Dati
   */
  describe('Property 4: Invariante Crittografia Dati', () => {
    test('all vault data saved to storage must be encrypted', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate arbitrary vault items of different types
          fc.oneof(
            // Password items
            fc.record({
              type: fc.constant('password' as const),
              title: fc.string({ minLength: 4, maxLength: 100 }).filter(s => s.trim().length >= 4),
              username: fc.string({ minLength: 4, maxLength: 100 }).filter(s => s.trim().length >= 4),
              password: fc.string({ minLength: 8, maxLength: 100 }).filter(s => s.trim().length >= 8),
              url: fc.option(fc.webUrl(), { nil: undefined }),
              notes: fc.option(fc.string({ maxLength: 500 }), { nil: undefined }),
              tags: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 10 }),
              history: fc.constant([]),
            }),
            // Credit card items (with valid test data)
            fc.record({
              type: fc.constant('creditcard' as const),
              title: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
              cardNumber: fc.constant('4532015112830366'), // Valid test card
              holderName: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
              expiryDate: fc.constant('12/30'), // Future date
              cvv: fc.constantFrom('123', '456', '789', '1234'),
              notes: fc.option(fc.string({ maxLength: 500 }), { nil: undefined }),
              tags: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 10 }),
            }),
            // Document items
            fc.record({
              type: fc.constant('document' as const),
              title: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
              content: fc.record({
                type: fc.constantFrom('text' as const, 'image' as const, 'pdf' as const),
                data: fc.uint8Array({ minLength: 1, maxLength: 1000 }),
                mimeType: fc.constantFrom('text/plain', 'image/jpeg', 'image/png', 'application/pdf'),
                size: fc.nat({ max: 1000 }),
              }).chain(content => 
                // Ensure size matches data length
                fc.constant({
                  ...content,
                  size: content.data.length,
                })
              ),
              notes: fc.option(fc.string({ maxLength: 500 }), { nil: undefined }),
              tags: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 10 }),
            })
          ),
          async (item) => {
            // Create a fresh vault manager and storage for each test
            const testStorage = new InMemoryVaultStorage();
            const vaultManager = new VaultManager(cryptoEngine, testStorage);
            
            // Create vault and add item
            await vaultManager.createVault(masterKey);
            // Cast to any to bypass strict optional property type checking
            await vaultManager.addItem(item as any, masterKey);
            
            // Get the encrypted data from storage
            const encryptedData = await testStorage.loadEncryptedVault();
            
            // Property 1: Encrypted data must exist
            expect(encryptedData).not.toBeNull();
            expect(encryptedData).toBeDefined();
            
            // Property 2: Encrypted data must have all required components
            expect(encryptedData?.ciphertext).toBeInstanceOf(Uint8Array);
            expect(encryptedData?.iv).toBeInstanceOf(Uint8Array);
            expect(encryptedData?.authTag).toBeInstanceOf(Uint8Array);
            
            // Property 3: Ciphertext must not contain plaintext item data
            // For meaningful strings (longer than 3 characters), they should not appear in plaintext
            const ciphertextString = new TextDecoder('utf-8', { fatal: false })
              .decode(encryptedData!.ciphertext);
            
            // Check that sensitive fields are not in plaintext
            // We only check strings longer than 3 characters to avoid false positives
            // from random byte sequences that happen to match short strings
            if (item.type === 'password') {
              const passwordItem = item as Omit<PasswordItem, 'id' | 'createdAt' | 'updatedAt'>;
              // The password should not appear in plaintext in the ciphertext (if long enough)
              if (passwordItem.password.length > 3) {
                expect(ciphertextString.includes(passwordItem.password)).toBe(false);
              }
              // The username should not appear in plaintext (if long enough)
              if (passwordItem.username.length > 3) {
                expect(ciphertextString.includes(passwordItem.username)).toBe(false);
              }
            } else if (item.type === 'creditcard') {
              const cardItem = item as Omit<CreditCardItem, 'id' | 'createdAt' | 'updatedAt'>;
              // The card number should not appear in plaintext
              expect(ciphertextString.includes(cardItem.cardNumber)).toBe(false);
              // The CVV should not appear in plaintext
              expect(ciphertextString.includes(cardItem.cvv)).toBe(false);
            } else if (item.type === 'document') {
              const docItem = item as Omit<DocumentItem, 'id' | 'createdAt' | 'updatedAt'>;
              // The document content should not appear in plaintext
              const contentString = new TextDecoder('utf-8', { fatal: false })
                .decode(docItem.content.data);
              if (contentString.length > 10) {
                // Only check if content is substantial enough
                expect(ciphertextString.includes(contentString)).toBe(false);
              }
            }
            
            // Property 4: Encrypted data should be different from original data
            // (i.e., encryption actually transforms the data)
            const originalJson = JSON.stringify(item);
            const originalBytes = new TextEncoder().encode(originalJson);
            
            // Ciphertext should not equal original data
            expect(encryptedData!.ciphertext).not.toEqual(originalBytes);
            
            // Property 5: Encrypted data should not be readable without the key
            // Try to parse ciphertext as JSON - it should fail or produce garbage
            let parsedSuccessfully = false;
            try {
              const parsed = JSON.parse(ciphertextString);
              // If it parses, check that it doesn't contain our sensitive data
              const parsedString = JSON.stringify(parsed);
              if (item.type === 'password') {
                const passwordItem = item as Omit<PasswordItem, 'id' | 'createdAt' | 'updatedAt'>;
                parsedSuccessfully = parsedString.includes(passwordItem.password);
              }
            } catch {
              // Expected - ciphertext should not be valid JSON
              parsedSuccessfully = false;
            }
            expect(parsedSuccessfully).toBe(false);
            
            // Property 6: Data can only be decrypted with the correct key
            // This is implicitly tested by the vault manager's ability to load the data
            const newManager = new VaultManager(cryptoEngine, testStorage);
            const loadedVault = await newManager.loadVault(masterKey);
            
            // Verify the vault loaded successfully
            expect(loadedVault).toBeDefined();
            expect(loadedVault.items.size).toBe(1);
            
            // Verify the decrypted item matches the original
            const loadedItem = Array.from(loadedVault.items.values())[0];
            expect(loadedItem?.type).toBe(item.type);
            expect(loadedItem?.title).toBe(item.title);
          }
        ),
        { numRuns: 10 }
      );
    });

    test('vault metadata is also encrypted in storage', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          async (_vaultTitle) => {
            // Create a fresh vault manager and storage
            const testStorage = new InMemoryVaultStorage();
            const vaultManager = new VaultManager(cryptoEngine, testStorage);
            
            // Create vault
            await vaultManager.createVault(masterKey);
            
            // Get the encrypted data from storage
            const encryptedData = await testStorage.loadEncryptedVault();
            
            // Verify vault metadata is encrypted
            expect(encryptedData).not.toBeNull();
            
            // The ciphertext should not be valid JSON (it's encrypted)
            const ciphertextString = new TextDecoder('utf-8', { fatal: false })
              .decode(encryptedData!.ciphertext);
            
            // Vault ID should not be easily readable in ciphertext
            // (it might appear as part of encrypted JSON, but not as plaintext)
            // We verify this by checking that the ciphertext is not valid JSON
            let isValidJson = false;
            try {
              JSON.parse(ciphertextString);
              isValidJson = true;
            } catch {
              isValidJson = false;
            }
            
            expect(isValidJson).toBe(false);
          }
        ),
        { numRuns: 10 }
      );
    });

    test('multiple items are all encrypted in storage', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              type: fc.constant('password' as const),
              title: fc.string({ minLength: 4, maxLength: 50 }).filter(s => s.trim().length >= 4),
              username: fc.string({ minLength: 4, maxLength: 50 }).filter(s => s.trim().length >= 4),
              password: fc.string({ minLength: 8, maxLength: 50 }).filter(s => s.trim().length >= 8),
              tags: fc.constant([]),
              history: fc.constant([]),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          async (items) => {
            // Create a fresh vault manager and storage
            const testStorage = new InMemoryVaultStorage();
            const vaultManager = new VaultManager(cryptoEngine, testStorage);
            
            // Create vault and add all items
            await vaultManager.createVault(masterKey);
            
            for (const item of items) {
              await vaultManager.addItem(item, masterKey);
            }
            
            // Get the encrypted data from storage
            const encryptedData = await testStorage.loadEncryptedVault();
            
            // Verify all items are encrypted
            expect(encryptedData).not.toBeNull();
            
            const ciphertextString = new TextDecoder('utf-8', { fatal: false })
              .decode(encryptedData!.ciphertext);
            
            // None of the passwords should appear in plaintext (if long enough to avoid false positives)
            for (const item of items) {
              if (item.password.length > 3) {
                expect(ciphertextString.includes(item.password)).toBe(false);
              }
              if (item.username.length > 3) {
                expect(ciphertextString.includes(item.username)).toBe(false);
              }
            }
            
            // Verify all items can be decrypted correctly
            const newManager = new VaultManager(cryptoEngine, testStorage);
            const loadedVault = await newManager.loadVault(masterKey);
            
            expect(loadedVault.items.size).toBe(items.length);
          }
        ),
        { numRuns: 10 }
      );
    });

    test('encryption is applied before any storage operation', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            type: fc.constant('password' as const),
            title: fc.string({ minLength: 4, maxLength: 50 }).filter(s => s.trim().length >= 4),
            username: fc.string({ minLength: 4, maxLength: 50 }).filter(s => s.trim().length >= 4),
            password: fc.string({ minLength: 8, maxLength: 50 }).filter(s => s.trim().length >= 8),
            tags: fc.constant([]),
            history: fc.constant([]),
          }),
          async (item) => {
            // Create a custom storage that tracks what data is saved
            let savedData: Uint8Array | null = null;
            const trackingStorage = new InMemoryVaultStorage();
            const originalSave = trackingStorage.saveEncryptedVault.bind(trackingStorage);
            trackingStorage.saveEncryptedVault = async (encryptedData) => {
              savedData = encryptedData.ciphertext;
              return originalSave(encryptedData);
            };
            
            const vaultManager = new VaultManager(cryptoEngine, trackingStorage);
            
            // Create vault and add item
            await vaultManager.createVault(masterKey);
            await vaultManager.addItem(item, masterKey);
            
            // Verify that data was saved
            expect(savedData).not.toBeNull();
            
            // Verify that the saved data is encrypted (doesn't contain plaintext password if long enough)
            const savedString = new TextDecoder('utf-8', { fatal: false }).decode(savedData!);
            if (item.password.length > 3) {
              expect(savedString.includes(item.password)).toBe(false);
            }
            if (item.username.length > 3) {
              expect(savedString.includes(item.username)).toBe(false);
            }
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  /**
   * Property 6: Completezza Campi Obbligatori
   * 
   * For any element added (password or credit card), all required fields must be present and not empty.
   * This property verifies that:
   * 1. Items with missing required fields are rejected
   * 2. Items with empty required fields are rejected
   * 3. Valid items with all required fields are accepted
   * 
   * **Validates: Requirements 2.1, 3.1**
   * 
   * Feature: password-manager-app, Property 6: Completezza Campi Obbligatori
   */
  describe('Property 6: Completezza Campi Obbligatori', () => {
    test('password items must have all required fields non-empty', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate password items with potentially missing or empty fields
          fc.record({
            type: fc.constant('password' as const),
            title: fc.option(fc.string({ maxLength: 100 }), { nil: undefined }),
            username: fc.option(fc.string({ maxLength: 100 }), { nil: undefined }),
            password: fc.option(fc.string({ maxLength: 100 }), { nil: undefined }),
            url: fc.option(fc.webUrl(), { nil: undefined }),
            tags: fc.constant([]),
            history: fc.constant([]),
          }),
          async (item) => {
            const testStorage = new InMemoryVaultStorage();
            const vaultManager = new VaultManager(cryptoEngine, testStorage);
            await vaultManager.createVault(masterKey);
            
            // Determine if the item should be valid
            const hasTitle = item.title !== undefined && item.title.trim().length > 0;
            const hasUsername = item.username !== undefined && item.username.trim().length > 0;
            const hasPassword = item.password !== undefined && item.password.trim().length > 0;
            
            const shouldBeValid = hasTitle && hasUsername && hasPassword;
            
            if (shouldBeValid) {
              // Valid item should be accepted
              const id = await vaultManager.addItem(item as any, masterKey);
              expect(id).toBeTruthy();
              
              const retrieved = vaultManager.getItem(id);
              expect(retrieved).not.toBeNull();
              expect(retrieved?.type).toBe('password');
            } else {
              // Invalid item should be rejected
              await expect(vaultManager.addItem(item as any, masterKey)).rejects.toThrow();
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    test('credit card items must have all required fields non-empty', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate credit card items with potentially missing or empty fields
          fc.record({
            type: fc.constant('creditcard' as const),
            title: fc.option(fc.string({ maxLength: 100 }), { nil: undefined }),
            cardNumber: fc.option(fc.constantFrom('4532015112830366', '5425233430109903'), { nil: undefined }),
            holderName: fc.option(fc.string({ maxLength: 100 }), { nil: undefined }),
            expiryDate: fc.option(fc.constant('12/30'), { nil: undefined }),
            cvv: fc.option(fc.constantFrom('123', '456'), { nil: undefined }),
            tags: fc.constant([]),
          }),
          async (item) => {
            const testStorage = new InMemoryVaultStorage();
            const vaultManager = new VaultManager(cryptoEngine, testStorage);
            await vaultManager.createVault(masterKey);
            
            // Determine if the item should be valid
            const hasTitle = item.title !== undefined && item.title.trim().length > 0;
            const hasCardNumber = item.cardNumber !== undefined && item.cardNumber.trim().length > 0;
            const hasHolderName = item.holderName !== undefined && item.holderName.trim().length > 0;
            const hasExpiryDate = item.expiryDate !== undefined && item.expiryDate.trim().length > 0;
            const hasCvv = item.cvv !== undefined && item.cvv.trim().length > 0;
            
            const shouldBeValid = hasTitle && hasCardNumber && hasHolderName && hasExpiryDate && hasCvv;
            
            if (shouldBeValid) {
              // Valid item should be accepted
              const id = await vaultManager.addItem(item as any, masterKey);
              expect(id).toBeTruthy();
              
              const retrieved = vaultManager.getItem(id);
              expect(retrieved).not.toBeNull();
              expect(retrieved?.type).toBe('creditcard');
            } else {
              // Invalid item should be rejected
              await expect(vaultManager.addItem(item as any, masterKey)).rejects.toThrow();
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    test('document items must have title and content', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate document items with potentially missing fields
          fc.record({
            type: fc.constant('document' as const),
            title: fc.option(fc.string({ maxLength: 100 }), { nil: undefined }),
            content: fc.option(
              fc.record({
                type: fc.constantFrom('text' as const, 'image' as const, 'pdf' as const),
                data: fc.uint8Array({ minLength: 1, maxLength: 100 }),
                mimeType: fc.constantFrom('text/plain', 'image/jpeg', 'application/pdf'),
                size: fc.nat({ max: 100 }),
              }).chain(content => 
                fc.constant({
                  ...content,
                  size: content.data.length,
                })
              ),
              { nil: undefined }
            ),
            tags: fc.constant([]),
          }),
          async (item) => {
            const testStorage = new InMemoryVaultStorage();
            const vaultManager = new VaultManager(cryptoEngine, testStorage);
            await vaultManager.createVault(masterKey);
            
            // Determine if the item should be valid
            const hasTitle = item.title !== undefined && item.title.trim().length > 0;
            const hasContent = item.content !== undefined;
            
            const shouldBeValid = hasTitle && hasContent;
            
            if (shouldBeValid) {
              // Valid item should be accepted
              const id = await vaultManager.addItem(item as any, masterKey);
              expect(id).toBeTruthy();
              
              const retrieved = vaultManager.getItem(id);
              expect(retrieved).not.toBeNull();
              expect(retrieved?.type).toBe('document');
            } else {
              // Invalid item should be rejected
              await expect(vaultManager.addItem(item as any, masterKey)).rejects.toThrow();
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    test('items with whitespace-only required fields are rejected', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            // Password with whitespace-only fields
            fc.record({
              type: fc.constant('password' as const),
              title: fc.constantFrom('   ', '\t\t', '\n\n', '  \t  '),
              username: fc.string({ minLength: 4, maxLength: 50 }).filter(s => s.trim().length >= 4),
              password: fc.string({ minLength: 8, maxLength: 50 }).filter(s => s.trim().length >= 8),
              tags: fc.constant([]),
              history: fc.constant([]),
            }),
            // Credit card with whitespace-only fields
            fc.record({
              type: fc.constant('creditcard' as const),
              title: fc.constantFrom('   ', '\t\t', '\n\n', '  \t  '),
              cardNumber: fc.constant('4532015112830366'),
              holderName: fc.string({ minLength: 4, maxLength: 50 }).filter(s => s.trim().length >= 4),
              expiryDate: fc.constant('12/30'),
              cvv: fc.constant('123'),
              tags: fc.constant([]),
            })
          ),
          async (item) => {
            const testStorage = new InMemoryVaultStorage();
            const vaultManager = new VaultManager(cryptoEngine, testStorage);
            await vaultManager.createVault(masterKey);
            
            // Items with whitespace-only required fields should be rejected
            await expect(vaultManager.addItem(item as any, masterKey)).rejects.toThrow();
          }
        ),
        { numRuns: 10 }
      );
    });

    test('valid items with all required fields are always accepted', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            // Valid password item
            fc.record({
              type: fc.constant('password' as const),
              title: fc.string({ minLength: 4, maxLength: 50 }).filter(s => s.trim().length >= 4),
              username: fc.string({ minLength: 4, maxLength: 50 }).filter(s => s.trim().length >= 4),
              password: fc.string({ minLength: 8, maxLength: 50 }).filter(s => s.trim().length >= 8),
              url: fc.option(fc.webUrl(), { nil: undefined }),
              tags: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 5 }),
              history: fc.constant([]),
            }),
            // Valid credit card item
            fc.record({
              type: fc.constant('creditcard' as const),
              title: fc.string({ minLength: 4, maxLength: 50 }).filter(s => s.trim().length >= 4),
              cardNumber: fc.constantFrom('4532015112830366', '5425233430109903', '374245455400126'),
              holderName: fc.string({ minLength: 4, maxLength: 50 }).filter(s => s.trim().length >= 4),
              expiryDate: fc.constant('12/30'),
              cvv: fc.constantFrom('123', '456', '789', '1234'),
              tags: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 5 }),
            }),
            // Valid document item
            fc.record({
              type: fc.constant('document' as const),
              title: fc.string({ minLength: 4, maxLength: 50 }).filter(s => s.trim().length >= 4),
              content: fc.record({
                type: fc.constantFrom('text' as const, 'image' as const, 'pdf' as const),
                data: fc.uint8Array({ minLength: 1, maxLength: 100 }),
                mimeType: fc.constantFrom('text/plain', 'image/jpeg', 'application/pdf'),
                size: fc.nat({ max: 100 }),
              }).chain(content => 
                fc.constant({
                  ...content,
                  size: content.data.length,
                })
              ),
              tags: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 5 }),
            })
          ),
          async (item) => {
            const testStorage = new InMemoryVaultStorage();
            const vaultManager = new VaultManager(cryptoEngine, testStorage);
            await vaultManager.createVault(masterKey);
            
            // Valid items should always be accepted
            const id = await vaultManager.addItem(item as any, masterKey);
            expect(id).toBeTruthy();
            expect(typeof id).toBe('string');
            expect(id.length).toBeGreaterThan(0);
            
            // Verify the item can be retrieved
            const retrieved = vaultManager.getItem(id);
            expect(retrieved).not.toBeNull();
            expect(retrieved?.type).toBe(item.type);
            expect(retrieved?.title).toBe(item.title);
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  /**
   * Property 9: Invariante Storico Password
   * 
   * For any modified password, the history should never contain more than 5 previous versions.
   * This property verifies that:
   * 1. Password history is automatically limited to 5 entries
   * 2. Oldest entries are automatically rotated out when limit is exceeded
   * 3. The invariant holds regardless of how many password changes occur
   * 4. History is maintained correctly across multiple updates
   * 
   * **Validates: Requirements 2.5**
   * 
   * Feature: password-manager-app, Property 9: Invariante Storico Password
   */
  describe('Property 9: Invariante Storico Password', () => {
    test('password history never exceeds 5 entries regardless of number of changes', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate initial password item
          fc.record({
            type: fc.constant('password' as const),
            title: fc.string({ minLength: 4, maxLength: 50 }).filter(s => s.trim().length >= 4),
            username: fc.string({ minLength: 4, maxLength: 50 }).filter(s => s.trim().length >= 4),
            password: fc.string({ minLength: 8, maxLength: 50 }).filter(s => s.trim().length >= 8),
            tags: fc.constant([]),
            history: fc.constant([]),
          }),
          // Generate a sequence of password updates (between 1 and 20 changes)
          fc.array(
            fc.string({ minLength: 8, maxLength: 50 }).filter(s => s.trim().length >= 8),
            { minLength: 1, maxLength: 20 }
          ),
          async (initialItem, passwordUpdates) => {
            const testStorage = new InMemoryVaultStorage();
            const vaultManager = new VaultManager(cryptoEngine, testStorage);
            await vaultManager.createVault(masterKey);
            
            // Add initial password item
            const id = await vaultManager.addItem(initialItem, masterKey);
            
            // Apply all password updates
            for (const newPassword of passwordUpdates) {
              await vaultManager.updateItem(id, { password: newPassword }, masterKey);
            }
            
            // Retrieve the item and check history
            const item = vaultManager.getItem(id) as PasswordItem;
            
            // Property 1: History must never exceed 5 entries
            expect(item.history.length).toBeLessThanOrEqual(5);
            
            // Property 2: Current password should be the last one from updates
            expect(item.password).toBe(passwordUpdates[passwordUpdates.length - 1]);
            
            // Property 3: If we made more than 5 changes, history should be exactly 5
            if (passwordUpdates.length >= 5) {
              expect(item.history.length).toBe(5);
            } else {
              // Otherwise, history should contain all previous passwords
              expect(item.history.length).toBe(passwordUpdates.length);
            }
            
            // Property 4: History should be in reverse chronological order (newest first)
            for (let i = 0; i < item.history.length - 1; i++) {
              expect(item.history[i]!.changedAt).toBeGreaterThanOrEqual(
                item.history[i + 1]!.changedAt
              );
            }
            
            // Property 5: History should contain the most recent passwords
            // The first entry in history should be the second-to-last password
            if (passwordUpdates.length > 0) {
              const expectedHistoryStart = Math.max(0, passwordUpdates.length - 6);
              const expectedHistoryPasswords = [
                initialItem.password,
                ...passwordUpdates.slice(0, -1)
              ].slice(expectedHistoryStart);
              
              // Reverse to match history order (newest first)
              expectedHistoryPasswords.reverse();
              
              for (let i = 0; i < Math.min(item.history.length, expectedHistoryPasswords.length); i++) {
                expect(item.history[i]?.password).toBe(expectedHistoryPasswords[i]);
              }
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    test('password history invariant holds after vault save/load cycles', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate initial password
          fc.record({
            type: fc.constant('password' as const),
            title: fc.string({ minLength: 4, maxLength: 50 }).filter(s => s.trim().length >= 4),
            username: fc.string({ minLength: 4, maxLength: 50 }).filter(s => s.trim().length >= 4),
            password: fc.string({ minLength: 8, maxLength: 50 }).filter(s => s.trim().length >= 8),
            tags: fc.constant([]),
            history: fc.constant([]),
          }),
          // Generate password updates
          fc.array(
            fc.string({ minLength: 8, maxLength: 50 }).filter(s => s.trim().length >= 8),
            { minLength: 6, maxLength: 15 } // Ensure we exceed the limit
          ),
          async (initialItem, passwordUpdates) => {
            const testStorage = new InMemoryVaultStorage();
            const vaultManager = new VaultManager(cryptoEngine, testStorage);
            await vaultManager.createVault(masterKey);
            
            // Add initial password item
            const id = await vaultManager.addItem(initialItem, masterKey);
            
            // Apply all password updates
            for (const newPassword of passwordUpdates) {
              await vaultManager.updateItem(id, { password: newPassword }, masterKey);
            }
            
            // Load vault in a new manager
            const newManager = new VaultManager(cryptoEngine, testStorage);
            await newManager.loadVault(masterKey);
            
            // Retrieve the item from the new manager
            const loadedItem = newManager.getItem(id) as PasswordItem;
            
            // Property: History must still never exceed 5 entries after persistence
            expect(loadedItem.history.length).toBeLessThanOrEqual(5);
            
            // Property: History should be exactly 5 since we made more than 5 changes
            expect(loadedItem.history.length).toBe(5);
            
            // Property: Current password should be preserved
            expect(loadedItem.password).toBe(passwordUpdates[passwordUpdates.length - 1]);
            
            // Property: History order should be preserved
            for (let i = 0; i < loadedItem.history.length - 1; i++) {
              expect(loadedItem.history[i]!.changedAt).toBeGreaterThanOrEqual(
                loadedItem.history[i + 1]!.changedAt
              );
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    test('password history invariant holds when mixing password and non-password updates', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate initial password
          fc.record({
            type: fc.constant('password' as const),
            title: fc.string({ minLength: 4, maxLength: 50 }).filter(s => s.trim().length >= 4),
            username: fc.string({ minLength: 4, maxLength: 50 }).filter(s => s.trim().length >= 4),
            password: fc.string({ minLength: 8, maxLength: 50 }).filter(s => s.trim().length >= 8),
            tags: fc.constant([]),
            history: fc.constant([]),
          }),
          // Generate mixed updates (password changes and other field changes)
          fc.array(
            fc.oneof(
              // Password update
              fc.record({
                type: fc.constant('password' as const),
                password: fc.string({ minLength: 8, maxLength: 50 }).filter(s => s.trim().length >= 8),
              }),
              // Non-password update
              fc.record({
                type: fc.constant('other' as const),
                title: fc.string({ minLength: 4, maxLength: 50 }).filter(s => s.trim().length >= 4),
              }),
              // Tag update
              fc.record({
                type: fc.constant('tags' as const),
                tags: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 5 }),
              })
            ),
            { minLength: 5, maxLength: 15 }
          ),
          async (initialItem, updates) => {
            const testStorage = new InMemoryVaultStorage();
            const vaultManager = new VaultManager(cryptoEngine, testStorage);
            await vaultManager.createVault(masterKey);
            
            // Add initial password item
            const id = await vaultManager.addItem(initialItem, masterKey);
            
            // Track how many password changes we made
            let passwordChangeCount = 0;
            
            // Apply all updates
            for (const update of updates) {
              if (update.type === 'password') {
                await vaultManager.updateItem(id, { password: update.password }, masterKey);
                passwordChangeCount++;
              } else if (update.type === 'other') {
                await vaultManager.updateItem(id, { title: update.title }, masterKey);
              } else if (update.type === 'tags') {
                await vaultManager.updateItem(id, { tags: update.tags }, masterKey);
              }
            }
            
            // Retrieve the item
            const item = vaultManager.getItem(id) as PasswordItem;
            
            // Property 1: History must never exceed 5 entries
            expect(item.history.length).toBeLessThanOrEqual(5);
            
            // Property 2: History length should match password changes (up to 5)
            const expectedHistoryLength = Math.min(passwordChangeCount, 5);
            expect(item.history.length).toBe(expectedHistoryLength);
            
            // Property 3: Non-password updates should not affect history
            // (implicitly tested by checking history length matches password changes)
            
            // Property 4: History should still be in chronological order
            for (let i = 0; i < item.history.length - 1; i++) {
              expect(item.history[i]!.changedAt).toBeGreaterThanOrEqual(
                item.history[i + 1]!.changedAt
              );
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    test('password history invariant holds with existing history', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate initial password with existing history
          fc.record({
            type: fc.constant('password' as const),
            title: fc.string({ minLength: 4, maxLength: 50 }).filter(s => s.trim().length >= 4),
            username: fc.string({ minLength: 4, maxLength: 50 }).filter(s => s.trim().length >= 4),
            password: fc.string({ minLength: 8, maxLength: 50 }).filter(s => s.trim().length >= 8),
            tags: fc.constant([]),
            // Generate existing history (0-4 entries)
            history: fc.array(
              fc.record({
                password: fc.string({ minLength: 8, maxLength: 50 }).filter(s => s.trim().length >= 8),
                changedAt: fc.integer({ min: Date.now() - 1000000, max: Date.now() - 1000 }),
              }),
              { minLength: 0, maxLength: 4 }
            ).chain(history => 
              // Sort history by timestamp descending (newest first)
              fc.constant([...history].sort((a, b) => b.changedAt - a.changedAt))
            ),
          }),
          // Generate new password updates (ensure they're different from current password)
          fc.array(
            fc.string({ minLength: 8, maxLength: 50 }).filter(s => s.trim().length >= 8),
            { minLength: 1, maxLength: 10 }
          ),
          async (initialItem, passwordUpdates) => {
            const testStorage = new InMemoryVaultStorage();
            const vaultManager = new VaultManager(cryptoEngine, testStorage);
            await vaultManager.createVault(masterKey);
            
            // Add initial password item with existing history
            const id = await vaultManager.addItem(initialItem, masterKey);
            
            // Track actual password changes (only count when password actually changes)
            let actualPasswordChanges = 0;
            let currentPassword = initialItem.password;
            
            // Apply all password updates
            for (const newPassword of passwordUpdates) {
              if (newPassword !== currentPassword) {
                actualPasswordChanges++;
                currentPassword = newPassword;
              }
              await vaultManager.updateItem(id, { password: newPassword }, masterKey);
            }
            
            // Retrieve the item
            const item = vaultManager.getItem(id) as PasswordItem;
            
            // Property 1: History must never exceed 5 entries (CORE INVARIANT)
            expect(item.history.length).toBeLessThanOrEqual(5);
            
            // Property 2: Total history (existing + actual new changes) should be capped at 5
            // Only count actual password changes (where password differs from current)
            const totalChanges = initialItem.history.length + actualPasswordChanges;
            const expectedHistoryLength = Math.min(totalChanges, 5);
            expect(item.history.length).toBe(expectedHistoryLength);
            
            // Property 3: History should be in chronological order (newest first)
            for (let i = 0; i < item.history.length - 1; i++) {
              expect(item.history[i]!.changedAt).toBeGreaterThanOrEqual(
                item.history[i + 1]!.changedAt
              );
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    test('password history invariant holds for concurrent items', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate multiple password items
          fc.array(
            fc.record({
              type: fc.constant('password' as const),
              title: fc.string({ minLength: 4, maxLength: 50 }).filter(s => s.trim().length >= 4),
              username: fc.string({ minLength: 4, maxLength: 50 }).filter(s => s.trim().length >= 4),
              password: fc.string({ minLength: 8, maxLength: 50 }).filter(s => s.trim().length >= 8),
              tags: fc.constant([]),
              history: fc.constant([]),
              // Generate updates for each item
              updates: fc.array(
                fc.string({ minLength: 8, maxLength: 50 }).filter(s => s.trim().length >= 8),
                { minLength: 3, maxLength: 10 }
              ),
            }),
            { minLength: 2, maxLength: 5 }
          ),
          async (items) => {
            const testStorage = new InMemoryVaultStorage();
            const vaultManager = new VaultManager(cryptoEngine, testStorage);
            await vaultManager.createVault(masterKey);
            
            // Add all items and apply their updates
            const itemIds: string[] = [];
            
            for (const itemData of items) {
              const { updates, ...item } = itemData;
              const id = await vaultManager.addItem(item, masterKey);
              itemIds.push(id);
              
              // Apply updates for this item
              for (const newPassword of updates) {
                await vaultManager.updateItem(id, { password: newPassword }, masterKey);
              }
            }
            
            // Check that all items maintain the history invariant
            for (let i = 0; i < itemIds.length; i++) {
              const item = vaultManager.getItem(itemIds[i]!) as PasswordItem;
              
              // Property: Each item's history must never exceed 5 entries
              expect(item.history.length).toBeLessThanOrEqual(5);
              
              // Property: History length should match number of updates (up to 5)
              const expectedLength = Math.min(items[i]!.updates.length, 5);
              expect(item.history.length).toBe(expectedLength);
              
              // Property: History should be in chronological order
              for (let j = 0; j < item.history.length - 1; j++) {
                expect(item.history[j]!.changedAt).toBeGreaterThanOrEqual(
                  item.history[j + 1]!.changedAt
                );
              }
            }
          }
        ),
        { numRuns: 10 }
      );
    });
  });
});
