/**
 * Backup Service Implementation
 * 
 * This module provides encrypted backup and restore functionality for the vault.
 * 
 * Requirements:
 * - 8.1: Create encrypted backup file with all vault data
 * - 8.4: Include metadata (version, creation date) in backup
 */

import { CryptoEngine, EncryptedData } from '../types/crypto';
import { Vault } from '../vault/vault-manager';
import { PasswordManagerError, ErrorCode, Timestamp } from '../types/common';

/**
 * Backup metadata structure
 * 
 * Requirement 8.4: Include version and creation date metadata
 */
export interface BackupMetadata {
  readonly version: number;
  readonly createdAt: Timestamp;
  readonly appVersion: string;
  readonly vaultId: string;
}

/**
 * Complete backup structure
 */
export interface BackupData {
  readonly metadata: BackupMetadata;
  readonly vault: Vault;
}

/**
 * Serialized backup format for encryption
 */
interface SerializedBackup {
  metadata: {
    version: number;
    createdAt: number;
    appVersion: string;
    vaultId: string;
  };
  vault: {
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
  };
}

/**
 * Encrypted backup file structure
 */
export interface EncryptedBackup {
  readonly encryptedData: EncryptedData;
  readonly metadata: BackupMetadata;
}

/**
 * Backup service for creating and restoring encrypted vault backups
 */
export class BackupService {
  private cryptoEngine: CryptoEngine;
  private readonly BACKUP_VERSION = 1;
  private readonly APP_VERSION = '1.0.0';

  constructor(cryptoEngine: CryptoEngine) {
    this.cryptoEngine = cryptoEngine;
  }

