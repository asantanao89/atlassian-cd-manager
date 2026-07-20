# Codex worker (laptop)

Mini HTTP service that runs `codex exec` on your **laptop** so the Atlassian CD Manager BFF (on the VM) can improve story summaries without installing Codex on the VM.

Listens on `127.0.0.1:9876` by default.

The story form shows an **AI disponible / no disponible** badge via `GET /api/ai/status` on the BFF (probes this worker's `/health` through the SSH tunnels).

## Prerequisites

- Node.js 22+ (nvm recommended; repo `.nvmrc`)
- Codex CLI installed and logged in on this laptop (`codex login` / org SSO)
- SSH access from this laptop to the Raspberry Pi
- SSH access from the app VM to the same Pi
- `CODEX_WORKER_TOKEN` in `server/.env` (same value as on the VM)

## Setup

```bash
cd tools/codex-worker
npm install
```

Ensure `server/.env` (repo root) contains at least:

```env
CODEX_WORKER_TOKEN=generate-a-long-random-secret
```

### Foreground (from repo root)

```bash
make pi
```

### Auto-start at login (macOS LaunchAgent)

```bash
make pi-install    # install + start
make pi-status     # LaunchAgent + curl /health
make pi-logs       # tail ~/Library/Logs/atlassian-cd-manager/
make pi-stop       # stop
make pi-start      # start / restart
make pi-uninstall  # remove LaunchAgent
```

`make pi-install` writes `~/Library/LaunchAgents/com.atlassian-cd-manager.codex-worker.plist` from `launchd/*.plist.template` and runs `scripts/run-worker.sh` (loads nvm + `server/.env`).

Optional env:

| Variable | Default | Description |
|---|---|---|
| `CODEX_WORKER_TOKEN` | (required) | Bearer token; must match VM `server/.env` |
| `CODEX_WORKER_PORT` | `9876` | Listen port |
| `CODEX_WORKER_HOST` | `127.0.0.1` | Bind address (keep localhost) |

Health check:

```bash
curl -s http://127.0.0.1:9876/health
```

BFF status (on the VM, after tunnels):

```bash
curl -s http://localhost:3000/api/ai/status
```

## SSH tunnels (Pi as bridge)

Port **9876** end-to-end, bound only on localhost.

### 1. Laptop → Pi (reverse)

Expose the local worker on the Pi as `127.0.0.1:9876`:

```bash
ssh -N -R 127.0.0.1:9876:127.0.0.1:9876 user@PI_HOST
```

With autossh:

```bash
autossh -M 0 -N -o ServerAliveInterval=30 -o ServerAliveCountMax=3 \
  -R 127.0.0.1:9876:127.0.0.1:9876 user@PI_HOST
```

### 2. VM → Pi (local forward)

On the **VM** (where the BFF runs):

```bash
ssh -N -L 127.0.0.1:9876:127.0.0.1:9876 user@PI_HOST
```

Then the BFF can reach the worker at `http://127.0.0.1:9876`.

### 3. BFF env (`server/.env`)

```env
CODEX_WORKER_URL=http://127.0.0.1:9876
CODEX_WORKER_TOKEN=generate-a-long-random-secret
```

## Compliance note

Codex traffic leaves from the **laptop**, not the VM. Confirm this is acceptable for your organization.

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
