# Dax Deployment Guide

## Quick Start

### Prerequisites
- Node.js 20+ (22 recommended)
- Ollama running locally (`ollama serve`)
- At least one LLM pulled: `ollama pull qwen3.5:0.8b`

### Desktop (Electron)

```bash
cd dax
npm install
npm run build         # Build renderer + package Electron app
npm start             # Launch Electron app
```

### Web Server Mode

Run Dax as a standalone HTTP + WebSocket server. No Electron required.

```bash
cd dax
npm install
npm run build:renderer   # Build frontend
npm run web              # Start server on port 3800
```

Open `http://localhost:3800` in your browser.

**Custom port:**
```bash
node src/main/web-server.js --port 4200
```

---

## Production Deployment

### Reverse Proxy (nginx)

For exposing Dax on the internet, always put it behind a reverse proxy with TLS.

```nginx
server {
    listen 443 ssl http2;
    server_name dax.example.com;

    ssl_certificate     /etc/ssl/certs/dax.crt;
    ssl_certificate_key /etc/ssl/private/dax.key;

    location / {
        proxy_pass http://127.0.0.1:3800;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 600s;  # LLM calls can be slow
    }
}
```

### systemd Service (Linux)

```ini
[Unit]
Description=Dax AI Agent Platform
After=network.target ollama.service

[Service]
Type=simple
User=dax
WorkingDirectory=/opt/dax
ExecStart=/usr/bin/node src/main/web-server.js --port 3800
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
Environment=DAX_USER_DATA=/var/lib/dax

[Install]
WantedBy=multi-user.target
```

### Windows Service

Use [nssm](https://nssm.cc/) or pm2:

```powershell
npm install -g pm2
pm2 start src/main/web-server.js --name dax -- --port 3800
pm2 save
pm2 startup
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DAX_USER_DATA` | `%APPDATA%/dax` (Win) `~/.config/dax` (Linux) | Data directory (DB, logs, models, backups) |
| `NODE_ENV` | `development` | Set to `production` for prod |

---

## Data Directories

All persistent data lives under `DAX_USER_DATA`:

```
dax/
├── dax.db           # SQLite database (agents, runs, settings)
├── service.lock     # Process lock file
├── logs/
│   ├── dax-service-2026-04-06.log
│   └── dax-web-2026-04-06.log
├── backups/
│   ├── dax-2026-04-06T01-00-00-000Z.db   # Auto-backup (kept: last 5)
│   └── ...
├── models/          # Downloaded .gguf model files
└── plugins/         # Custom plugin scripts
```

### Backup Strategy

Dax automatically backs up the database:
- **On every startup** — snapshot before any migrations run
- **Every 24 hours** — periodic backup while running
- **Retention** — keeps the 5 most recent backups, deletes older ones

To manually backup:
```bash
cp %APPDATA%/dax/dax.db ./dax-backup-$(date +%F).db
```

### Log Rotation

Logs are automatically rotated on startup:
- Files older than **7 days** are deleted
- Total log size is capped at **50 MB**
- Each day creates a new log file (`dax-service-YYYY-MM-DD.log`)

---

## Webhook Server

The webhook server runs on a separate port (default 3700, configurable via settings).

```
POST http://localhost:3700/webhook/:agentId/:token
```

- Binds to `127.0.0.1` by default
- Rate limited: 60 requests per minute per agent
- Body size limit: 1 MB
- No CORS headers (server-to-server only)

To expose webhooks externally, proxy through nginx on a specific path.

---

## Security Checklist

- [ ] Put web server behind TLS (nginx/Caddy)
- [ ] Set strong webhook tokens (auto-generated, but rotate periodically)
- [ ] Don't expose webhook port directly to the internet
- [ ] Keep Ollama on localhost only
- [ ] Review integration credentials in Settings
- [ ] Monitor logs for suspicious activity: `tail -f %APPDATA%/dax/logs/dax-service-*.log`

---

## Scaling Considerations

| Metric | Limit | Notes |
|--------|-------|-------|
| Concurrent agent runs | ~10 | Limited by Ollama throughput and RAM |
| Database size | ~500 MB | sql.js loads entire DB into memory |
| Integrations | 500 built-in | Can add more via plugins |
| Webhook throughput | 60 req/min per agent | Configurable in code |
| Model context | 4096 default | Configurable per agent via `token_budget` |

For high-throughput scenarios (>50 concurrent agents), consider:
- Running multiple Ollama instances on different ports
- Using cloud LLM providers (OpenAI, Anthropic) for some agents
- Splitting agents across multiple Dax instances

---

## Updating

### Electron App
Auto-updates via `electron-updater` when published to GitHub Releases.

### Web Server
```bash
git pull
npm install
npm run build:renderer
# Restart the server
pm2 restart dax
```

### Database Migrations
Migrations run automatically on startup. The `_migrations` table tracks which migrations have been applied. If a migration fails, the service will not start — check logs for details.
