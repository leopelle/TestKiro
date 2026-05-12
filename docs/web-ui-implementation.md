# Implementazione Interfaccia Web

## Panoramica

L'interfaccia web del Password Manager è un'applicazione single-page (SPA) costruita con HTML5, CSS3 e JavaScript vanilla. L'applicazione fornisce un'interfaccia desktop responsive per la gestione di password, carte di credito e documenti personali, con supporto per dark mode, autenticazione biometrica e operazioni click-to-copy.

## Requisiti Implementati

- **Requisito 5.2**: Interfaccia desktop responsive con layout adattivo
- **Requisito 5.1**: Interfaccia touch-friendly ottimizzata (responsive mobile)
- **Requisito 2.1**: Salvataggio e organizzazione password con titolo, username, password, URL e note
- **Requisito 3.1**: Salvataggio carte di credito con numero, titolare, scadenza, CVV e note
- **Requisito 4.1**: Salvataggio documenti con supporto per testo, immagini e PDF
- **Requisito 3.2**: Mascheramento numero carta mostrando solo le ultime 4 cifre
- **Requisito 3.4**: Validazione numero carta con algoritmo di Luhn
- **Requisito 3.5**: Avviso scadenza carta a 30 giorni
- **Requisito 6.4**: Copia negli appunti con auto-cancellazione dopo 30 secondi

## Architettura

### Struttura File

```
web/
├── index.html    # Struttura HTML dell'applicazione (SPA)
├── app.js        # Logica applicativa (~1800 righe)
└── styles.css    # Stili CSS con variabili e dark mode (~875 righe)
```

### Moduli Applicativi

`app.js` è organizzato in sezioni logiche:

| Sezione | Righe | Responsabilità |
|---------|-------|----------------|
| Stato e Utility | 1–74 | Stato globale, crypto (simulata), storage, generatore password |
| Inizializzazione | 76–197 | Boot dell'app, caricamento dati, setup event listeners |
| Autenticazione | 199–252 | Login/logout con PIN numerico |
| Lista Unificata | 254–393 | Rendering card-based con vista a griglia |
| Selezione e Azioni | 395–547 | Toolbar contestuale, copia, duplica, elimina |
| Gestione Password | 549–833 | CRUD password, ricerca, backup |
| Gestione Carte | 836–1129 | CRUD carte di credito, validazione Luhn, mascheramento |
| Gestione Documenti | 1131–1415 | CRUD documenti, upload immagini, anteprima |
| Impostazioni | 1418–1503 | Cambio PIN, cancellazione dati, statistiche vault |
| Autenticazione Biometrica | 1506–1725 | WebAuthn, Touch ID / Face ID |
| Tema / Dark Mode | 1728–1789 | Gestione tema chiaro/scuro/automatico |

### Gestione Stato

L'applicazione utilizza un oggetto `state` centralizzato:

```javascript
const state = {
  isLocked: true,         // Stato blocco vault
  masterKey: null,         // Chiave master derivata dal PIN
  vault: null,             // Riferimento al vault
  currentEditingId: null,  // ID elemento in modifica
  currentTab: 'all',       // Filtro attivo (all/passwords/cards/documents)
  currentPIN: null,        // PIN corrente per verifica
  passwords: [],           // Array password salvate
  cards: [],               // Array carte di credito
  documents: [],           // Array documenti
  selectedItem: null       // Elemento selezionato {id, type}
};
```

### Persistenza Dati

I dati sono salvati nel `localStorage` del browser tramite il modulo `storage`:

```javascript
const storage = {
  save(key, data)   // Serializza e salva in localStorage
  load(key)         // Carica e deserializza da localStorage
  remove(key)       // Rimuove una chiave
};
```

Chiavi utilizzate:
- `passwords` — Array degli elementi password
- `cards` — Array delle carte di credito
- `documents` — Array dei documenti
- `theme` — Preferenza tema (light/dark/auto)
- `biometric_credential` — Credenziali WebAuthn

## Funzionalità Implementate

### 1. Sistema di Autenticazione

#### Login con PIN
- Validazione formato PIN (4-8 cifre numeriche) tramite regex `^\d{4,8}$`
- Derivazione chiave master (simulata per la versione demo)
- Transizione automatica dalla schermata login alla schermata principale

#### Autenticazione Biometrica (WebAuthn)
- Rilevamento automatico disponibilità biometria al caricamento
- Configurazione Touch ID / Face ID tramite impostazioni
- Adattamento etichetta in base alla piattaforma (Mac → Touch ID, iOS → Face ID)
- Salvataggio credenziali WebAuthn nel localStorage
- Possibilità di rimuovere la configurazione biometrica

