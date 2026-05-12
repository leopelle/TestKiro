# Password Manager App

Un password manager sicuro, local-first, con crittografia end-to-end costruito in TypeScript.

## Funzionalità

- **Sicurezza Local-First**: Tutti i dati crittografati localmente, mai trasmessi a server esterni
- **Crittografia AES-256**: Crittografia di livello militare per tutti i dati sensibili
- **Cross-Platform**: Funziona su piattaforme mobile e web
- **Interfaccia Web Moderna**: UI card-based con dark mode, toolbar contestuale e click-to-copy
- **Property-Based Testing**: Test completi con fast-check per garanzie di correttezza
- **Gestione Memoria Sicura**: Cancellazione automatica dei dati sensibili dalla memoria
- **Autenticazione Biometrica**: Supporto Touch ID / Face ID tramite WebAuthn
- **Deployment Docker**: Container hardened con Nginx, security headers e rate limiting

## Architettura di Sicurezza

- **Zero-Knowledge**: Nessun dato sensibile lascia mai il dispositivo
- **Autenticazione PIN**: PIN di 4-8 cifre con protezione lockout
- **PBKDF2 Key Derivation**: 100.000 iterazioni per derivazione chiave robusta
- **Memoria Sicura**: Cancellazione automatica di chiavi crittografiche e dati sensibili
- **Operazioni Constant-Time**: Protezione contro attacchi timing

## Sviluppo

### Prerequisiti

- Node.js 18+ 
- TypeScript 5+
- Jest per testing
- Docker e Docker Compose (opzionale, per deployment)

### Setup

```bash
npm install
npm run build
npm test
```

### Avvio Interfaccia Web

```bash
# Con Docker
docker-compose up -d --build
# Apri http://localhost:8080

# Senza Docker (server Node.js)
npm run web
```

### Testing

Il progetto utilizza un approccio di testing duale:

- **Unit Tests**: Esempi specifici e casi limite
- **Property-Based Tests**: Proprietà universali verificate su tutti gli input

```bash
npm test              # Esegui tutti i test
npm run test:watch    # Modalità watch
npm run test:coverage # Report di copertura
```

### Testing di Sicurezza

I property-based test validano proprietà di sicurezza critiche:

- Integrità round-trip crittografico
- Correttezza derivazione chiave
- Efficacia cancellazione memoria
- Resistenza ad attacchi timing

## Architettura

```
src/                              # Backend TypeScript
├── types/                        # Definizioni tipi e interfacce
├── utils/                        # Utility (memoria sicura, crypto helpers)
├── crypto/                       # Motore crittografico
├── auth/                         # Servizio autenticazione
├── vault/                        # Gestione vault
├── password/                     # Generatore password
├── creditcard/                   # Validazione carte di credito
├── document/                     # Gestione documenti
├── autofill/                     # Compilazione automatica
├── search/                       # Motore di ricerca
└── backup/                       # Sistema backup e ripristino

web/                              # Frontend Web
├── index.html                    # Struttura HTML (SPA)
├── app.js                        # Logica applicativa JavaScript
└── styles.css                    # Stili CSS con dark mode
```

## Documentazione

La documentazione tecnica dettagliata è disponibile nella cartella `docs/`:

### Interfaccia Web e Infrastruttura
- [Implementazione Interfaccia Web](docs/web-ui-implementation.md) — UI card-based, toolbar, ricerca, filtri
- [Dark Mode e Theming](docs/dark-mode-theming-implementation.md) — Sistema di temi con CSS Custom Properties
- [Autenticazione Biometrica](docs/biometric-authentication-implementation.md) — WebAuthn, Touch ID, Face ID
- [Sicurezza Docker e Deployment](docs/docker-security-implementation.md) — Nginx, security headers, rate limiting

### Backend TypeScript
- [Motore Crittografico](docs/backup-system-implementation.md) — AES-256-GCM, PBKDF2
- [Generatore Password](docs/password-generator-implementation.md) — Generazione e validazione password
- [Storico Password](docs/password-history-implementation.md) — Gestione versioni password
- [Validazione Carte di Credito](docs/creditcard-validation-implementation.md) — Algoritmo Luhn, mascheramento
- [Notifiche Scadenza](docs/expiry-notifications-implementation.md) — Avvisi scadenza carte
- [Gestione Documenti](docs/document-loader-implementation.md) — Upload, validazione, tag
- [Sistema Tag](docs/tag-system-implementation.md) — Organizzazione con tag personalizzati
- [Motore di Ricerca](docs/search-engine-implementation.md) — Ricerca universale multi-campo
- [Servizio Autofill](docs/autofill-service-implementation.md) — Compilazione automatica credenziali
- [URL Matcher](docs/url-matcher-implementation.md) — Riconoscimento URL per autofill
- [Clipboard Manager](docs/clipboard-manager-implementation.md) — Copia sicura con auto-cancellazione
- [Sistema Backup](docs/backup-restore-implementation.md) — Backup e ripristino crittografato
- [Scheduler Backup](docs/backup-scheduler-implementation.md) — Backup automatici programmati
- [Sincronizzazione Cross-Platform](docs/cross-platform-sync-implementation.md) — Import/export sicuro
- [Auto-Lock](docs/auto-lock-implementation.md) — Blocco automatico per inattività
- [Tipi Vault](docs/vault-types-implementation.md) — Modelli dati e validazione

## Docker

Per il deployment con Docker, consultare il [Docker README](DOCKER_README.md) con istruzioni complete per build, avvio e configurazione avanzata.

## Licenza

MIT License - vedi file LICENSE per dettagli.

## Avviso di Sicurezza

Questo software gestisce dati sensibili. Si prega di esaminare il codice e le pratiche di sicurezza prima dell'uso in ambienti di produzione. L'interfaccia web attuale utilizza crittografia simulata (base64) — per la produzione è necessario integrare la crittografia AES-256-GCM reale tramite Web Crypto API.