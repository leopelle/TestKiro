# Implementazione Dark Mode e Sistema di Theming

## Panoramica

Il sistema di theming del Password Manager consente all'utente di scegliere tra tre modalità di visualizzazione: chiaro, scuro e automatico. L'implementazione utilizza CSS Custom Properties (variabili CSS) e l'attributo `data-theme` sull'elemento HTML root per applicare i temi senza ricaricare la pagina.

## Requisiti Implementati

- **Requisito 5.2**: Interfaccia desktop responsive con esperienza utente ottimizzata
- **Task 15.2**: Funzionalità avanzate web

## Architettura

### Flusso del Tema

```
Utente seleziona tema
       │
       ▼
  setTheme(theme)
       │
       ├── Salva in localStorage
       │
       └── applyTheme(theme)
              │
              ├── theme="light" → data-theme="light"
              ├── theme="dark"  → data-theme="dark"
              └── theme="auto"  → matchMedia → data-theme="light|dark"
```

### Ciclo di Vita del Tema

1. **Caricamento pagina** → `loadTheme()` legge il tema dal localStorage (default: `auto`)
2. **Selezione utente** → `setTheme()` salva e applica immediatamente
3. **Cambio sistema** → MediaQuery listener aggiorna il tema se in modalità `auto`

## Implementazione

### CSS Custom Properties

Le variabili CSS sono definite su `:root` con override per il tema scuro:

```css
/* Tema chiaro (default) */
:root {
  --primary-color: #4f46e5;
  --primary-hover: #4338ca;
  --secondary-color: #6b7280;
  --danger-color: #ef4444;
  --success-color: #10b981;
  --background: #f9fafb;
  --surface: #ffffff;
  --text-primary: #111827;
  --text-secondary: #6b7280;
  --border: #e5e7eb;
  --shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 25px rgba(0, 0, 0, 0.1);
}

/* Tema scuro */
[data-theme="dark"] {
  --primary-color: #6366f1;
  --primary-hover: #4f46e5;
  --secondary-color: #9ca3af;
  --danger-color: #f87171;
  --success-color: #34d399;
  --background: #111827;
  --surface: #1f2937;
  --text-primary: #f9fafb;
  --text-secondary: #9ca3af;
  --border: #374151;
  --shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  --shadow-lg: 0 10px 25px rgba(0, 0, 0, 0.5);
}
```

### Funzioni JavaScript

```javascript
function loadTheme() {
  const savedTheme = storage.load('theme') || 'auto';
  applyTheme(savedTheme);
  updateThemeSelector(savedTheme);
}

function setTheme(theme) {
  storage.save('theme', theme);
  applyTheme(theme);
}

function applyTheme(theme) {
  const html = document.documentElement;
  if (theme === 'dark') {
    html.setAttribute('data-theme', 'dark');
  } else if (theme === 'light') {
    html.setAttribute('data-theme', 'light');
  } else {
    // Auto: segue preferenze di sistema
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    html.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  }
}
```

### Listener per Cambio di Sistema

```javascript
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  const currentTheme = storage.load('theme') || 'auto';
  if (currentTheme === 'auto') {
    applyTheme('auto');
  }
});
```

### Interfaccia Utente

Il selettore tema è integrato nella schermata Impostazioni con tre opzioni radio:

```html
<div class="theme-selector">
  <label class="theme-option">
    <input type="radio" name="theme" value="light" onchange="setTheme('light')">
    <span>☀️ Chiaro</span>
  </label>
  <label class="theme-option">
    <input type="radio" name="theme" value="dark" onchange="setTheme('dark')">
    <span>🌙 Scuro</span>
  </label>
  <label class="theme-option">
    <input type="radio" name="theme" value="auto" onchange="setTheme('auto')">
    <span>🔄 Automatico</span>
  </label>
</div>
```

### Stili del Selettore

```css
.theme-option {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: var(--background);
  border: 2px solid var(--border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.theme-option:hover {
  border-color: var(--primary-color);
}

.theme-option input[type="radio"]:checked + span {
  color: var(--primary-color);
  font-weight: 600;
}
```

## Mappa dei Colori

| Variabile | Chiaro | Scuro | Uso |
|-----------|--------|-------|-----|
| `--primary-color` | `#4f46e5` | `#6366f1` | Azioni primarie, tag, accenti |
| `--danger-color` | `#ef4444` | `#f87171` | Azioni distruttive, avvisi |
| `--success-color` | `#10b981` | `#34d399` | Conferme, feedback copia |
| `--background` | `#f9fafb` | `#111827` | Sfondo pagina |
| `--surface` | `#ffffff` | `#1f2937` | Sfondo card, modal, header |
| `--text-primary` | `#111827` | `#f9fafb` | Testo principale |
| `--text-secondary` | `#6b7280` | `#9ca3af` | Label, sottotitoli |
| `--border` | `#e5e7eb` | `#374151` | Bordi card, separatori |
| `--shadow` | `rgba(0,0,0,0.1)` | `rgba(0,0,0,0.3)` | Ombre card |

## Componenti Interessati

Tutti i componenti UI utilizzano le variabili CSS e si adattano automaticamente al cambio tema:

- **Login screen**: Gradiente di sfondo fisso, card con sfondo `--surface`
- **Header**: Sfondo `--surface` con bordo `--border`
- **Card unificate**: Sfondo `--surface`, bordo `--border`, testo `--text-primary`
- **Modal**: Overlay scuro con contenuto su `--surface`
- **Pulsanti**: Colori primario, secondario, pericolo dalle variabili
- **Form**: Input con bordo `--border` e focus `--primary-color`
- **Dropdown**: Sfondo `--surface` con hover `--background`

## Persistenza

- Il tema selezionato è salvato in `localStorage` con chiave `theme`
- Valori possibili: `"light"`, `"dark"`, `"auto"`
- Default: `"auto"` (segue preferenze di sistema)
- Il tema viene caricato al boot dell'applicazione tramite `initializeApp() → loadTheme()`
