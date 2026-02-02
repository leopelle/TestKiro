# Backup Scheduler Implementation

## Overview

This document describes the implementation of the scheduled backup functionality for the Password Manager application, fulfilling requirements 8.3 and 8.5.

## Requirements

- **8.3**: Implement scheduled backups (daily, weekly, monthly)
- **8.5**: Implement version management (max 10 backups)

## Architecture

### BackupScheduler Class

The `BackupScheduler` class manages automatic backup creation and version management.

#### Key Features

1. **Scheduling**: Supports daily, weekly, and monthly backup frequencies
2. **Version Management**: Automatically maintains a maximum number of backups (default: 10)
3. **Backup Storage**: Manages stored backups with metadata
4. **Configuration**: Flexible configuration for frequency, enabled state, and max backups

### Components

```typescript
// Backup frequency options
enum BackupFrequency {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

// Configuration
interface BackupScheduleConfig {
  frequency: BackupFrequency;
  enabled: boolean;
  maxBackups: number;
}

// Stored backup with metadata
interface StoredBackup {
  id: string;
  backup: EncryptedBackup;
  createdAt: Timestamp;
  frequency: BackupFrequency;
}
```

## Implementation Details

### Scheduling Logic

The scheduler determines when backups should be created based on:

1. **Last Backup Time**: Tracks when the last backup was created
2. **Frequency Interval**: Calculates required interval based on frequency
   - Daily: 24 hours
   - Weekly: 7 days
   - Monthly: 30 days
3. **Enabled State**: Only creates backups when enabled

```typescript
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
```

### Version Management (Requirement 8.5)

The scheduler enforces a maximum backup limit:

1. **Automatic Cleanup**: When a new backup is created, oldest backups are removed if limit is exceeded
2. **Configurable Limit**: Default is 10 backups, but can be customized
3. **Sorted Storage**: Backups are sorted by creation time for efficient cleanup

```typescript
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
```

### Backup Creation

Creating a scheduled backup:

1. Uses `BackupService` to create encrypted backup
2. Generates unique backup ID
3. Stores backup with metadata
4. Updates last backup time
5. Enforces version limit

```typescript
async createScheduledBackup(
  vault: Vault,
  backupKey: CryptoKey
): Promise<StoredBackup> {
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
}
```

## Usage Examples

### Basic Usage

```typescript
import { createBackupScheduler, BackupFrequency } from './backup/backup-scheduler';
import { createBackupService } from './backup/backup-service';

// Create backup service
const backupService = createBackupService(cryptoEngine);

// Create scheduler with default config (daily, max 10 backups)
const scheduler = createBackupScheduler(backupService);

// Start the scheduler
scheduler.start();

// Create a backup manually
const vault = getVault();
const backupKey = getBackupKey();
const storedBackup = await scheduler.createScheduledBackup(vault, backupKey);

console.log(`Backup created: ${storedBackup.id}`);
```

### Custom Configuration

```typescript
// Create scheduler with custom config
const scheduler = createBackupScheduler(backupService, {
  frequency: BackupFrequency.WEEKLY,
  enabled: true,
  maxBackups: 5,
});

// Update configuration later
scheduler.updateConfig({
  frequency: BackupFrequency.MONTHLY,
  maxBackups: 15,
});
```

### Managing Backups

```typescript
// Get all stored backups (sorted newest first)
const backups = scheduler.getStoredBackups();

// Get specific backup by ID
const backup = scheduler.getBackupById('backup-123');

// Delete a backup
const deleted = scheduler.deleteBackup('backup-123');

// Get backup count
const count = scheduler.getBackupCount();

// Get last backup time
const lastTime = scheduler.getLastBackupTime();
```

### Loading Existing Backups

```typescript
// Load backups from storage
const existingBackups: StoredBackup[] = loadBackupsFromStorage();
scheduler.loadStoredBackups(existingBackups);

// Scheduler will automatically enforce version limit
```

## Testing

The implementation includes comprehensive unit tests covering:

1. **Configuration**: Default and custom configurations
2. **Scheduling Logic**: All frequency types and edge cases
3. **Backup Creation**: Creating and storing backups
4. **Version Management**: Enforcing max backup limits
5. **Backup Retrieval**: Getting backups by ID and listing all
6. **Backup Deletion**: Removing specific backups
7. **Backup Loading**: Loading existing backups
8. **Scheduler Control**: Starting and stopping the scheduler
9. **Edge Cases**: Empty lists, single backup limit, unique IDs

### Test Coverage

- 32 unit tests
- All tests passing
- Coverage of all public methods
- Edge case testing

## Integration with Existing System

The scheduler integrates with the existing backup system:

1. **Uses BackupService**: Delegates actual backup creation to `BackupService`
2. **Encrypted Backups**: All backups are encrypted using the existing encryption system
3. **Metadata**: Includes all required metadata (version, creation date, vault ID)
4. **Error Handling**: Uses existing error codes and error handling patterns

## Future Enhancements

Potential improvements for future versions:

1. **Persistent Storage**: Save scheduler state and backups to disk
2. **Backup Callbacks**: Event system for backup creation/deletion
3. **Backup Rotation Strategies**: More sophisticated rotation (e.g., keep daily for 7 days, weekly for 4 weeks, monthly for 12 months)
4. **Backup Compression**: Compress backups to save space
5. **Backup Verification**: Periodic verification of backup integrity
6. **Cloud Sync**: Optional cloud backup synchronization
7. **Backup Notifications**: Notify users when backups are created or fail

## Compliance

This implementation fulfills:

- ✅ **Requirement 8.3**: Scheduled backups (daily, weekly, monthly)
- ✅ **Requirement 8.5**: Version management (max 10 backups)
- ✅ **Property 22**: Scheduling Backup Automatici (to be tested with property-based tests)
- ✅ **Property 23**: Invariante Gestione Versioni Backup (to be tested with property-based tests)
