# Password Manager - Web Application

Interfaccia web per il Password Manager con crittografia locale.

## Avvio Rapido

1. **Avvia il server web:**
   ```bash
   npm run web
   ```

2. **Apri il browser:**
   ```
   http://localhost:3000
   ```

3. **Accedi con il PIN demo:**
   ```
   PIN: 123456
   ```

## Funzionalità

### ✅ Implementate
- 🔐 **Login con PIN** - Autenticazione sicura con PIN numerico (4-8 cifre)
- 📝 **Gestione Password** - Aggiungi, modifica, elimina password
- 🔍 **Ricerca Universale** - Cerca per titolo, username, URL, note o tag
- 🎲 **Generatore Password** - Genera password sicure casuali
- 📋 **Copia negli Appunti** - Copia username/password con auto-cancellazione (30s)
- 🏷️ **Tag e Organizzazione** - Organizza password con tag personalizzati
- 💾 **Backup Crittografato** - Esporta backup del vault
- 📱 **Design Responsive** - Funziona su desktop e mobile

### 🔄 Storage
- I dati sono salvati nel **localStorage** del browser
- In produzione, i dati sarebbero crittografati con AES-256-GCM
- Attualmente usa crittografia simulata per demo

## Struttura File

```
web/
├── index.html      # Interfaccia utente principale
├── styles.css      # Stili e design
├── app.js          # Logica applicazione
├── server.js       # Server HTTP semplice
└── README.md       # Questa documentazione
```

## Schermate

### 1. Login
- Inserisci PIN numerico (4-8 cifre)
- Demo PIN: `123456`

### 2. Dashboard Principale
- Lista di tutte le password salvate
- Barra di ricerca in tempo reale
- Pulsanti per aggiungere password, backup e logout

### 3. Aggiungi/Modifica Password
- Campi: Titolo, Username, Password, URL, Note, Tag
- Generatore password integrato
- Visualizza/nascondi password

### 4. Backup
- Visualizza statistiche vault
- Scarica backup crittografato

## Note di Sicurezza

⚠️ **Questa è una versione DEMO per scopi dimostrativi**

In un ambiente di produzione:
- Usare crittografia AES-256-GCM reale
- Implementare PBKDF2 per derivazione chiavi
- Usare HTTPS per tutte le comunicazioni
- Implementare Content Security Policy
- Proteggere contro XSS e CSRF
- Usare storage crittografato invece di localStorage

## Sviluppo Futuro

### Integrazioni Backend
Per connettere questa UI al backend TypeScript:

1. **Bundler** - Usare webpack/vite per importare moduli TypeScript
2. **API Bridge** - Creare API layer tra frontend e backend
3. **Web Workers** - Eseguire crittografia in background
4. **IndexedDB** - Storage più robusto di localStorage

### Esempio Integrazione:
```javascript
import { DefaultCryptoEngine } from '../src/crypto/crypto-engine';
import { createVaultManager } from '../src/vault/vault-manager';

const cryptoEngine = new DefaultCryptoEngine();
const vaultManager = createVaultManager(cryptoEngine);
```

## Comandi Utili

```bash
# Avvia server web
npm run web

# Compila TypeScript backend
npm run build

# Esegui demo backend
npm run demo

# Esegui test
npm test
```

## Browser Supportati

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

Richiede supporto per:
- ES6+ JavaScript
- LocalStorage API
- Clipboard API
- Crypto API (per produzione)