  /**
   * Creates an encrypted backup of the vault
   * 
   * Requirements:
   * - 8.1: Create encrypted file with all vault data
   * - 8.4: Include metadata (version, creation date)
   * 
   * @param vault - The vault to backup
   * @param backupKey - The encryption key for the backup
   * @returns Promise resolving to encrypted backup data
   * @throws PasswordManagerError if backup creation fails
   */
  async createBackup(vault: Vault, backupKey: CryptoKey): Promise<EncryptedBackup> {
    try {
      // Create backup metadata
      const metadata: BackupMetadata = {
        version: this.BACKUP_VERSION,
        createdAt: Date.now(),
        appVersion: this.APP_VERSION,
        vaultId: vault.id,
      };

      // Create backup data structure
      const backupData: BackupData = {
        metadata,
        vault,
      };

      // Serialize backup data
      const serialized = this.serializeBackup(backupData);

      // Convert to JSON
      const jsonString = JSON.stringify(serialized);
      const data = new TextEncoder().encode(jsonString);

      // Encrypt the backup data
      const encryptedData = await this.cryptoEngine.encrypt(data, backupKey);

      return {
        encryptedData,
        metadata,
      };
    } catch (error) {
      if (error instanceof PasswordManagerError) {
        throw error;
      }

      throw new PasswordManagerError(
        ErrorCode.ENCRYPTION_FAILED,
        `Failed to create backup: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Restores a vault from an encrypted backup
   * 
   * Requirement 8.2: Restore from backup with password and integrity validation
   * 
   * This method performs comprehensive integrity validation:
   * 1. Decrypts backup using provided key (AES-GCM provides authentication)
   * 2. Validates backup structure and required fields
   * 3. Validates backup version compatibility
   * 4. Validates vault ID consistency
   * 5. Validates vault structure and metadata
   * 
   * @param encryptedBackup - The encrypted backup to restore
   * @param backupKey - The decryption key for the backup
   * @returns Promise resolving to restored backup data
   * @throws PasswordManagerError if restore fails or data is invalid
   */
  async restoreBackup(
    encryptedBackup: EncryptedBackup,
    backupKey: CryptoKey
  ): Promise<BackupData> {
    try {
      // Validate input
      if (!encryptedBackup || !encryptedBackup.encryptedData || !encryptedBackup.metadata) {
        throw new PasswordManagerError(
          ErrorCode.INVALID_DATA_FORMAT,
          'Invalid backup structure: missing required fields'
        );
      }

      // Decrypt the backup data (AES-GCM provides authentication via auth tag)
      const decryptedData = await this.cryptoEngine.decrypt(
        encryptedBackup.encryptedData,
        backupKey
      );

      // Parse JSON
      const jsonString = new TextDecoder().decode(decryptedData);
      const serialized = JSON.parse(jsonString) as SerializedBackup;

      // Validate backup structure
      this.validateBackupStructure(serialized);

      // Validate backup version compatibility
      if (serialized.metadata.version > this.BACKUP_VERSION) {
        throw new PasswordManagerError(
          ErrorCode.INVALID_DATA_FORMAT,
          `Backup version ${serialized.metadata.version} is not supported. Current version: ${this.BACKUP_VERSION}`
        );
      }

      // Deserialize backup data
      const backupData = this.deserializeBackup(serialized);

      // Validate vault ID matches metadata (integrity check)
      if (backupData.vault.id !== backupData.metadata.vaultId) {
        throw new PasswordManagerError(
          ErrorCode.FILE_CORRUPTED,
          'Backup data integrity check failed: vault ID mismatch'
        );
      }

      // Validate vault structure
      this.validateVaultStructure(backupData.vault);

      return backupData;
    } catch (error) {
      if (error instanceof PasswordManagerError) {
        throw error;
      }

      throw new PasswordManagerError(
        ErrorCode.DECRYPTION_FAILED,
        `Failed to restore backup: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Validates the structure of a serialized backup
   * 
   * @private
   * @throws PasswordManagerError if structure is invalid
   */
  private validateBackupStructure(serialized: SerializedBackup): void {
    if (!serialized.metadata || !serialized.vault) {
      throw new PasswordManagerError(
        ErrorCode.INVALID_DATA_FORMAT,
        'Invalid backup structure: missing metadata or vault'
      );
    }

    if (typeof serialized.metadata.version !== 'number' ||
        typeof serialized.metadata.createdAt !== 'number' ||
        typeof serialized.metadata.appVersion !== 'string' ||
        typeof serialized.metadata.vaultId !== 'string') {
      throw new PasswordManagerError(
        ErrorCode.INVALID_DATA_FORMAT,
        'Invalid backup metadata structure'
      );
    }

    if (!serialized.vault.id || !serialized.vault.items || !serialized.vault.metadata) {
      throw new PasswordManagerError(
        ErrorCode.INVALID_DATA_FORMAT,
        'Invalid vault structure in backup'
      );
    }

    if (typeof serialized.vault.metadata.version !== 'number' ||
        typeof serialized.vault.metadata.createdAt !== 'number' ||
        typeof serialized.vault.metadata.updatedAt !== 'number') {
      throw new PasswordManagerError(
        ErrorCode.INVALID_DATA_FORMAT,
        'Invalid vault metadata structure in backup'
      );
    }
  }

  /**
   * Validates the structure of a restored vault
   * 
   * @private
   * @throws PasswordManagerError if structure is invalid
   */
  private validateVaultStructure(vault: Vault): void {
    if (!vault.id || typeof vault.version !== 'number') {
      throw new PasswordManagerError(
        ErrorCode.INVALID_DATA_FORMAT,
        'Invalid vault structure: missing required fields'
      );
    }

    if (!(vault.items instanceof Map)) {
      throw new PasswordManagerError(
        ErrorCode.INVALID_DATA_FORMAT,
        'Invalid vault structure: items must be a Map'
      );
    }

    if (!vault.metadata || typeof vault.metadata.version !== 'number') {
      throw new PasswordManagerError(
        ErrorCode.INVALID_DATA_FORMAT,
        'Invalid vault metadata structure'
      );
    }
  }

  /**
   * Exports backup to a file format (base64 encoded)
   * 
   * @param encryptedBackup - The encrypted backup to export
   * @returns Base64 encoded backup file content
   */
  exportBackupToFile(encryptedBackup: EncryptedBackup): string {
    const fileData = {
      metadata: encryptedBackup.metadata,
      encryptedData: {
        ciphertext: Array.from(encryptedBackup.encryptedData.ciphertext),
        iv: Array.from(encryptedBackup.encryptedData.iv),
        authTag: Array.from(encryptedBackup.encryptedData.authTag),
      },
    };

    const jsonString = JSON.stringify(fileData);
    const bytes = new TextEncoder().encode(jsonString);
    
    // Convert to base64
    return this.bytesToBase64(bytes);
  }

  /**
   * Imports backup from a file format (base64 encoded)
   * 
   * @param fileContent - Base64 encoded backup file content
   * @returns Encrypted backup structure
   * @throws PasswordManagerError if file format is invalid
   */
  importBackupFromFile(fileContent: string): EncryptedBackup {
    try {
      // Decode from base64
      const bytes = this.base64ToBytes(fileContent);
      const jsonString = new TextDecoder().decode(bytes);
      const fileData = JSON.parse(jsonString);

      // Validate structure
      if (!fileData.metadata || !fileData.encryptedData) {
        throw new PasswordManagerError(
          ErrorCode.INVALID_DATA_FORMAT,
          'Invalid backup file format'
        );
      }

      // Reconstruct encrypted backup
      return {
        metadata: fileData.metadata as BackupMetadata,
        encryptedData: {
          ciphertext: new Uint8Array(fileData.encryptedData.ciphertext),
          iv: new Uint8Array(fileData.encryptedData.iv),
          authTag: new Uint8Array(fileData.encryptedData.authTag),
        },
      };
    } catch (error) {
      if (error instanceof PasswordManagerError) {
        throw error;
      }

      throw new PasswordManagerError(
        ErrorCode.INVALID_DATA_FORMAT,
        `Failed to import backup file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Serializes backup data to a plain object
   * 
   * @private
   */
  private serializeBackup(backupData: BackupData): SerializedBackup {
    // Serialize vault items
    const items: Record<string, Record<string, unknown>> = {};
    for (const [id, item] of backupData.vault.items) {
      items[id] = this.serializeVaultItem(item);
    }

    return {
      metadata: {
        version: backupData.metadata.version,
        createdAt: backupData.metadata.createdAt,
        appVersion: backupData.metadata.appVersion,
        vaultId: backupData.metadata.vaultId,
      },
      vault: {
        id: backupData.vault.id,
        version: backupData.vault.version,
        createdAt: backupData.vault.createdAt,
        updatedAt: backupData.vault.updatedAt,
        items,
        metadata: {
          version: backupData.vault.metadata.version,
          createdAt: backupData.vault.metadata.createdAt,
          updatedAt: backupData.vault.metadata.updatedAt,
        },
      },
    };
  }

  /**
   * Deserializes backup data from a plain object
   * 
   * @private
   */
  private deserializeBackup(serialized: SerializedBackup): BackupData {
    // Deserialize vault items
    const items = new Map();
    for (const [id, itemData] of Object.entries(serialized.vault.items)) {
      items.set(id, this.deserializeVaultItem(itemData));
    }

    const vault: Vault = {
      id: serialized.vault.id,
      version: serialized.vault.version,
      createdAt: serialized.vault.createdAt,
      updatedAt: serialized.vault.updatedAt,
      items,
      metadata: {
        version: serialized.vault.metadata.version,
        createdAt: serialized.vault.metadata.createdAt,
        updatedAt: serialized.vault.metadata.updatedAt,
      },
    };

    return {
      metadata: {
        version: serialized.metadata.version,
        createdAt: serialized.metadata.createdAt,
        appVersion: serialized.metadata.appVersion,
        vaultId: serialized.metadata.vaultId,
      },
      vault,
    };
  }

  /**
   * Serializes a vault item
   * 
   * Handles special serialization for document items with Uint8Array content
   * 
   * @private
   */
  private serializeVaultItem(item: unknown): Record<string, unknown> {
    const itemRecord = item as Record<string, unknown>;
    
    // Special handling for document items with Uint8Array content
    if (itemRecord['type'] === 'document' && itemRecord['content']) {
      const content = itemRecord['content'] as Record<string, unknown>;
      if (content['data'] instanceof Uint8Array) {
        return {
          ...itemRecord,
          content: {
            ...content,
            data: Array.from(content['data'] as Uint8Array), // Convert Uint8Array to regular array
          },
        };
      }
    }
    
    return itemRecord;
  }

  /**
   * Deserializes a vault item
   * 
   * Handles special deserialization for document items with array content
   * 
   * @private
   */
  private deserializeVaultItem(data: Record<string, unknown>): unknown {
    // Special handling for document items with array content
    if (data['type'] === 'document' && data['content']) {
      const content = data['content'] as Record<string, unknown>;
      if (Array.isArray(content['data'])) {
        return {
          ...data,
          content: {
            ...content,
            data: new Uint8Array(content['data'] as number[]), // Convert array back to Uint8Array
          },
        };
      }
    }
    
    return data;
  }

  /**
   * Converts bytes to base64 string
   * 
   * @private
   */
  private bytesToBase64(bytes: Uint8Array): string {
    const binString = Array.from(bytes, (byte) => String.fromCodePoint(byte)).join('');
    return btoa(binString);
  }

  /**
   * Converts base64 string to bytes
   * 
   * @private
   */
  private base64ToBytes(base64: string): Uint8Array {
    const binString = atob(base64);
    return Uint8Array.from(binString, (char) => char.codePointAt(0) ?? 0);
  }
}

/**
 * Factory function to create a new BackupService instance
 */
export function createBackupService(cryptoEngine: CryptoEngine): BackupService {
  return new BackupService(cryptoEngine);
}
