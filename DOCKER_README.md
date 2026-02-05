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

### Verifica health status
```bash
docker-compose ps
docker inspect password-manager-app | grep -A 10 Health
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

## 🔒 Sicurezza Docker

### Miglioramenti implementati:
- ✅ Container eseguito come utente non-root
- ✅ Health check automatico ogni 30 secondi
- ✅ Security headers avanzati (CSP, Referrer-Policy, Permissions-Policy)
- ✅ Rate limiting per prevenire abusi
- ✅ Network isolato per il container
- ✅ Read-only filesystem dove possibile
- ✅ Tmpfs per directory temporanee
- ✅ No new privileges flag
- ✅ Server tokens disabilitati

### Nota sulla Sicurezza

⚠️ **Questa è una versione DEMO**

Per un ambiente di produzione:
- Usa HTTPS con certificati SSL validi (Let's Encrypt)
- Implementa crittografia AES-256-GCM reale
- Usa un backend sicuro per gestire le credenziali
- Implementa autenticazione a due fattori (2FA)
- Non usare localStorage per dati sensibili in produzione
- Configura firewall e reverse proxy (Traefik, Nginx Proxy Manager)
- Usa secrets management (Docker Secrets, Vault)

## 🐳 Configurazione Avanzata

### Porta personalizzata
Modifica `docker-compose.yml`:
```yaml
ports:
  - "3000:80"  # Cambia 3000 con la porta desiderata
```

### HTTPS con certificati SSL
Aggiungi in `docker-compose.yml`:
```yaml
volumes:
  - ./ssl:/etc/nginx/ssl:ro
ports:
  - "443:443"
```

E aggiorna `nginx.conf` per includere la configurazione SSL.

### Volume per persistenza (opzionale)
Aggiungi in `docker-compose.yml`:
```yaml
volumes:
  - ./data:/data
```

### Variabili d'ambiente personalizzate
```yaml
environment:
  - TZ=Europe/Rome
  - NGINX_HOST=yourdomain.com
  - NGINX_PORT=80
```

## 📊 Monitoraggio

### Verifica stato container
```bash
docker ps
docker-compose ps
```

### Statistiche risorse
```bash
docker stats password-manager-app
```

### Ispeziona container
```bash
docker inspect password-manager-app
```

### Verifica logs in tempo reale
```bash
docker-compose logs -f --tail=100
```

### Verifica health check
```bash
docker inspect --format='{{json .State.Health}}' password-manager-app | jq
```

## 🛠️ Troubleshooting

### Porta già in uso
Se la porta 8080 è già occupata, cambia la porta in `docker-compose.yml`

### Container non si avvia
```bash
docker-compose logs password-manager
docker inspect password-manager-app
```

### Problemi di permessi
```bash
# Ricostruisci con permessi corretti
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Ricostruisci da zero
```bash
docker-compose down
docker system prune -a
docker volume prune
docker-compose up -d --build
```

### Health check fallisce
```bash
# Verifica che nginx sia in esecuzione
docker exec password-manager-app ps aux | grep nginx

# Testa manualmente
docker exec password-manager-app wget -O- http://localhost/
```

## 🚀 Deploy in Produzione

### Con Docker Swarm
```bash
docker stack deploy -c docker-compose.yml password-manager
```

### Con Kubernetes
Converti il docker-compose in manifesti K8s:
```bash
kompose convert -f docker-compose.yml
kubectl apply -f .
```

### Con Traefik (reverse proxy)
Aggiungi labels in `docker-compose.yml`:
```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.password-manager.rule=Host(`password.example.com`)"
  - "traefik.http.routers.password-manager.entrypoints=websecure"
  - "traefik.http.routers.password-manager.tls.certresolver=letsencrypt"
```

## 📝 Note

- I dati sono salvati nel localStorage del browser
- Ogni browser ha il suo storage separato
- Per cancellare i dati, usa il pulsante nelle Impostazioni
- Il backup scarica un file `.vault` crittografato
- Il container usa un utente non-root per maggiore sicurezza
- Health check verifica automaticamente lo stato dell'applicazione

## 🎯 Prossimi Passi

1. ✅ Configura HTTPS per abilitare Touch ID/Face ID
2. ✅ Aggiungi un backend per sincronizzazione cloud
3. ✅ Implementa crittografia end-to-end reale
4. ✅ Aggiungi autenticazione a due fattori (2FA)
5. ✅ Configura backup automatici
6. ✅ Implementa monitoring e alerting
7. ✅ Setup CI/CD pipeline

## 📚 Risorse Utili

- [Docker Documentation](https://docs.docker.com/)
- [Nginx Security Best Practices](https://nginx.org/en/docs/http/ngx_http_ssl_module.html)
- [OWASP Security Headers](https://owasp.org/www-project-secure-headers/)
- [Let's Encrypt](https://letsencrypt.org/)
