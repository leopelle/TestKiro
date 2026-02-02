# Backup Restore Implementation

## Overview

This document describes the implementation of the backup restore functionality for the Password Manager application, completing task 12.2.

## Requirements

**Requirement 8.2**: QUANDO l'utente ripristina da backup, IL Sistema DEVE richiedere la password del backup e validare l'integrità

## Implementation

### Core Functionality

The restore functionality is implemented in the `BackupService.restoreBackup()` method with comprehensive integrity validation:

```typescript
async restoreBackup(
  encryptedBackup: EncryptedBackup,
  backupKey: CryptoKey
): Promise<BackupData>
```

### Integrity Validation Steps

The restore process performs multiple layers of validation to ensure data integrity:

1. **Input Validation**
   - Validates backup structure has required fields (encryptedData, metadata)
   - Ensures no null or undefined values

2. **Decryption with Authentication**
   - Uses AES-256-GCM which provides built-in authentication via auth tag
   - Wrong password or tampered data will fail decryption
   - Protects against unauthorized access and data corruption

3. **Backup Structure Validation**
   - Validates metadata structure (version, createdAt, appVersion, vaultId)
   - Validates vault structure (id, items, metadata)
   - Ensures all required fields are present and have correct types

4. **Version Compatibility Check**
   - Rejects backups from future versions
   - Ensures backward compatibility

5. **Vault ID Consistency Check**
   - Validates vault ID in data matches vault ID in metadata
   - Detects data corruption or tampering

6. **Vault Structure Validation**
   - Validates vault has required fields
   - Validates items is a Map
   - Validates vault metadata structure

### Error Handling

The implementation provides specific error messages for different failure scenarios:

- `INVALID_DATA_FORMAT`: Invalid backup structure or missing fields
- `DECRYPTION_FAILED`: Wrong password or corrupted encrypted data
- `FILE_CORRUPTED`: Integrity check failed (vault ID mismatch)

### Security Features

1. **Password Protection**
   - Backup can only be decrypted with the correct backup key
   - Key is derived from user's backup password

2. **Authenticated Encryption**
   - AES-GCM mode provides both confidentiality and authenticity
   - Detects any tampering with encrypted data

3. **Comprehensive Validation**
   - Multiple validation layers catch various corruption scenarios
   - Fails fast with clear error messages

## Testing

### Unit Tests

The implementation includes 25 comprehensive unit tests covering:

- **Happy Path Tests**
  - Successful restore from encrypted backup
  - Correct restoration of all vault items
  - Correct restoration of metadata
  - Round-trip backup and restore

- **Security Tests**
  - Rejection with wrong decryption key
  - Integrity validation

- **Validation Tests**
  - Rejection of backups with missing encryptedData
  - Rejection of backups with missing metadata
  - Rejection of backups with invalid metadata structure
  - Rejection of backups with vault ID mismatch
  - Rejection of backups with unsupported version
  - Rejection of backups with invalid vault structure

- **Edge Cases**
  - Multiple items in vault
  - Special characters in data
  - Empty vaults

### Test Coverage

All tests pass successfully, validating:
- ✅ Decryption with backup password
- ✅ Integrity validation at multiple levels
- ✅ Error handling for various failure scenarios
- ✅ Data preservation through backup/restore cycle

## Usage Example

```typescript
// Create backup service
const backupService = createBackupService(cryptoEngine);

// Create a backup
const backup = await backupService.createBackup(vault, backupKey);

// Export to file
const fileContent = backupService.exportBackupToFile(backup);

// Later: Import from file
const importedBackup = backupService.importBackupFromFile(fileContent);

// Restore with password
try {
  const restored = await backupService.restoreBackup(importedBackup, backupKey);
  console.log('Backup restored successfully');
  console.log('Vault ID:', restored.vault.id);
  console.log('Items count:', restored.vault.items.size);
} catch (error) {
  if (error.code === ErrorCode.DECRYPTION_FAILED) {
    console.error('Wrong password or corrupted backup');
  } else if (error.code === ErrorCode.FILE_CORRUPTED) {
    console.error('Backup integrity check failed');
  }
}
```

## Validation Checklist

- ✅ Implements importazione (import functionality)
- ✅ Implements validazione integrità (integrity validation)
- ✅ Implements decifratura con password backup (decryption with backup password)
- ✅ Validates backup structure
- ✅ Validates version compatibility
- ✅ Validates vault ID consistency
- ✅ Provides clear error messages
- ✅ Comprehensive unit tests
- ✅ All tests passing
- ✅ No TypeScript errors

## Related Files

- `src/backup/backup-service.ts` - Main implementation
- `src/backup/backup-service.test.ts` - Unit tests
- `docs/backup-system-implementation.md` - Backup creation documentation

## Conclusion

Task 12.2 is complete. The restore functionality provides secure, validated restoration of vault backups with comprehensive integrity checking and clear error handling.
