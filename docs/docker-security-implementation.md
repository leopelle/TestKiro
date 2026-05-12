# Implementazione Sicurezza Docker e Deployment

## Panoramica

L'infrastruttura Docker del Password Manager è configurata con un approccio security-first, utilizzando Nginx Alpine come base image, security headers avanzati, rate limiting e hardening del container. Il deployment avviene tramite Docker Compose con network isolato e health check automatici.

## Architettura di Deployment

```
┌─────────────────────────────────────────┐
│             Docker Host                 │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  password-manager-net (bridge)    │  │
│  │                                   │  │
│  │  ┌─────────────────────────────┐  │  │
│  │  │  password-manager-app       │  │  │
│  │  │  (nginx:alpine)             │  │  │
│  │  │                             │  │  │
│  │  │  Port 80 ← :8080 (host)    │  │  │
│  │  │                             │  │  │
│  │  │  /usr/share/nginx/html/     │  │  │
│  │  │    ├── index.html           │  │  │
│  │  │    ├── app.js               │  │  │
│  │  │    └── styles.css           │  │  │
│  │  └─────────────────────────────┘  │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

## Componenti

### Dockerfile

```dockerfile
FROM nginx:alpine

# Aggiornamenti di sicurezza
RUN apk update && apk upgrade && rm -rf /var/cache/apk/*

# File web
COPY web/ /usr/share/nginx/html/

# Configurazione Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80 443

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
```

**Scelte di sicurezza:**
- **Alpine Linux**: Immagine minimale (~5MB) con superficie di attacco ridotta
- **Aggiornamento pacchetti**: `apk update && apk upgrade` al build
- **Health check**: Verifica automatica ogni 30s con 3 tentativi

### Docker Compose

```yaml
version: '3.8'

services:
  password-manager:
    build:
      context: .
      dockerfile: Dockerfile
    image: password-manager:latest
    container_name: password-manager-app
    ports:
      - "8080:80"
    restart: unless-stopped
    volumes:
      - ./web:/usr/share/nginx/html:ro    # Mount read-only
    environment:
      - NGINX_HOST=localhost
      - NGINX_PORT=80
      - TZ=Europe/Rome
    networks:
      - password-manager-network
    security_opt:
      - no-new-privileges:true            # Previene privilege escalation
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost/"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 5s

networks:
  password-manager-network:
    driver: bridge
    name: password-manager-net
```

**Misure di sicurezza Docker Compose:**
- `no-new-privileges:true` — Previene l'escalation di privilegi nel container
- Volume `web/` montato in `:ro` (read-only)
- Network bridge dedicato e isolato
- `restart: unless-stopped` per alta disponibilità

### Configurazione Nginx

```nginx
# Rate limiting
limit_req_zone $binary_remote_addr zone=general:10m rate=10r/s;

server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:;" always;

    # Compressione
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_comp_level 6;

    # Nasconde versione server
    server_tokens off;

    # Rate limiting
    limit_req zone=general burst=20 nodelay;

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache asset statici
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Blocca file nascosti
    location ~ /\. {
        deny all;
    }
}
```

## Security Headers

| Header | Valore | Protezione |
|--------|--------|------------|
| `X-Frame-Options` | `SAMEORIGIN` | Previene clickjacking |
| `X-Content-Type-Options` | `nosniff` | Previene MIME sniffing |
| `X-XSS-Protection` | `1; mode=block` | Filtro XSS del browser |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limita informazioni referrer |
| `Permissions-Policy` | `geolocation=(), microphone=(), camera=()` | Disabilita API sensibili |
| `Content-Security-Policy` | `default-src 'self'; ...` | Previene injection di risorse esterne |

### Content Security Policy (CSP)

```
default-src 'self';           → Solo risorse dallo stesso dominio
script-src 'self' 'unsafe-inline';  → Script locali + inline (necessario per onclick handlers)
style-src 'self' 'unsafe-inline';   → Stili locali + inline
img-src 'self' data:;         → Immagini locali + data URI (per anteprima documenti)
font-src 'self' data:;        → Font locali + data URI
```

## Rate Limiting

- **Zona**: `general` con 10MB di memoria condivisa
- **Rate**: 10 richieste/secondo per indirizzo IP
- **Burst**: 20 richieste in burst senza delay
- **Protezione**: Previene attacchi brute-force e DDoS semplici

## Caching

- **Asset statici** (JS, CSS, immagini): Cache di 1 anno con `immutable`
- **Compressione Gzip**: Livello 6, minimo 1024 byte
- **Tipi compressi**: text/plain, text/css, text/xml, application/javascript, application/json

## Comandi Operativi

```bash
# Avvio
docker-compose up -d --build

# Stato
docker-compose ps
docker inspect password-manager-app | grep -A 10 Health

# Log
docker-compose logs -f --tail=100

# Statistiche risorse
docker stats password-manager-app

# Ricostruzione pulita
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## Considerazioni per la Produzione

Per un deployment in produzione, sono necessarie le seguenti integrazioni:

1. **HTTPS**: Certificati SSL tramite Let's Encrypt con reverse proxy
2. **Firewall**: Limitare accesso alla porta esposta
3. **Secrets Management**: Docker Secrets o HashiCorp Vault per credenziali
4. **Monitoring**: Prometheus + Grafana per metriche container
5. **Logging**: Centralizzazione log con ELK Stack o Loki
6. **Backup**: Strategia di backup per volumi persistenti
7. **Orchestrazione**: Docker Swarm o Kubernetes per scalabilità
