/**
 * Demo script per Password Manager
 * 
 * Questo script dimostra le funzionalità principali dell'applicazione
 */

import { DefaultCryptoEngine } from './src/crypto/crypto-engine';
import { createVaultManager } from './src/vault/vault-manager';
import { deriveKeyFromPassword } from './src/utils/crypto-utils';
import { PasswordGenerator } from './src/password/password-generator';
import { createBackupService } from './src/backup/backup-service';
import { PasswordItem } from './src/types/vault';
import { createSearchEngine } from './src/search/search-engine';

async function demo() {
  console.log('🔐 Password Manager Demo\n');

  // 1. Setup crittografico
  console.log('1️⃣  Inizializzazione sistema crittografico...');
  const cryptoEngine = new DefaultCryptoEngine();
  const pin = '123456';
  const salt = cryptoEngine.generateSalt();
  const masterKey = await deriveKeyFromPassword(pin, salt);
  console.log('✅ Sistema crittografico inizializzato\n');

  // 2. Creazione vault
  console.log('2️⃣  Creazione vault...');
  const vaultManager = createVaultManager(cryptoEngine);
  await vaultManager.createVault(masterKey);
  console.log('✅ Vault creato\n');

  // 3. Generazione password
  console.log('3️⃣  Generazione password sicura...');
  const passwordGenerator = new PasswordGenerator();
  const generatedPassword = passwordGenerator.generate({
    length: 16,
    includeUppercase: true,
    includeLowercase: true,
    includeNumbers: true,
    includeSymbols: true,
    excludeSimilar: false,
    excludeAmbiguous: false,
  });
  console.log(`✅ Password generata: ${generatedPassword}\n`);

  // 4. Aggiunta password al vault
  console.log('4️⃣  Aggiunta password al vault...');
  const passwordItem: PasswordItem = {
    id: crypto.randomUUID(),
    type: 'password',
    title: 'GitHub',
    username: 'user@example.com',
    password: generatedPassword,
    url: 'https://github.com',
    notes: 'Account principale',
    tags: ['development', 'important'],
    history: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  
  const itemId = await vaultManager.addItem(passwordItem, masterKey);
  console.log(`✅ Password aggiunta con ID: ${itemId}\n`);

  // 5. Ricerca nel vault
  console.log('5️⃣  Ricerca nel vault...');
  const vault = await vaultManager.loadVault(masterKey);
  const searchEngine = createSearchEngine();
  const searchResults = searchEngine.search(Array.from(vault.items.values()), {
    query: 'github',
  });
  console.log(`✅ Trovati ${searchResults.length} risultati`);
  if (searchResults.length > 0) {
    const result = searchResults[0];
    const item = result?.item as PasswordItem;
    console.log(`   - ${item.title} (${item.username})\n`);
  }

  // 6. Backup del vault
  console.log('6️⃣  Creazione backup crittografato...');
  const backupService = createBackupService(cryptoEngine);
  const backup = await backupService.createBackup(vault, masterKey);
  console.log('✅ Backup creato');
  console.log(`   - Versione: ${backup.metadata.version}`);
  console.log(`   - Data: ${new Date(backup.metadata.createdAt).toLocaleString()}`);
  console.log(`   - Vault ID: ${backup.metadata.vaultId}\n`);

  // 7. Export backup
  console.log('7️⃣  Export backup su file...');
  const backupFile = backupService.exportBackupToFile(backup);
  console.log(`✅ Backup esportato (${backupFile.length} caratteri)\n`);

  // 8. Restore backup
  console.log('8️⃣  Restore da backup...');
  const importedBackup = backupService.importBackupFromFile(backupFile);
  const restored = await backupService.restoreBackup(importedBackup, masterKey);
  console.log('✅ Backup ripristinato');
  console.log(`   - Items nel vault: ${restored.vault.items.size}\n`);

  // 9. Statistiche finali
  console.log('📊 Statistiche finali:');
  console.log(`   - Password salvate: ${vault.items.size}`);
  console.log(`   - Versione vault: ${vault.version}`);
  console.log(`   - Crittografia: AES-256-GCM`);
  console.log(`   - Backup disponibili: 1\n`);

  console.log('✨ Demo completata con successo!');
}

// Esegui demo
demo().catch(error => {
  console.error('❌ Errore durante la demo:', error);
  process.exit(1);
});
