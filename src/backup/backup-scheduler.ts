/**
 * Backup Scheduler Implementation
 * 
 * This module provides scheduled backup functionality with version management.
 * 
 * Requirements:
 * - 8.3: Implement scheduled backups (daily, weekly, monthly)
 * - 8.5: Implement version management (max 10 backups)
 */

import { BackupService, EncryptedBackup } from './backup-service';
import { Vault } from '../vault/vault-manager';
import { PasswordManagerError, ErrorCode, Timestamp } from '../types/common';

/**
 * Backup schedule frequency options
 */
export enum BackupFrequency {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

/**
 * Backup schedule configuration
 */
export interface BackupScheduleConfig {
  readonly frequency: BackupFrequency;
  readonly enabled: boolean;
  readonly maxBackups: number; // Default: 10
}

/**
 * Stored backup with metadata
 */
export interface StoredBackup {
  readonly id: string;
  readonly backup: EncryptedBackup;
  readonly createdAt: Timestamp;
  readonly frequency: BackupFrequency;
}

/**
 * Backup scheduler for managing automatic backups
 * 
 * Requirements:
 * - 8.3: Schedule backups (daily, weekly, monthly)
 * - 8.5: Maintain max 10 backup versions
 */
export class BackupScheduler {
  private backupService: BackupService;
  private config: BackupScheduleConfig;
  private storedBackups: StoredBackup[] = [];
  private timerId: NodeJS.Timeout | null = null;
  private lastBackupTime: Timestamp | null = null;

  constructor(
    backupService: BackupService,
    config: BackupScheduleConfig = {
      frequency: BackupFrequency.DAILY,
      enabled: true,
      maxBackups: 10,
    }
  ) {
    this.backupService = backupService;
    this.config = config;
  }

  /**
   * Starts the backup scheduler
   * 
   * Requirement 8.3: Schedule backups according to frequency
   */
  start(): void {
    if (!this.config.enabled) {
      return;
    }

    // Stop any existing timer
    this.stop();

    // Calculate check interval (check every hour for simplicity)
    const checkInterval = 60 * 60 * 1000; // 1 hour in milliseconds

    // Set up periodic check
    this.timerId = setInterval(() => {
      this.checkAndCreateBackup();
    }, checkInterval);
  }

