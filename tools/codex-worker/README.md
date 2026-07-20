# Codex worker (laptop)

Mini HTTP service that runs `codex exec` on your **laptop** so the Atlassian CD Manager BFF (on the app host) can improve story fields without installing Codex on the server.

Listens on `127.0.0.1:9876` by default. The worker itself always runs on the laptop (`make pi`); it is **not** started on the VM.

The story form shows an **AI disponible / no disponible** badge via `GET /api/ai/status` on the BFF (probes this worker's `/health` through the SSH reverse tunnel).

## Prerequisites

- Node.js 22+ (nvm recommended; repo `.nvmrc`)
- Codex CLI installed and logged in on this laptop (`codex login` / org SSO)
- SSH access from this laptop to the **app host** (where the BFF runs)
- `CODEX_WORKER_TOKEN` in `server/.env` on the laptop **and** the same value on the app host

## Setup

```bash
cd tools/codex-worker
npm install
```

Ensure laptop `server/.env` (repo root) contains at least:

```env
CODEX_WORKER_TOKEN=generate-a-long-random-secret
```

### Foreground (from repo root, on the laptop)

```bash
make pi
```

### Auto-start at login (macOS LaunchAgent)

```bash
make pi-install    # install + start
make pi-status     # LaunchAgent + curl /health
make pi-health     # curl http://127.0.0.1:9876/health
make pi-logs       # tail ~/Library/Logs/atlassian-cd-manager/
make pi-stop       # stop
make pi-start      # start / restart
make pi-uninstall  # remove LaunchAgent
```

`make pi-install` writes `~/Library/LaunchAgents/com.atlassian-cd-manager.codex-worker.plist` from `launchd/*.plist.template` and runs `scripts/run-worker.sh` (loads nvm + `server/.env`).

Optional env:

| Variable | Default | Description |
|---|---|---|
| `CODEX_WORKER_TOKEN` | (required) | Bearer token; must match app host `server/.env` |
| `CODEX_WORKER_PORT` | `9876` | Listen port |
| `CODEX_WORKER_HOST` | `127.0.0.1` | Bind address (keep localhost) |

Health check (laptop):

```bash
curl -s http://127.0.0.1:9876/health
```

## SSH reverse tunnel (recommended)

Publish the laptop worker on the **same host that runs the BFF** as `127.0.0.1:9876`:

```bash
ssh -N -R 127.0.0.1:9876:127.0.0.1:9876 user@APP_HOST
```

Example:

```bash
ssh -N -R 127.0.0.1:9876:127.0.0.1:9876 itp@develop-5.intechpartner.com
```

With autossh:

```bash
autossh -M 0 -N -o ServerAliveInterval=30 -o ServerAliveCountMax=3 \
  -R 127.0.0.1:9876:127.0.0.1:9876 user@APP_HOST
```

After this, the BFF on that host can call `http://127.0.0.1:9876` directly.

**No local-forward tunnel on the VM is required** when the app/BFF runs on the SSH destination of the `-R`. A second `ssh -L` is only needed if the BFF lives on a *different* machine than the reverse-tunnel target (legacy Pi-as-bridge topology).

### BFF env (on the app host)

```env
CODEX_WORKER_URL=http://127.0.0.1:9876
CODEX_WORKER_TOKEN=generate-a-long-random-secret
```

Restart the BFF after changing env. Then:

```bash
curl -s http://127.0.0.1:9876/health
curl -s http://localhost:3000/api/ai/status
```

## Optional: Pi as bridge (two hosts)

Only if the BFF is **not** on the same machine as the `-R` target:

1. Laptop → Pi: `ssh -N -R 127.0.0.1:9876:127.0.0.1:9876 user@PI_HOST`
2. App VM → Pi: `ssh -N -L 127.0.0.1:9876:127.0.0.1:9876 user@PI_HOST`

## Compliance note

Codex traffic leaves from the **laptop**, not the app host. Confirm this is acceptable for your organization.

## API

`GET /health` → `{ "ok": true }`

`POST /improve` with header `Authorization: Bearer <token>`:

```json
{
  "fields": ["summary"],
  "summary": "...",
  "componentName": "ELFOS",
  "valor": "...",
  "projectKey": "CDPM",
  "projectName": "...",
  "issueTypeName": "Historia",
  "unOptionValue": "Sin Asignación"
}
```

Response:

```json
{
  "improvedValue": "Como … quiero … para …"
}
```
