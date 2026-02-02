# Password Manager - Docker Deployment

## 🚀 Avvio Rapido

### 1. Build e avvio con Docker Compose
```bash
docker-compose up -d --build
```

### 2. Accedi all'applicazione
Apri il browser e vai su:
```
http://localhost:8080
```

### 3. Login
- **PIN Demo:** 123456

## 📦 Comandi Docker

### Avvia l'applicazione
```bash
docker-compose up -d
```

### Ferma l'applicazione
```bash
docker-compose down
```

### Visualizza i log
```bash
docker-compose logs -f
```

### Ricostruisci l'immagine
```bash
docker-compose up -d --build
```

### Rimuovi tutto (inclusi volumi)
```bash
docker-compose down -v
```

## 🔧 Build manuale con Docker

### Build dell'immagine
```bash
docker build -t password-manager:latest .
```

### Esegui il container
```bash
docker run -d -p 8080:80 --name password-manager password-manager:latest
```

### Ferma il container
```bash
docker stop password-manager
docker rm password-manager
```

## 🌐 Accesso all'applicazione

Una volta avviato, l'applicazione sarà disponibile su:
- **URL:** http://localhost:8080
- **PIN:** 123456

## ✨ Funzionalità

- 🔑 **Gestione Password** - Salva e organizza password
- 💳 **Carte di Credito** - Gestisci carte con validazione Luhn
- 📄 **Documenti** - Carica documenti (patente, passaporto, ecc.)
- 🔍 **Ricerca Universale** - Cerca in tutti i dati
- 🎲 **Generatore Password** - Crea password sicure
- 💾 **Backup Crittografato** - Esporta i tuoi dati
- ⚙️ **Impostazioni** - Cambia PIN e gestisci il vault
- 🔐 **Touch ID / Face ID** - Autenticazione biometrica (richiede HTTPS)

## 🔒 Nota sulla Sicurezza

⚠️ **Questa è una versione DEMO**

Per un ambiente di produzione:
- Usa HTTPS con certificati SSL validi
- Implementa crittografia AES-256-GCM reale
- Usa un backend sicuro per gestire le credenziali
- Implementa rate limiting e protezione CSRF
- Non usare localStorage per dati sensibili in produzione

## 🐳 Configurazione Docker

### Porta personalizzata
Modifica `docker-compose.yml`:
```yaml
ports:
  - "3000:80"  # Cambia 3000 con la porta desiderata
```

### Volume per persistenza (opzionale)
Aggiungi in `docker-compose.yml`:
```yaml
volumes:
  - ./data:/data
```

## 📊 Monitoraggio

### Verifica stato container
```bash
docker ps
```

### Statistiche risorse
```bash
docker stats password-manager-app
```

### Ispeziona container
```bash
docker inspect password-manager-app
```

## 🛠️ Troubleshooting

### Porta già in uso
Se la porta 8080 è già occupata, cambia la porta in `docker-compose.yml`

### Container non si avvia
```bash
docker-compose logs password-manager
```

### Ricostruisci da zero
```bash
docker-compose down
docker system prune -a
docker-compose up -d --build
```

## 📝 Note

- I dati sono salvati nel localStorage del browser
- Ogni browser ha il suo storage separato
- Per cancellare i dati, usa il pulsante nelle Impostazioni
- Il backup scarica un file `.vault` crittografato

## 🎯 Prossimi Passi

1. Configura HTTPS per abilitare Touch ID/Face ID
2. Aggiungi un backend per sincronizzazione cloud
3. Implementa crittografia end-to-end reale
4. Aggiungi autenticazione a due fattori (2FA)
