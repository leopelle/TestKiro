/**
 * VaultManager Implementation
 * 
 * This module provides the main vault management functionality including:
 * - CRUD operations for vault items (passwords, credit cards, documents)
 * - Encrypted loading and saving of vault data
 * - Vault state management
 * 
 * Requirements: 1.4, 2.1, 3.1
 */

import { CryptoEngine, EncryptedData } from '../types/crypto';
import { 
  VaultItem,
  PasswordItem,
  validateVaultItem,
  serializeVaultItem,
  deserializeVaultItem,
  ValidationError
} from '../types/vault';
import { 
  UUID, 
  Timestamp, 
  PasswordManagerError, 
  ErrorCode
} from '../types/common';

/**
 * Vault metadata
 */
export interface VaultMetadata {
  readonly version: number;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
}

/**
 * Vault structure
 */
export interface Vault {
  readonly id: UUID;
  readonly version: number;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
  readonly items: ReadonlyMap<UUID, VaultItem>;
  readonly metadata: VaultMetadata;
}

/**
 * Serialized vault structure for encryption
 */
interface SerializedVault {
  id: string;
  version: number;
  createdAt: number;
  updatedAt: number;
  items: Record<string, Record<string, unknown>>;
  metadata: {
    version: number;
    createdAt: number;
    updatedAt: number;
  };
}

/**
 * Storage interface for persisting vault data
 */
export interface VaultStorage {
  /**
   * Saves encrypted vault data
   */
  saveEncryptedVault(encryptedData: EncryptedData): Promise<void>;
  
  /**
   * Loads encrypted vault data
   */
  loadEncryptedVault(): Promise<EncryptedData | null>;
  
  /**
   * Checks if a vault exists
   */
  vaultExists(): Promise<boolean>;
}

/**
 * In-memory implementation of VaultStorage for testing
 */
export class InMemoryVaultStorage implements VaultStorage {
  private encryptedData: EncryptedData | null = null;

  async saveEncryptedVault(encryptedData: EncryptedData): Promise<void> {
    this.encryptedData = encryptedData;
  }

  async loadEncryptedVault(): Promise<EncryptedData | null> {
    return this.encryptedData;
  }

  async vaultExists(): Promise<boolean> {
    return this.encryptedData !== null;
  }

  /**
   * Clears stored data (useful for testing)
   */
  clear(): void {
    this.encryptedData = null;
  }
}

/**
 * VaultManager implementation
 * 
 * Manages vault operations including CRUD for items and encrypted persistence
 */
export class VaultManager {
  private vault: Vault | null = null;
  private cryptoEngine: CryptoEngine;
  private storage: VaultStorage;

  constructor(cryptoEngine: CryptoEngine, storage?: VaultStorage) {
    this.cryptoEngine = cryptoEngine;
    this.storage = storage || new InMemoryVaultStorage();
  }

  /**
   * Creates a new empty vault
   * 
   * Requirement 1.4: Initialize encrypted vault structure
   * 
   * @param masterKey - The master key for encrypting the vault
   * @returns Promise resolving when vault is created
   */
  async createVault(masterKey: CryptoKey): Promise<void> {
    const now = Date.now();
    const vaultId = this.generateUUID();

    this.vault = {
      id: vaultId,
      version: 1,
      createdAt: now,
      updatedAt: now,
      items: new Map(),
      metadata: {
        version: 1,
        createdAt: now,
        updatedAt: now,
      },
    };

    // Save the empty vault
    await this.saveVault(this.vault, masterKey);
  }

