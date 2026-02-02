/**
 * VaultManager Tests
 * 
 * Tests for vault CRUD operations and encrypted storage
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { VaultManager, InMemoryVaultStorage } from './vault-manager';
import { createCryptoEngine } from '../crypto/crypto-engine';
import { deriveKeyFromPassword } from '../utils/crypto-utils';
import { PasswordItem, CreditCardItem, DocumentItem, ValidationError } from '../types/vault';
import { PasswordManagerError } from '../types/common';

describe('VaultManager', () => {
  let vaultManager: VaultManager;
  let storage: InMemoryVaultStorage;
  let masterKey: CryptoKey;
  const testPin = '123456';

  beforeEach(async () => {
    const cryptoEngine = createCryptoEngine();
    storage = new InMemoryVaultStorage();
    vaultManager = new VaultManager(cryptoEngine, storage);

    // Generate a master key for testing
    const salt = crypto.getRandomValues(new Uint8Array(32));
    masterKey = await deriveKeyFromPassword(testPin, salt);
  });

  describe('Vault Creation', () => {
    test('should create a new empty vault', async () => {
      await vaultManager.createVault(masterKey);

      expect(vaultManager.isVaultLoaded()).toBe(true);
      const vault = vaultManager.getVault();
      expect(vault).not.toBeNull();
      expect(vault?.items.size).toBe(0);
      expect(vault?.version).toBe(1);
    });

    test('should save encrypted vault to storage', async () => {
      await vaultManager.createVault(masterKey);

      const exists = await storage.vaultExists();
      expect(exists).toBe(true);

      const encryptedData = await storage.loadEncryptedVault();
      expect(encryptedData).not.toBeNull();
      expect(encryptedData?.ciphertext).toBeInstanceOf(Uint8Array);
      expect(encryptedData?.iv).toBeInstanceOf(Uint8Array);
      expect(encryptedData?.authTag).toBeInstanceOf(Uint8Array);
    });
  });

  describe('Vault Loading', () => {
    test('should load vault from encrypted storage', async () => {
      // Create and save a vault
      await vaultManager.createVault(masterKey);
      const originalVault = vaultManager.getVault();

      // Create a new manager and load the vault
      const newManager = new VaultManager(createCryptoEngine(), storage);
      const loadedVault = await newManager.loadVault(masterKey);

      expect(loadedVault.id).toBe(originalVault?.id);
      expect(loadedVault.version).toBe(originalVault?.version);
      expect(loadedVault.items.size).toBe(0);
    });

    test('should throw error when loading non-existent vault', async () => {
      await expect(vaultManager.loadVault(masterKey)).rejects.toThrow(PasswordManagerError);
    });

    test('should throw error when loading with wrong key', async () => {
      // Create vault with one key
      await vaultManager.createVault(masterKey);

      // Try to load with different key
      const wrongSalt = crypto.getRandomValues(new Uint8Array(32));
      const wrongKey = await deriveKeyFromPassword('wrong', wrongSalt);

      const newManager = new VaultManager(createCryptoEngine(), storage);
      await expect(newManager.loadVault(wrongKey)).rejects.toThrow(PasswordManagerError);
    });
  });

  describe('Password Item CRUD', () => {
    beforeEach(async () => {
      await vaultManager.createVault(masterKey);
    });

    test('should add a password item', async () => {
      const passwordItem: Omit<PasswordItem, 'id' | 'createdAt' | 'updatedAt'> = {
        type: 'password',
        title: 'Test Login',
        username: 'testuser',
        password: 'testpass123',
        url: 'https://example.com',
        notes: 'Test notes',
        tags: ['work', 'important'],
        history: [],
      };

      const id = await vaultManager.addItem(passwordItem, masterKey);

      expect(id).toBeTruthy();
      const item = vaultManager.getItem(id);
      expect(item).not.toBeNull();
      expect(item?.type).toBe('password');
      expect((item as PasswordItem).username).toBe('testuser');
      expect((item as PasswordItem).password).toBe('testpass123');
    });

    test('should reject password item with missing required fields', async () => {
      const invalidItem = {
        type: 'password',
        title: '',
        username: 'testuser',
        password: 'testpass123',
        tags: [],
        history: [],
      } as Omit<PasswordItem, 'id' | 'createdAt' | 'updatedAt'>;

      await expect(vaultManager.addItem(invalidItem, masterKey)).rejects.toThrow(ValidationError);
    });

    test('should update a password item', async () => {
      const passwordItem: Omit<PasswordItem, 'id' | 'createdAt' | 'updatedAt'> = {
        type: 'password',
        title: 'Test Login',
        username: 'testuser',
        password: 'testpass123',
        url: 'https://example.com',
        tags: [],
        history: [],
      };

      const id = await vaultManager.addItem(passwordItem, masterKey);

      await vaultManager.updateItem(
        id,
        { title: 'Updated Login', password: 'newpass456' },
        masterKey
      );

      const item = vaultManager.getItem(id) as PasswordItem;
      expect(item.title).toBe('Updated Login');
      expect(item.password).toBe('newpass456');
      expect(item.username).toBe('testuser'); // Unchanged
    });

    test('should delete a password item', async () => {
      const passwordItem: Omit<PasswordItem, 'id' | 'createdAt' | 'updatedAt'> = {
        type: 'password',
        title: 'Test Login',
        username: 'testuser',
        password: 'testpass123',
        tags: [],
        history: [],
      };

      const id = await vaultManager.addItem(passwordItem, masterKey);
      expect(vaultManager.getItem(id)).not.toBeNull();

      await vaultManager.deleteItem(id, masterKey);
      expect(vaultManager.getItem(id)).toBeNull();
    });

    test('should throw error when deleting non-existent item', async () => {
      await expect(vaultManager.deleteItem('non-existent-id', masterKey)).rejects.toThrow(
        PasswordManagerError
      );
    });
  });

  describe('Credit Card Item CRUD', () => {
    beforeEach(async () => {
      await vaultManager.createVault(masterKey);
    });

    test('should add a credit card item', async () => {
      // Use a date far in the future to avoid expiry issues
      const futureYear = new Date().getFullYear() + 5;
      const yearSuffix = futureYear.toString().slice(-2);
      
      const cardItem: Omit<CreditCardItem, 'id' | 'createdAt' | 'updatedAt'> = {
        type: 'creditcard',
        title: 'My Visa',
        cardNumber: '4532015112830366', // Valid test card number
        holderName: 'John Doe',
        expiryDate: `12/${yearSuffix}`,
        cvv: '123',
        notes: 'Personal card',
        tags: ['personal'],
      };

      const id = await vaultManager.addItem(cardItem, masterKey);

      expect(id).toBeTruthy();
      const item = vaultManager.getItem(id);
      expect(item).not.toBeNull();
      expect(item?.type).toBe('creditcard');
      expect((item as CreditCardItem).cardNumber).toBe('4532015112830366');
      expect((item as CreditCardItem).holderName).toBe('John Doe');
    });

    test('should reject credit card with invalid Luhn check', async () => {
      const invalidCard: Omit<CreditCardItem, 'id' | 'createdAt' | 'updatedAt'> = {
        type: 'creditcard',
        title: 'Invalid Card',
        cardNumber: '1234567890123456', // Invalid Luhn
        holderName: 'John Doe',
        expiryDate: '12/25',
        cvv: '123',
        tags: [],
      };

      await expect(vaultManager.addItem(invalidCard, masterKey)).rejects.toThrow(ValidationError);
    });

    test('should reject credit card with invalid expiry date', async () => {
      const invalidCard: Omit<CreditCardItem, 'id' | 'createdAt' | 'updatedAt'> = {
        type: 'creditcard',
        title: 'Expired Card',
        cardNumber: '4532015112830366',
        holderName: 'John Doe',
        expiryDate: '01/20', // Expired
        cvv: '123',
        tags: [],
      };

      await expect(vaultManager.addItem(invalidCard, masterKey)).rejects.toThrow(ValidationError);
    });
  });

  describe('Document Item CRUD', () => {
    beforeEach(async () => {
      await vaultManager.createVault(masterKey);
    });

    test('should add a document item', async () => {
      const textContent = new TextEncoder().encode('This is a test document');
      const docItem: Omit<DocumentItem, 'id' | 'createdAt' | 'updatedAt'> = {
        type: 'document',
        title: 'Test Document',
        content: {
          type: 'text',
          data: textContent,
          mimeType: 'text/plain',
          size: textContent.length,
        },
        notes: 'Important document',
        tags: ['documents'],
      };

      const id = await vaultManager.addItem(docItem, masterKey);

      expect(id).toBeTruthy();
      const item = vaultManager.getItem(id);
      expect(item).not.toBeNull();
      expect(item?.type).toBe('document');
      expect((item as DocumentItem).content.type).toBe('text');
      expect((item as DocumentItem).content.size).toBe(textContent.length);
    });

    test('should reject document with unsupported mime type', async () => {
      const content = new Uint8Array([1, 2, 3]);
      const invalidDoc: Omit<DocumentItem, 'id' | 'createdAt' | 'updatedAt'> = {
        type: 'document',
        title: 'Invalid Document',
        content: {
          type: 'text',
          data: content,
          mimeType: 'application/x-unsupported',
          size: content.length,
        },
        tags: [],
      };

      await expect(vaultManager.addItem(invalidDoc, masterKey)).rejects.toThrow(ValidationError);
    });

    test('should reject document exceeding size limit', async () => {
      const largeContent = new Uint8Array(11 * 1024 * 1024); // 11MB
      const invalidDoc: Omit<DocumentItem, 'id' | 'createdAt' | 'updatedAt'> = {
        type: 'document',
        title: 'Too Large',
        content: {
          type: 'text',
          data: largeContent,
          mimeType: 'text/plain',
          size: largeContent.length,
        },
        tags: [],
      };

      await expect(vaultManager.addItem(invalidDoc, masterKey)).rejects.toThrow(ValidationError);
    });
  });

  describe('Item Retrieval', () => {
    beforeEach(async () => {
      await vaultManager.createVault(masterKey);
    });

    test('should get all items', async () => {
      const password: Omit<PasswordItem, 'id' | 'createdAt' | 'updatedAt'> = {
        type: 'password',
        title: 'Login',
        username: 'user',
        password: 'pass',
        tags: [],
        history: [],
      };

      // Use a date far in the future to avoid expiry issues
      const futureYear = new Date().getFullYear() + 5;
      const yearSuffix = futureYear.toString().slice(-2);

      const card: Omit<CreditCardItem, 'id' | 'createdAt' | 'updatedAt'> = {
        type: 'creditcard',
        title: 'Card',
        cardNumber: '4532015112830366',
        holderName: 'John',
        expiryDate: `12/${yearSuffix}`,
        cvv: '123',
        tags: [],
      };

      await vaultManager.addItem(password, masterKey);
      await vaultManager.addItem(card, masterKey);

      const allItems = vaultManager.getAllItems();
      expect(allItems.length).toBe(2);
    });

    test('should get items by type', async () => {
      const password1: Omit<PasswordItem, 'id' | 'createdAt' | 'updatedAt'> = {
        type: 'password',
        title: 'Login 1',
        username: 'user1',
        password: 'pass1',
        tags: [],
        history: [],
      };

      const password2: Omit<PasswordItem, 'id' | 'createdAt' | 'updatedAt'> = {
        type: 'password',
        title: 'Login 2',
        username: 'user2',
        password: 'pass2',
        tags: [],
        history: [],
      };

      // Use a date far in the future to avoid expiry issues
      const futureYear = new Date().getFullYear() + 5;
      const yearSuffix = futureYear.toString().slice(-2);

      const card: Omit<CreditCardItem, 'id' | 'createdAt' | 'updatedAt'> = {
        type: 'creditcard',
        title: 'Card',
        cardNumber: '4532015112830366',
        holderName: 'John',
        expiryDate: `12/${yearSuffix}`,
        cvv: '123',
        tags: [],
      };

      await vaultManager.addItem(password1, masterKey);
      await vaultManager.addItem(password2, masterKey);
      await vaultManager.addItem(card, masterKey);

      const passwords = vaultManager.getItemsByType<PasswordItem>('password');
      expect(passwords.length).toBe(2);
      expect(passwords.every(item => item.type === 'password')).toBe(true);

      const cards = vaultManager.getItemsByType<CreditCardItem>('creditcard');
      expect(cards.length).toBe(1);
      expect(cards[0]?.type).toBe('creditcard');
    });
  });

  describe('Vault Persistence', () => {
    test('should persist items across save/load cycles', async () => {
      // Create vault and add items
      await vaultManager.createVault(masterKey);

      const password: Omit<PasswordItem, 'id' | 'createdAt' | 'updatedAt'> = {
        type: 'password',
        title: 'Test Login',
        username: 'testuser',
        password: 'testpass',
        tags: ['test'],
        history: [],
      };

      const id = await vaultManager.addItem(password, masterKey);

      // Load vault in new manager
      const newManager = new VaultManager(createCryptoEngine(), storage);
      await newManager.loadVault(masterKey);

      const loadedItem = newManager.getItem(id) as PasswordItem;
      expect(loadedItem).not.toBeNull();
      expect(loadedItem.title).toBe('Test Login');
      expect(loadedItem.username).toBe('testuser');
      expect(loadedItem.password).toBe('testpass');
    });

    test('should maintain item integrity after multiple updates', async () => {
      await vaultManager.createVault(masterKey);

      const password: Omit<PasswordItem, 'id' | 'createdAt' | 'updatedAt'> = {
        type: 'password',
        title: 'Original',
        username: 'user',
        password: 'pass',
        tags: [],
        history: [],
      };

      const id = await vaultManager.addItem(password, masterKey);

      // Multiple updates
      await vaultManager.updateItem(id, { title: 'Update 1' }, masterKey);
      await vaultManager.updateItem(id, { password: 'newpass' }, masterKey);
      await vaultManager.updateItem(id, { tags: ['updated'] }, masterKey);

      // Load in new manager
      const newManager = new VaultManager(createCryptoEngine(), storage);
      await newManager.loadVault(masterKey);

      const item = newManager.getItem(id) as PasswordItem;
      expect(item.title).toBe('Update 1');
      expect(item.password).toBe('newpass');
      expect(item.tags).toContain('updated');
      expect(item.username).toBe('user'); // Original value preserved
    });
  });

  describe('Error Handling', () => {
    test('should throw error when adding item without loaded vault', async () => {
      const password: Omit<PasswordItem, 'id' | 'createdAt' | 'updatedAt'> = {
        type: 'password',
        title: 'Test',
        username: 'user',
        password: 'pass',
        tags: [],
        history: [],
      };

      await expect(vaultManager.addItem(password, masterKey)).rejects.toThrow(PasswordManagerError);
    });

    test('should throw error when updating non-existent item', async () => {
      await vaultManager.createVault(masterKey);

      await expect(
        vaultManager.updateItem('non-existent', { title: 'New' }, masterKey)
      ).rejects.toThrow(PasswordManagerError);
    });

    test('should return null when getting non-existent item', async () => {
      await vaultManager.createVault(masterKey);

      const item = vaultManager.getItem('non-existent');
      expect(item).toBeNull();
    });

    test('should return empty array when vault not loaded', () => {
      const items = vaultManager.getAllItems();
      expect(items).toEqual([]);
    });
  });

  describe('Vault State', () => {
    test('should track vault loaded state', async () => {
      expect(vaultManager.isVaultLoaded()).toBe(false);

      await vaultManager.createVault(masterKey);
      expect(vaultManager.isVaultLoaded()).toBe(true);
    });

    test('should update vault timestamps on modifications', async () => {
      await vaultManager.createVault(masterKey);
      const vault1 = vaultManager.getVault();
      const originalUpdatedAt = vault1?.updatedAt;

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      const password: Omit<PasswordItem, 'id' | 'createdAt' | 'updatedAt'> = {
        type: 'password',
        title: 'Test',
        username: 'user',
        password: 'pass',
        tags: [],
        history: [],
      };

      await vaultManager.addItem(password, masterKey);

      const vault2 = vaultManager.getVault();
      expect(vault2?.updatedAt).toBeGreaterThan(originalUpdatedAt!);
    });
  });

  describe('Password History', () => {
    beforeEach(async () => {
      await vaultManager.createVault(masterKey);
    });

    test('should add old password to history when password is updated', async () => {
      // Create initial password item
      const passwordItem: Omit<PasswordItem, 'id' | 'createdAt' | 'updatedAt'> = {
        type: 'password',
        title: 'Test Login',
        username: 'testuser',
        password: 'oldPassword123',
        tags: [],
        history: [],
      };

      const id = await vaultManager.addItem(passwordItem, masterKey);

      // Update password
      await vaultManager.updateItem(id, { password: 'newPassword456' }, masterKey);

      // Check history
      const item = vaultManager.getItem(id) as PasswordItem;
      expect(item.password).toBe('newPassword456');
      expect(item.history.length).toBe(1);
      expect(item.history[0]?.password).toBe('oldPassword123');
      expect(item.history[0]?.changedAt).toBeDefined();
    });

    test('should not add to history when password is not changed', async () => {
      // Create initial password item
      const passwordItem: Omit<PasswordItem, 'id' | 'createdAt' | 'updatedAt'> = {
        type: 'password',
        title: 'Test Login',
        username: 'testuser',
        password: 'samePassword123',
        tags: [],
        history: [],
      };

      const id = await vaultManager.addItem(passwordItem, masterKey);

      // Update other fields but not password
      await vaultManager.updateItem(id, { title: 'Updated Title' }, masterKey);

      // Check history is still empty
      const item = vaultManager.getItem(id) as PasswordItem;
      expect(item.title).toBe('Updated Title');
      expect(item.password).toBe('samePassword123');
      expect(item.history.length).toBe(0);
    });

    test('should not add to history when password is set to same value', async () => {
      // Create initial password item
      const passwordItem: Omit<PasswordItem, 'id' | 'createdAt' | 'updatedAt'> = {
        type: 'password',
        title: 'Test Login',
        username: 'testuser',
        password: 'samePassword123',
        tags: [],
        history: [],
      };

      const id = await vaultManager.addItem(passwordItem, masterKey);

      // Update password to same value
      await vaultManager.updateItem(id, { password: 'samePassword123' }, masterKey);

      // Check history is still empty
      const item = vaultManager.getItem(id) as PasswordItem;
      expect(item.password).toBe('samePassword123');
      expect(item.history.length).toBe(0);
    });

    test('should maintain history in chronological order (newest first)', async () => {
      // Create initial password item
      const passwordItem: Omit<PasswordItem, 'id' | 'createdAt' | 'updatedAt'> = {
        type: 'password',
        title: 'Test Login',
        username: 'testuser',
        password: 'password1',
        tags: [],
        history: [],
      };

      const id = await vaultManager.addItem(passwordItem, masterKey);

      // Update password multiple times with small delays
      await vaultManager.updateItem(id, { password: 'password2' }, masterKey);
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await vaultManager.updateItem(id, { password: 'password3' }, masterKey);
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await vaultManager.updateItem(id, { password: 'password4' }, masterKey);

      // Check history order
      const item = vaultManager.getItem(id) as PasswordItem;
      expect(item.password).toBe('password4');
      expect(item.history.length).toBe(3);
      expect(item.history[0]?.password).toBe('password3'); // Most recent
      expect(item.history[1]?.password).toBe('password2');
      expect(item.history[2]?.password).toBe('password1'); // Oldest
      
      // Verify timestamps are in descending order
      expect(item.history[0]?.changedAt).toBeGreaterThan(item.history[1]?.changedAt ?? 0);
      expect(item.history[1]?.changedAt).toBeGreaterThan(item.history[2]?.changedAt ?? 0);
    });

    test('should limit history to 5 entries (automatic rotation)', async () => {
      // Create initial password item
      const passwordItem: Omit<PasswordItem, 'id' | 'createdAt' | 'updatedAt'> = {
        type: 'password',
        title: 'Test Login',
        username: 'testuser',
        password: 'password1',
        tags: [],
        history: [],
      };

      const id = await vaultManager.addItem(passwordItem, masterKey);

      // Update password 7 times (should keep only last 5 in history)
      for (let i = 2; i <= 8; i++) {
        await vaultManager.updateItem(id, { password: `password${i}` }, masterKey);
        await new Promise(resolve => setTimeout(resolve, 5));
      }

      // Check history is limited to 5
      const item = vaultManager.getItem(id) as PasswordItem;
      expect(item.password).toBe('password8');
      expect(item.history.length).toBe(5);
      
      // Verify we have the 5 most recent passwords
      expect(item.history[0]?.password).toBe('password7');
      expect(item.history[1]?.password).toBe('password6');
      expect(item.history[2]?.password).toBe('password5');
      expect(item.history[3]?.password).toBe('password4');
      expect(item.history[4]?.password).toBe('password3');
      
      // password1 and password2 should have been rotated out
    });

    test('should preserve existing history when adding new entry', async () => {
      // Create password item with existing history
      const passwordItem: Omit<PasswordItem, 'id' | 'createdAt' | 'updatedAt'> = {
        type: 'password',
        title: 'Test Login',
        username: 'testuser',
        password: 'currentPassword',
        tags: [],
        history: [
          { password: 'oldPassword2', changedAt: Date.now() - 2000 },
          { password: 'oldPassword1', changedAt: Date.now() - 3000 },
        ],
      };

      const id = await vaultManager.addItem(passwordItem, masterKey);

      // Update password
      await vaultManager.updateItem(id, { password: 'newPassword' }, masterKey);

      // Check history includes both old and new entries
      const item = vaultManager.getItem(id) as PasswordItem;
      expect(item.password).toBe('newPassword');
      expect(item.history.length).toBe(3);
      expect(item.history[0]?.password).toBe('currentPassword'); // Most recent
      expect(item.history[1]?.password).toBe('oldPassword2');
      expect(item.history[2]?.password).toBe('oldPassword1');
    });

    test('should persist password history across save/load cycles', async () => {
      // Create password item and update it
      const passwordItem: Omit<PasswordItem, 'id' | 'createdAt' | 'updatedAt'> = {
        type: 'password',
        title: 'Test Login',
        username: 'testuser',
        password: 'password1',
        tags: [],
        history: [],
      };

      const id = await vaultManager.addItem(passwordItem, masterKey);
      
      await vaultManager.updateItem(id, { password: 'password2' }, masterKey);
      await vaultManager.updateItem(id, { password: 'password3' }, masterKey);

      // Load vault in new manager
      const newManager = new VaultManager(createCryptoEngine(), storage);
      await newManager.loadVault(masterKey);

      // Verify history is preserved
      const loadedItem = newManager.getItem(id) as PasswordItem;
      expect(loadedItem.password).toBe('password3');
      expect(loadedItem.history.length).toBe(2);
      expect(loadedItem.history[0]?.password).toBe('password2');
      expect(loadedItem.history[1]?.password).toBe('password1');
    });

    test('should handle password updates with other field changes', async () => {
      // Create initial password item
      const passwordItem: Omit<PasswordItem, 'id' | 'createdAt' | 'updatedAt'> = {
        type: 'password',
        title: 'Test Login',
        username: 'testuser',
        password: 'oldPassword',
        url: 'https://example.com',
        tags: [],
        history: [],
      };

      const id = await vaultManager.addItem(passwordItem, masterKey);

      // Update password along with other fields
      await vaultManager.updateItem(
        id,
        {
          password: 'newPassword',
          title: 'Updated Login',
          url: 'https://newexample.com',
          tags: ['updated'],
        },
        masterKey
      );

      // Check all fields are updated and history is maintained
      const item = vaultManager.getItem(id) as PasswordItem;
      expect(item.password).toBe('newPassword');
      expect(item.title).toBe('Updated Login');
      expect(item.url).toBe('https://newexample.com');
      expect(item.tags).toContain('updated');
      expect(item.history.length).toBe(1);
      expect(item.history[0]?.password).toBe('oldPassword');
    });

    test('should not affect non-password items', async () => {
      // Use a date far in the future to avoid expiry issues
      const futureYear = new Date().getFullYear() + 5;
      const yearSuffix = futureYear.toString().slice(-2);

      // Create credit card item
      const cardItem: Omit<CreditCardItem, 'id' | 'createdAt' | 'updatedAt'> = {
        type: 'creditcard',
        title: 'My Card',
        cardNumber: '4532015112830366',
        holderName: 'John Doe',
        expiryDate: `12/${yearSuffix}`,
        cvv: '123',
        tags: [],
      };

      const id = await vaultManager.addItem(cardItem, masterKey);

      // Update card (should not trigger history logic)
      await vaultManager.updateItem(id, { cvv: '456' }, masterKey);

      // Verify update worked without errors
      const item = vaultManager.getItem(id) as CreditCardItem;
      expect(item.cvv).toBe('456');
      expect(item.type).toBe('creditcard');
    });
  });
});