  /**
   * Stops the backup scheduler
   */
  stop(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  /**
   * Checks if a backup should be created and creates it if needed
   * 
   * @private
   */
  private checkAndCreateBackup(): void {
    if (!this.shouldCreateBackup()) {
      return;
    }

    // Note: In a real implementation, this would trigger a callback
    // to get the vault and backup key from the application
    // For now, this is just the scheduling logic
  }

  /**
   * Determines if a backup should be created based on schedule
   * 
   * Requirement 8.3: Schedule backups according to frequency
   * 
   * @returns true if a backup should be created
   */
  shouldCreateBackup(currentTime: Timestamp = Date.now()): boolean {
    if (!this.config.enabled) {
      return false;
    }

    if (this.lastBackupTime === null) {
      return true;
    }

    const timeSinceLastBackup = currentTime - this.lastBackupTime;
    const requiredInterval = this.getRequiredInterval();

    return timeSinceLastBackup >= requiredInterval;
  }

  /**
   * Gets the required interval in milliseconds for the configured frequency
   * 
   * @private
   */
  private getRequiredInterval(): number {
    switch (this.config.frequency) {
      case BackupFrequency.DAILY:
        return 24 * 60 * 60 * 1000; // 24 hours
      case BackupFrequency.WEEKLY:
        return 7 * 24 * 60 * 60 * 1000; // 7 days
      case BackupFrequency.MONTHLY:
        return 30 * 24 * 60 * 60 * 1000; // 30 days
      default:
        return 24 * 60 * 60 * 1000; // Default to daily
    }
  }

  /**
   * Creates a scheduled backup
   * 
   * Requirements:
   * - 8.3: Create backup according to schedule
   * - 8.5: Manage versions (max 10 backups)
   * 
   * @param vault - The vault to backup
   * @param backupKey - The encryption key for the backup
   * @returns Promise resolving to the stored backup
   */
  async createScheduledBackup(
    vault: Vault,
    backupKey: CryptoKey
  ): Promise<StoredBackup> {
    try {
      // Create the backup
      const backup = await this.backupService.createBackup(vault, backupKey);

      // Create stored backup record
      const storedBackup: StoredBackup = {
        id: this.generateBackupId(),
        backup,
        createdAt: Date.now(),
        frequency: this.config.frequency,
      };

      // Add to stored backups
      this.storedBackups.push(storedBackup);

      // Update last backup time
      this.lastBackupTime = storedBackup.createdAt;

      // Enforce version limit
      this.enforceBackupLimit();

      return storedBackup;
    } catch (error) {
      throw new PasswordManagerError(
        ErrorCode.ENCRYPTION_FAILED,
        `Failed to create scheduled backup: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Enforces the maximum backup limit by removing oldest backups
   * 
   * Requirement 8.5: Maintain max 10 backup versions
   * 
   * @private
   */
  private enforceBackupLimit(): void {
    const maxBackups = this.config.maxBackups;

    if (this.storedBackups.length <= maxBackups) {
      return;
    }

    // Sort by creation time (oldest first)
    this.storedBackups.sort((a, b) => a.createdAt - b.createdAt);

    // Remove oldest backups to maintain limit
    const backupsToRemove = this.storedBackups.length - maxBackups;
    this.storedBackups.splice(0, backupsToRemove);
  }

  /**
   * Gets all stored backups
   * 
   * @returns Array of stored backups, sorted by creation time (newest first)
   */
  getStoredBackups(): StoredBackup[] {
    // Return a copy sorted by creation time (newest first)
    return [...this.storedBackups].sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Gets a specific backup by ID
   * 
   * @param id - The backup ID
   * @returns The stored backup or undefined if not found
   */
  getBackupById(id: string): StoredBackup | undefined {
    return this.storedBackups.find(backup => backup.id === id);
  }

  /**
   * Deletes a specific backup by ID
   * 
   * @param id - The backup ID to delete
   * @returns true if backup was deleted, false if not found
   */
  deleteBackup(id: string): boolean {
    const index = this.storedBackups.findIndex(backup => backup.id === id);
    
    if (index === -1) {
      return false;
    }

    this.storedBackups.splice(index, 1);
    return true;
  }

  /**
   * Gets the current backup count
   * 
   * @returns Number of stored backups
   */
  getBackupCount(): number {
    return this.storedBackups.length;
  }

  /**
   * Updates the scheduler configuration
   * 
   * @param config - New configuration
   */
  updateConfig(config: Partial<BackupScheduleConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };

    // Restart scheduler if it was running
    if (this.timerId) {
      this.start();
    }
  }

  /**
   * Gets the current configuration
   * 
   * @returns Current backup schedule configuration
   */
  getConfig(): BackupScheduleConfig {
    return { ...this.config };
  }

  /**
   * Gets the last backup time
   * 
   * @returns Timestamp of last backup or null if no backups created
   */
  getLastBackupTime(): Timestamp | null {
    return this.lastBackupTime;
  }

  /**
   * Sets the last backup time (useful for testing or initialization)
   * 
   * @param time - Timestamp to set
   */
  setLastBackupTime(time: Timestamp | null): void {
    this.lastBackupTime = time;
  }

  /**
   * Loads stored backups from an array
   * 
   * @param backups - Array of stored backups to load
   */
  loadStoredBackups(backups: StoredBackup[]): void {
    this.storedBackups = [...backups];
    this.enforceBackupLimit();

    // Update last backup time
    if (this.storedBackups.length > 0) {
      const latest = this.storedBackups.reduce((latest, backup) =>
        backup.createdAt > latest.createdAt ? backup : latest
      );
      this.lastBackupTime = latest.createdAt;
    }
  }

  /**
   * Generates a unique backup ID
   * 
   * @private
   */
  private generateBackupId(): string {
    return `backup-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}

/**
 * Factory function to create a new BackupScheduler instance
 */
export function createBackupScheduler(
  backupService: BackupService,
  config?: BackupScheduleConfig
): BackupScheduler {
  return new BackupScheduler(backupService, config);
}