### 2. Vista a Griglia con Card (Business Card Layout)

L'interfaccia principale utilizza una griglia responsive di card, ognuna con layout standardizzato:

```
┌─────────────────────────────┐
│ 🔑  Titolo                  │
│     TIPO                    │
│─────────────────────────────│
│ User:   mario@example.com   │
│ Pass:   ••••••••            │
│ URL:    example.com         │
│─────────────────────────────│
│ [tag1] [tag2]               │
└─────────────────────────────┘
```

**Caratteristiche:**
- Griglia CSS con `grid-template-columns: repeat(auto-fill, minmax(320px, 1fr))`
- Altezza minima `180px` per uniformità visiva
- Effetto hover con `translateY(-4px)` e ombra aumentata
- Bordo evidenziato per l'elemento selezionato (`border-color: primary`)
- Tre layout specifici: `password-card`, `card-card`, `document-card`

### 3. Toolbar Contestuale

Barra strumenti che si attiva quando un elemento viene selezionato:

| Azione | Icona | Comportamento |
|--------|-------|---------------|
| Modifica | ✏️ | Apre il modal di modifica pre-compilato |
| Duplica | 📋 | Crea copia con suffisso " (copia)" e nuovo ID |
| Elimina | 🗑️ | Elimina con conferma `confirm()` |

I pulsanti sono disabilitati (`disabled`) finché nessun elemento è selezionato.

### 4. Click-to-Copy

Ogni campo valore nelle card è cliccabile per copiare il contenuto:

```javascript
function copyField(event, value) {
  navigator.clipboard.writeText(value).then(() => {
    element.classList.add('copied');           // Feedback visivo verde
    setTimeout(() => element.classList.remove('copied'), 1000);
    setTimeout(() => navigator.clipboard.writeText(''), 30000);  // Auto-clear 30s
  });
}
```

**Feedback visivo:** Il campo diventa verde (`--success-color`) per 1 secondo dopo la copia.
**Sicurezza:** Gli appunti vengono cancellati automaticamente dopo 30 secondi.

### 5. Menu Dropdown per Aggiunta

Il pulsante "+ Nuovo" apre un menu dropdown con tre opzioni:
- 🔑 Password
- 💳 Carta di Credito
- 📄 Documento

Il menu si chiude automaticamente cliccando fuori dal dropdown.

### 6. Ricerca e Filtri

#### Barra di Ricerca
Ricerca full-text in tempo reale su tutti i campi degli elementi:
- Titolo, username, URL, note
- Nome titolare, numero carta
- Numero documento, ente emittente
- Tag

#### Filtro per Tipo
Dropdown con opzioni:
- `Tutti` — Mostra tutti gli elementi
- `Password` — Solo password
- `Carte` — Solo carte di credito
- `Documenti` — Solo documenti

### 7. Gestione Password

- **Creazione**: Modal con campi titolo, username, password, URL, note, tag
- **Generazione automatica**: Password di 16 caratteri con maiuscole, minuscole, numeri e simboli
- **Visibilità toggle**: Pulsante per mostrare/nascondere la password nel form
- **Modifica**: Pre-compilazione del modal con dati esistenti
- **Eliminazione**: Con conferma utente

### 8. Gestione Carte di Credito

- **Validazione Luhn**: Verifica algoritmo mod-10 alla creazione
- **Mascheramento**: Visualizzazione `**** **** **** XXXX` (solo ultime 4 cifre)
- **Formattazione input**: Numero carta formattato automaticamente con spazi ogni 4 cifre
- **Scadenza**: Formattazione automatica `MM/AA` e avviso ⚠️ se scade entro 30 giorni
- **Copia sicura**: Numero carta e CVV copiabili con auto-cancellazione

### 9. Gestione Documenti

- **Tipi supportati**: Passaporto (🛂), Carta d'Identità (🪪), Patente (🚗), Altro (📄)
- **Upload immagini**: Supporto JPG, PNG, PDF con limite 5MB
- **Anteprima**: Preview inline dell'immagine caricata
- **Visualizzazione**: Apertura immagine in nuova finestra a schermo intero
- **Scadenza documenti**: Avviso ⚠️ per documenti in scadenza entro 30 giorni

### 10. Backup Crittografato

