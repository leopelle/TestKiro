# Implementazione Autenticazione Biometrica (WebAuthn)

## Panoramica

Il Password Manager implementa l'autenticazione biometrica utilizzando l'API Web Authentication (WebAuthn). Questo consente agli utenti di sbloccare il vault tramite Touch ID, Face ID o altri autenticatori biometrici della piattaforma, offrendo un'alternativa al PIN numerico.

## Requisiti Implementati

- **Requisito 7.1**: Protezioni runtime per sicurezza avanzata
- **Task 16.1**: Implementazione protezioni runtime

## Architettura

### Flusso di Configurazione

```
Utente → Impostazioni → "Configura Touch ID"
    │
    ▼
checkBiometricAvailability()
    │
    ├── WebAuthn non supportato → Messaggio errore
    │
    └── WebAuthn disponibile
         │
         ▼
    setupBiometric()
         │
         ├── navigator.credentials.create()
         │     (Prompt biometrico del sistema)
         │
         └── Salva credenziali in localStorage
              ├── credential.id
              ├── credential.rawId
              └── PIN associato (per sblocco vault)
```

### Flusso di Login Biometrico

```
Schermata Login → Pulsante biometrico visibile
    │
    ▼
handleBiometricLogin()
    │
    ├── Genera challenge casuale (32 byte)
    │
    ├── navigator.credentials.get()
    │     (Prompt biometrico del sistema)
    │
    └── Verifica assertion
         │
         └── Sblocca vault con PIN salvato
```

## Implementazione

### Rilevamento Disponibilità

Al caricamento dell'applicazione, viene verificata la disponibilità dell'autenticazione biometrica:

```javascript
async function checkBiometricAvailability() {
  // Verifica supporto WebAuthn
  if (!window.PublicKeyCredential) return;

  // Verifica autenticatore della piattaforma
  const available = await PublicKeyCredential
    .isUserVerifyingPlatformAuthenticatorAvailable();

  if (available) {
    const biometricCredential = storage.load('biometric_credential');
    if (biometricCredential) {
      // Mostra pulsante biometrico nel login
      // Adatta etichetta alla piattaforma
    }
  }
}
```

### Adattamento Piattaforma

L'etichetta del pulsante biometrico si adatta automaticamente:

| Piattaforma | Icona | Testo |
|-------------|-------|-------|
| macOS | 👆 | Sblocca con Touch ID |
| iOS | 👤 | Sblocca con Face ID |
| Altro | 🔐 | Sblocca con Biometria |

Rilevamento:
```javascript
const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
```

### Registrazione Credenziali

```javascript
async function setupBiometric() {
  const challenge = new Uint8Array(32);
  crypto.getRandomValues(challenge);

  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: challenge,
      rp: {
        name: "Password Manager",
        id: window.location.hostname
      },
      user: {
        id: new Uint8Array(16),
        name: "user@passwordmanager.local",
        displayName: "Password Manager User"
      },
      pubKeyCredParams: [
        { alg: -7, type: "public-key" },    // ES256
        { alg: -257, type: "public-key" }    // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",   // Solo autenticatori integrati
        userVerification: "required"           // Richiede verifica utente
      },
      timeout: 60000,
      attestation: "none"
    }
  });

  // Salva credenziali
  storage.save('biometric_credential', {
    id: credential.id,
    rawId: Array.from(new Uint8Array(credential.rawId)),
    pin: state.currentPIN
  });
}
```

### Autenticazione

```javascript
async function handleBiometricLogin() {
  const biometricCredential = storage.load('biometric_credential');
  const challenge = new Uint8Array(32);
  crypto.getRandomValues(challenge);

  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: challenge,
      rpId: window.location.hostname,
      allowCredentials: [{
        id: new Uint8Array(biometricCredential.rawId),
        type: 'public-key'
      }],
      userVerification: "required",
      timeout: 60000
    }
  });

  if (assertion) {
    // Sblocca vault con PIN associato
    state.masterKey = { pin: biometricCredential.pin, timestamp: Date.now() };
    state.currentPIN = biometricCredential.pin;
    state.isLocked = false;
    showScreen('main-screen');
  }
}
```

### Rimozione Biometria

```javascript
function removeBiometric() {
  storage.remove('biometric_credential');
  // Nascondi pulsante nel login
  // Aggiorna stato nelle impostazioni
}
```

## Interfaccia Utente

### Schermata Login

Il pulsante biometrico appare sotto il form PIN (visibile solo se configurato):

```html
<button id="biometric-btn" class="btn btn-secondary btn-biometric">
  <span id="biometric-icon">🔐</span>
  <span id="biometric-text">Sblocca con Touch ID</span>
</button>
```

### Impostazioni

Sezione "Sicurezza" con stato e azioni:

```html
<p><strong>Autenticazione Biometrica:</strong>
  <span id="biometric-status">Non configurata</span>
</p>
<button onclick="setupBiometric()">🔐 Configura Touch ID / Face ID</button>
<button onclick="removeBiometric()">Rimuovi Autenticazione Biometrica</button>
```

## Gestione Errori

| Errore | Causa | Gestione |
|--------|-------|----------|
| `NotAllowedError` | Utente ha annullato il prompt | Messaggio "Autenticazione annullata" |
| WebAuthn non disponibile | Browser non supportato | Pulsante non mostrato |
| Piattaforma non disponibile | Dispositivo senza biometria | Pulsante non mostrato |
| Credenziali non trovate | Non ancora configurato | Pulsante non mostrato nel login |

## Persistenza

Le credenziali biometriche sono salvate in `localStorage` con chiave `biometric_credential`:

```json
{
  "id": "credential-base64-id",
  "rawId": [/* array di byte */],
  "pin": "123456"
}
```

## Limitazioni e Note di Sicurezza

- **HTTPS richiesto**: WebAuthn funziona solo su contesti sicuri (HTTPS o localhost)
- **PIN in chiaro**: Nella versione demo, il PIN è salvato in chiaro nel localStorage insieme alle credenziali biometriche. In produzione, dovrebbe essere crittografato
- **Challenge statico**: La challenge non viene verificata lato server. In produzione, dovrebbe essere generata e verificata dal backend
- **Singolo utente**: L'implementazione supporta un solo utente per browser/dispositivo