  /**
   * Loads vault from encrypted storage
   * 
   * Requirement 1.4: Load and decrypt vault data
   * 
   * @param masterKey - The master key for decrypting the vault
   * @returns Promise resolving to the loaded vault
   * @throws PasswordManagerError if vault cannot be loaded or decrypted
   */
  async loadVault(masterKey: CryptoKey): Promise<Vault> {
    try {
      // Check if vault exists
      const exists = await this.storage.vaultExists();
      if (!exists) {
        throw new PasswordManagerError(
          ErrorCode.FILE_CORRUPTED,
          'No vault found in storage'
        );
      }

      // Load encrypted data
      const encryptedData = await this.storage.loadEncryptedVault();
      if (!encryptedData) {
        throw new PasswordManagerError(
          ErrorCode.FILE_CORRUPTED,
          'Failed to load encrypted vault data'
        );
      }

      // Decrypt the vault data
      const decryptedData = await this.cryptoEngine.decrypt(encryptedData, masterKey);

      // Parse JSON
      const jsonString = new TextDecoder().decode(decryptedData);
      const serialized = JSON.parse(jsonString) as SerializedVault;

      // Deserialize vault
      const vault = this.deserializeVault(serialized);
      this.vault = vault;

      return vault;
    } catch (error) {
      if (error instanceof PasswordManagerError) {
        throw error;
      }

      throw new PasswordManagerError(
        ErrorCode.DECRYPTION_FAILED,
        `Failed to load vault: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Saves vault to encrypted storage
   * 
   * Requirement 1.4: Encrypt and save vault data
   * 
   * @param vault - The vault to save
   * @param masterKey - The master key for encrypting the vault
   * @returns Promise resolving when vault is saved
   * @throws PasswordManagerError if vault cannot be encrypted or saved
   */
  async saveVault(vault: Vault, masterKey: CryptoKey): Promise<void> {
    try {
      // Update vault timestamp
      const updatedVault: Vault = {
        ...vault,
        updatedAt: Date.now(),
        metadata: {
          ...vault.metadata,
          updatedAt: Date.now(),
        },
      };

      // Serialize vault
      const serialized = this.serializeVault(updatedVault);

      // Convert to JSON
      const jsonString = JSON.stringify(serialized);
      const data = new TextEncoder().encode(jsonString);

      // Encrypt the data
      const encryptedData = await this.cryptoEngine.encrypt(data, masterKey);

      // Save to storage
      await this.storage.saveEncryptedVault(encryptedData);

      // Update in-memory vault
      this.vault = updatedVault;
    } catch (error) {
      if (error instanceof PasswordManagerError) {
        throw error;
      }

      throw new PasswordManagerError(
        ErrorCode.ENCRYPTION_FAILED,
        `Failed to save vault: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Adds a new item to the vault
   * 
   * Requirements:
   * - 2.1: Add password items
   * - 3.1: Add credit card items
   * - 4.1: Add document items
   * 
   * @param item - The item to add (without id, createdAt, updatedAt)
   * @param masterKey - The master key for saving the vault
   * @returns Promise resolving to the ID of the added item
   * @throws ValidationError if item is invalid
   * @throws PasswordManagerError if vault is not loaded
   */
  async addItem(
    item: Omit<VaultItem, 'id' | 'createdAt' | 'updatedAt'>,
    masterKey: CryptoKey
  ): Promise<UUID> {
    if (!this.vault) {
      throw new PasswordManagerError(
        ErrorCode.INVALID_DATA_FORMAT,
        'Vault not loaded. Call loadVault() or createVault() first.'
      );
    }

    const now = Date.now();
    const id = this.generateUUID();

    // Create complete item with generated fields
    const completeItem: VaultItem = {
      ...item,
      id,
      createdAt: now,
      updatedAt: now,
    } as VaultItem;

    // Validate the item
    const validation = validateVaultItem(completeItem);
    if (!validation.valid) {
      throw new ValidationError('Invalid vault item', validation.errors);
    }

    // Add to vault
    const newItems = new Map(this.vault.items);
    newItems.set(id, completeItem);

    const updatedVault: Vault = {
      ...this.vault,
      items: newItems,
      updatedAt: now,
    };

    // Save vault
    await this.saveVault(updatedVault, masterKey);

    return id;
  }

  /**
   * Updates an existing item in the vault
   * 
   * Requirement 2.5: When updating a password item, maintain history of last 5 versions
   * 
   * @param id - The ID of the item to update
   * @param updates - Partial updates to apply to the item
   * @param masterKey - The master key for saving the vault
   * @returns Promise resolving when item is updated
   * @throws PasswordManagerError if item not found or vault not loaded
   */
  async updateItem(
    id: UUID,
    updates: Record<string, unknown>,
    masterKey: CryptoKey
  ): Promise<void> {
    if (!this.vault) {
      throw new PasswordManagerError(
        ErrorCode.INVALID_DATA_FORMAT,
        'Vault not loaded. Call loadVault() or createVault() first.'
      );
    }

    const existingItem = this.vault.items.get(id);
    if (!existingItem) {
      throw new PasswordManagerError(
        ErrorCode.INVALID_DATA_FORMAT,
        `Item with ID ${id} not found`
      );
    }

    const now = Date.now();

    // Handle password history for password items
    let finalUpdates = { ...updates };
    if (existingItem.type === 'password' && 'password' in updates) {
      const passwordItem = existingItem as PasswordItem;
      const newPassword = updates['password'] as string;
      const oldPassword = passwordItem.password;

      // Only add to history if password actually changed
      if (newPassword !== oldPassword) {
        finalUpdates = this.updatePasswordHistory(passwordItem, oldPassword, now, updates);
      }
    }

    // Merge updates with existing item
    const updatedItem: VaultItem = {
      ...existingItem,
      ...finalUpdates,
      id: existingItem.id, // Preserve ID
      type: existingItem.type, // Preserve type
      createdAt: existingItem.createdAt, // Preserve creation time
      updatedAt: now,
    } as VaultItem;

    // Validate the updated item
    const validation = validateVaultItem(updatedItem);
    if (!validation.valid) {
      throw new ValidationError('Invalid vault item', validation.errors);
    }

    // Update in vault
    const newItems = new Map(this.vault.items);
    newItems.set(id, updatedItem);

    const updatedVault: Vault = {
      ...this.vault,
      items: newItems,
      updatedAt: now,
    };

    // Save vault
    await this.saveVault(updatedVault, masterKey);
  }

  /**
   * Updates password history when a password is changed
   * 
   * Requirement 2.5: Maintain history of last 5 password versions with automatic rotation
   * 
   * @param passwordItem - The existing password item
   * @param oldPassword - The old password to add to history
   * @param timestamp - The timestamp of the change
   * @param updates - The updates being applied
   * @returns Updated fields including new history
   * @private
   */
  private updatePasswordHistory(
    passwordItem: PasswordItem,
    oldPassword: string,
    timestamp: Timestamp,
    updates: Record<string, unknown>
  ): Record<string, unknown> {
    // Get existing history
    const existingHistory = [...passwordItem.history];

    // Add old password to history
    const newHistoryEntry = {
      password: oldPassword,
      changedAt: timestamp,
    };

    // Add to beginning of history array
    existingHistory.unshift(newHistoryEntry);

    // Limit to 5 most recent entries (automatic rotation)
    const limitedHistory = existingHistory.slice(0, 5);

    // Return updates with new history
    return {
      ...updates,
      history: limitedHistory,
    };
  }

  /**
   * Deletes an item from the vault
   * 
   * @param id - The ID of the item to delete
   * @param masterKey - The master key for saving the vault
   * @returns Promise resolving when item is deleted
   * @throws PasswordManagerError if item not found or vault not loaded
   */
  async deleteItem(id: UUID, masterKey: CryptoKey): Promise<void> {
    if (!this.vault) {
      throw new PasswordManagerError(
        ErrorCode.INVALID_DATA_FORMAT,
        'Vault not loaded. Call loadVault() or createVault() first.'
      );
    }

    if (!this.vault.items.has(id)) {
      throw new PasswordManagerError(
        ErrorCode.INVALID_DATA_FORMAT,
        `Item with ID ${id} not found`
      );
    }

    const now = Date.now();

    // Remove from vault
    const newItems = new Map(this.vault.items);
    newItems.delete(id);

    const updatedVault: Vault = {
      ...this.vault,
      items: newItems,
      updatedAt: now,
    };

    // Save vault
    await this.saveVault(updatedVault, masterKey);
  }

  /**
   * Gets an item by ID
   * 
   * @param id - The ID of the item to retrieve
   * @returns The vault item, or null if not found
   */
  getItem(id: UUID): VaultItem | null {
    if (!this.vault) {
      return null;
    }

    return this.vault.items.get(id) || null;
  }

  /**
   * Gets all items in the vault
   * 
   * @returns Array of all vault items
   */
  getAllItems(): VaultItem[] {
    if (!this.vault) {
      return [];
    }

    return Array.from(this.vault.items.values());
  }

  /**
   * Gets all items of a specific type
   * 
   * @param type - The type of items to retrieve
   * @returns Array of items of the specified type
   */
  getItemsByType<T extends VaultItem>(type: T['type']): T[] {
    if (!this.vault) {
      return [];
    }

    return Array.from(this.vault.items.values())
      .filter(item => item.type === type) as T[];
  }

  /**
   * Gets the current vault
   * 
   * @returns The current vault, or null if not loaded
   */
  getVault(): Vault | null {
    return this.vault;
  }

  /**
   * Checks if a vault is loaded
   * 
   * @returns true if vault is loaded, false otherwise
   */
  isVaultLoaded(): boolean {
    return this.vault !== null;
  }

  /**
   * Serializes a vault to a plain object for encryption
   * 
   * @private
   */
  private serializeVault(vault: Vault): SerializedVault {
    const items: Record<string, Record<string, unknown>> = {};

    for (const [id, item] of vault.items) {
      items[id] = serializeVaultItem(item);
    }

    return {
      id: vault.id,
      version: vault.version,
      createdAt: vault.createdAt,
      updatedAt: vault.updatedAt,
      items,
      metadata: {
        version: vault.metadata.version,
        createdAt: vault.metadata.createdAt,
        updatedAt: vault.metadata.updatedAt,
      },
    };
  }

  /**
   * Deserializes a vault from a plain object
   * 
   * @private
   */
  private deserializeVault(serialized: SerializedVault): Vault {
    const items = new Map<UUID, VaultItem>();

    for (const [id, itemData] of Object.entries(serialized.items)) {
      try {
        const item = deserializeVaultItem(itemData);
        items.set(id, item);
      } catch (error) {
        // Log error but continue with other items
        console.error(`Failed to deserialize item ${id}:`, error);
      }
    }

    return {
      id: serialized.id,
      version: serialized.version,
      createdAt: serialized.createdAt,
      updatedAt: serialized.updatedAt,
      items,
      metadata: {
        version: serialized.metadata.version,
        createdAt: serialized.metadata.createdAt,
        updatedAt: serialized.metadata.updatedAt,
      },
    };
  }

  /**
   * Generates a UUID v4
   * 
   * @private
   */
  private generateUUID(): UUID {
    // Simple UUID v4 implementation
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

/**
 * Factory function to create a new VaultManager instance
 */
export function createVaultManager(
  cryptoEngine: CryptoEngine,
  storage?: VaultStorage
): VaultManager {
  return new VaultManager(cryptoEngine, storage);
}