- Esportazione vault in formato `.vault` (JSON base64-encoded)
- Download automatico tramite creazione di Blob e link temporaneo
- Metadati: versione, data creazione, conteggio elementi

### 11. Impostazioni

- **Cambio PIN**: Verifica PIN corrente, validazione nuovo PIN, conferma
- **Statistiche Vault**: Conteggio password, carte, documenti
- **Autenticazione Biometrica**: Configurazione/rimozione Touch ID / Face ID
- **Selezione Tema**: Chiaro, scuro, automatico (segue preferenze di sistema)
- **Zona Pericolosa**: Cancellazione completa dati con conferma testuale "CANCELLA TUTTO"

## Design System

### Variabili CSS (Custom Properties)

Il design system utilizza variabili CSS per supportare il theming:

```css
:root {
  --primary-color: #4f46e5;    /* Indigo */
  --danger-color: #ef4444;     /* Rosso */
  --success-color: #10b981;    /* Verde */
  --background: #f9fafb;       /* Sfondo chiaro */
  --surface: #ffffff;          /* Superficie card */
  --text-primary: #111827;     /* Testo principale */
  --text-secondary: #6b7280;   /* Testo secondario */
  --border: #e5e7eb;           /* Bordi */
}
```

### Dark Mode

Varianti scure attivate tramite `[data-theme="dark"]`:

```css
[data-theme="dark"] {
  --background: #111827;
  --surface: #1f2937;
  --text-primary: #f9fafb;
  --border: #374151;
}
```

Tre modalità di tema:
1. **Chiaro** (`light`): Variabili CSS predefinite
2. **Scuro** (`dark`): Override con `data-theme="dark"`
3. **Automatico** (`auto`): Segue `prefers-color-scheme` del sistema operativo

Il tema viene persistito nel localStorage e applicato al caricamento.

### Responsive Design

Breakpoint principale a `768px`:

```css
@media (max-width: 768px) {
  .unified-list { grid-template-columns: 1fr; }  /* Card a colonna singola */
  .header-content { flex-direction: column; }     /* Header impilato */
}
```

### Componenti UI

| Componente | Classe CSS | Uso |
|------------|-----------|-----|
| Card unificata | `.unified-card` | Container elementi nella griglia |
| Modal | `.modal` / `.modal.active` | Dialog per creazione/modifica |
| Dropdown | `.dropdown-menu` / `.show` | Menu aggiunta elementi |
| Tag | `.tag` | Badge colorati per categorizzazione |
| Toolbar | `.toolbar` | Barra azioni contestuali |
| Pulsanti | `.btn-primary/secondary/danger` | Azioni primarie, secondarie, distruttive |

## Evoluzione dello Sviluppo

Lo sviluppo dell'interfaccia web è avvenuto in iterazioni successive:

### Iterazione 1: Setup Iniziale
- Schermata login con PIN numerico
- Struttura HTML base con modal per CRUD
- Stili CSS con variabili per theming

### Iterazione 2: Dark Mode e Sicurezza Docker
- Implementazione tema chiaro/scuro/automatico
- Selector tema nelle impostazioni
- Security headers Nginx (CSP, X-Frame-Options, etc.)
- Rate limiting e configurazione Docker hardened

### Iterazione 3: Vista Unificata a Card
- Sostituzione delle liste separate con griglia unificata
- Rendering card per tipo (password, carta, documento)
- Filtro dropdown per tipo di elemento
- Ricerca full-text su tutti i campi

### Iterazione 4: Menu Dropdown
- Sostituzione `prompt()` con menu dropdown per aggiunta elementi
- Chiusura automatica al click esterno

### Iterazione 5: Business Card Layout
- Layout compatto a griglia con dimensioni uniformi
- Header card con icona e tipo in maiuscolo
- Body con campi label/valore allineati
- Sezione tag con bordo separatore

### Iterazione 6: Toolbar Contestuale
- Selezione card con highlight visivo
- Toolbar con pulsanti Modifica, Duplica, Elimina
- Click-to-copy sui valori dei campi con feedback visivo
- Auto-cancellazione appunti dopo 30 secondi

## Note di Sicurezza

> **Versione Demo**: La crittografia nel frontend web è simulata (base64 encoding).
> Per un ambiente di produzione è necessario:
> - Implementare crittografia AES-256-GCM reale (Web Crypto API)
> - Non utilizzare localStorage per dati sensibili
> - Implementare HTTPS con certificati SSL validi
> - Aggiungere rate limiting lato applicazione
> - Implementare CSRF protection
