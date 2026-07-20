# Codex worker (laptop)

Mini HTTP service that runs `codex exec` on your **laptop** so the Atlassian CD Manager BFF (on the app host) can improve story fields without installing Codex on the server.

```
Laptop                          App host (BFF)
┌─────────────────────┐         ┌──────────────────────────┐
│ make pi / LaunchAgent│  -R    │ 127.0.0.1:9876 ─────────►│
│ worker :9876         │───────►│ CODEX_WORKER_URL=…:9876  │
│ Codex CLI            │  SSH   │ /api/ai/*                │
└─────────────────────┘         └──────────────────────────┘
```

- Worker **always** runs on the laptop (`make pi`). Do **not** run it on the VM/server.
- Publish it with an SSH **reverse** tunnel (`-R`) to the **same host** where the BFF runs.
- No `ssh -L` on the VM is required in that setup.
- UI badge **AI disponible / no disponible** comes from `GET /api/ai/status` on the BFF.

---

## Choose a setup

| Approach | Worker | Tunnel | Survives reboot / network drop | Best for |
|---|---|---|---|---|
| **A — Manual** | `make pi` in a terminal | `ssh -N -R …` in another | No | Quick test |
| **B — Auto (recommended)** | `make pi-install` (LaunchAgent) | LaunchAgent + `autossh` + shell aliases | Yes (login + reconnect) | Daily use |

You can mix (e.g. auto worker + manual tunnel).

---

## 1. Prerequisites (laptop)

- macOS (LaunchAgent steps) or any Unix for the manual path
- Node.js 22+ via nvm (repo `.nvmrc`)
- Repo clone with this project
- [Codex CLI](https://github.com/openai/codex) installed and logged in (`codex login` / org SSO)
- SSH key auth to the app host (no password prompt), e.g. `ssh user@APP_HOST 'echo ok'`
- For auto tunnel: Homebrew + `autossh`

```bash
brew install autossh
which autossh
# Apple Silicon: /opt/homebrew/bin/autossh
# Intel:        /usr/local/bin/autossh
```

---

## 2. Installations

From the **repo root on the laptop**:

```bash
npm --prefix tools/codex-worker install
mkdir -p ~/Library/Logs/atlassian-cd-manager
```

### Shared secret (`CODEX_WORKER_TOKEN`)

Same value in **both**:

1. Laptop: `server/.env` (repo root; read by `make pi` / LaunchAgent)
2. App host: `server/.env` next to the deployed BFF

```env
# Laptop server/.env (minimum for the worker)
CODEX_WORKER_TOKEN=generate-a-long-random-secret
# Optional: pin model for codex exec -m (omit to use CLI default)
# CODEX_MODEL=gpt-5.5

# App host server/.env
CODEX_WORKER_URL=http://127.0.0.1:9876
CODEX_WORKER_TOKEN=generate-a-long-random-secret
```
On the app host, restart the BFF after editing env:

```bash
sudo systemctl restart atlassian-cd-manager
```

Optional worker env:

| Variable | Default | Description |
|---|---|---|
| `CODEX_WORKER_TOKEN` | (required) | Bearer token |
| `CODEX_WORKER_PORT` | `9876` | Listen port |
| `CODEX_WORKER_HOST` | `127.0.0.1` | Bind address (keep localhost) |
| `CODEX_MODEL` | (unset) | If set, passed as `codex exec -m <MODEL>`. If unset, uses the Codex CLI default from your local config |

---

## 3. Option A — Manual (two terminals)

### 3.1 Worker (terminal 1)

```bash
cd /path/to/atlassian-cd-manager
make pi
# equivalent: tools/codex-worker/scripts/run-worker.sh
```

Check:

```bash
make pi-health
# or: curl -sf http://127.0.0.1:9876/health
# → {"ok":true}
```

Stop: `Ctrl+C` in that terminal.

### 3.2 Reverse tunnel (terminal 2)

Replace `user@APP_HOST` (example: `itp@develop-5.intechpartner.com`):

```bash
ssh -N \
  -o ServerAliveInterval=30 \
  -o ServerAliveCountMax=3 \
  -o ExitOnForwardFailure=yes \
  -R 127.0.0.1:9876:127.0.0.1:9876 \
  user@APP_HOST
```

With autossh (reconnects after network drops):

```bash
autossh -M 0 -N \
  -o ServerAliveInterval=30 \
  -o ServerAliveCountMax=3 \
  -o ExitOnForwardFailure=yes \
  -R 127.0.0.1:9876:127.0.0.1:9876 \
  user@APP_HOST
```

Stop: `Ctrl+C`.

### 3.3 Verify end-to-end

On the **app host**:

```bash
curl -s http://127.0.0.1:9876/health
curl -s http://localhost:3000/api/ai/status
# → "available": true
```

In the UI (Historias): badge **AI disponible**.

---

## 4. Option B — Automatic (LaunchAgents + aliases)

### 4.1 Worker LaunchAgent (via Make)

Files involved:

| Path | Role |
|---|---|
| [`scripts/run-worker.sh`](scripts/run-worker.sh) | Loads nvm + `server/.env`, runs `npm start` |
| [`launchd/com.atlassian-cd-manager.codex-worker.plist.template`](launchd/com.atlassian-cd-manager.codex-worker.plist.template) | Template |
| `~/Library/LaunchAgents/com.atlassian-cd-manager.codex-worker.plist` | Installed by Make |
| `~/Library/Logs/atlassian-cd-manager/codex-worker.{out,err}.log` | Logs |

```bash
cd /path/to/atlassian-cd-manager
make pi-install    # generate plist, bootstrap, kickstart
make pi-status     # LaunchAgent + health
make pi-health     # curl only
make pi-logs       # tail logs
make pi-stop       # unload
make pi-start      # load / restart
make pi-uninstall  # unload + delete plist
```

| Make target | What it does |
|---|---|
| `make pi` | Foreground worker (Option A) |
| `make pi-install` | Install + start LaunchAgent at login (`KeepAlive`) |
| `make pi-uninstall` | Remove LaunchAgent |
| `make pi-start` / `make pi-stop` | Start / stop without removing plist |
| `make pi-status` | Plist installed? + `launchctl print` + health |
| `make pi-health` | `curl http://127.0.0.1:9876/health` (exit 1 if down) |
| `make pi-logs` | Follow worker logs |

Equivalent low-level commands (if you prefer not to use Make for control):

```bash
launchctl print gui/$(id -u)/com.atlassian-cd-manager.codex-worker
launchctl bootout gui/$(id -u)/com.atlassian-cd-manager.codex-worker
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.atlassian-cd-manager.codex-worker.plist
launchctl kickstart -k gui/$(id -u)/com.atlassian-cd-manager.codex-worker
```

### 4.2 Tunnel LaunchAgent (manual plist; not in Make yet)

The tunnel is **not** installed by `make pi-install`. Create it once on the laptop.

1. Close any manual `ssh -R` / `autossh` using port 9876 (or free the port on the app host; see troubleshooting).
2. Create `~/Library/LaunchAgents/com.atlassian-cd-manager.codex-tunnel.plist`.

**Replace** `__USER__`, `__AUTOSSH__`, and `user@APP_HOST`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.atlassian-cd-manager.codex-tunnel</string>
  <key>ProgramArguments</key>
  <array>
    <string>__AUTOSSH__</string>
    <string>-M</string>
    <string>0</string>
    <string>-N</string>
    <string>-o</string>
    <string>ServerAliveInterval=30</string>
    <string>-o</string>
    <string>ServerAliveCountMax=3</string>
    <string>-o</string>
    <string>ExitOnForwardFailure=yes</string>
    <string>-R</string>
    <string>127.0.0.1:9876:127.0.0.1:9876</string>
    <string>user@APP_HOST</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/Users/__USER__/Library/Logs/atlassian-cd-manager/codex-tunnel.out.log</string>
  <key>StandardErrorPath</key>
  <string>/Users/__USER__/Library/Logs/atlassian-cd-manager/codex-tunnel.err.log</string>
</dict>
</plist>
```

Example values:

- `__USER__` → `asantana`
- `__AUTOSSH__` → `/opt/homebrew/bin/autossh`
- `user@APP_HOST` → `itp@develop-5.intechpartner.com`

> Do **not** leave placeholders like `TU_USUARIO` in log paths: launchd will fail with `EX_CONFIG` (exit 78) and the service stays in `spawn scheduled`.

3. Load it:

```bash
mkdir -p ~/Library/Logs/atlassian-cd-manager
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.atlassian-cd-manager.codex-tunnel.plist
launchctl kickstart -k gui/$(id -u)/com.atlassian-cd-manager.codex-tunnel
launchctl print gui/$(id -u)/com.atlassian-cd-manager.codex-tunnel | head -30
# expect: state = running, active count = 1
```

4. Unload / reload:

```bash
launchctl bootout gui/$(id -u)/com.atlassian-cd-manager.codex-tunnel
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.atlassian-cd-manager.codex-tunnel.plist
launchctl kickstart -k gui/$(id -u)/com.atlassian-cd-manager.codex-tunnel
```

### 4.3 Shell aliases for the tunnel

Add to `~/.zshrc` (or `~/.bashrc`):

```bash
# Atlassian CD Manager — SSH reverse tunnel LaunchAgent
alias pi-atlassian-tunnel-start='launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.atlassian-cd-manager.codex-tunnel.plist 2>/dev/null; launchctl kickstart -k gui/$(id -u)/com.atlassian-cd-manager.codex-tunnel'
alias pi-atlassian-tunnel-stop='launchctl bootout gui/$(id -u)/com.atlassian-cd-manager.codex-tunnel'
alias pi-atlassian-tunnel-status='launchctl print gui/$(id -u)/com.atlassian-cd-manager.codex-tunnel 2>/dev/null | sed -n "1,25p"; echo "Health (laptop worker):"; curl -sf --max-time 2 http://127.0.0.1:9876/health && echo || echo "unreachable"'
alias pi-atlassian-tunnel-logs='tail -n 80 -F ~/Library/Logs/atlassian-cd-manager/codex-tunnel.out.log ~/Library/Logs/atlassian-cd-manager/codex-tunnel.err.log'
```

```bash
source ~/.zshrc
```

| Alias | Action |
|---|---|
| `pi-atlassian-tunnel-start` | Bootstrap (if needed) + kickstart |
| `pi-atlassian-tunnel-stop` | Bootout (stop) |
| `pi-atlassian-tunnel-status` | `launchctl print` + local worker health |
| `pi-atlassian-tunnel-logs` | Follow tunnel logs |

Optional shortcuts for the worker via Make (adjust the repo path):

```bash
alias pi-atlassian-worker-status='make -C ~/Utilities/apps/atlassian-cd-manager pi-status'
alias pi-atlassian-worker-health='make -C ~/Utilities/apps/atlassian-cd-manager pi-health'
```

---

## 5. Control cheat sheet

| Goal | Manual | Auto |
|---|---|---|
| Start worker | `make pi` | `make pi-install` or `make pi-start` |
| Stop worker | Ctrl+C | `make pi-stop` |
| Worker status | `make pi-health` | `make pi-status` |
| Start tunnel | `ssh -N -R …` or `autossh …` | `pi-atlassian-tunnel-start` |
| Stop tunnel | Ctrl+C | `pi-atlassian-tunnel-stop` |
| Tunnel status | — | `pi-atlassian-tunnel-status` |
| App host health | `curl http://127.0.0.1:9876/health` on host | same |
| BFF AI status | `curl http://localhost:3000/api/ai/status` on host | same |

---

## 6. App host (BFF) checklist

```env
CODEX_WORKER_URL=http://127.0.0.1:9876
CODEX_WORKER_TOKEN=<same as laptop>
```

```bash
sudo systemctl restart atlassian-cd-manager
curl -s http://127.0.0.1:9876/health
curl -s http://localhost:3000/api/ai/status
```

---

## 7. Optional: Pi as bridge (two hosts)

Only if the BFF is **not** on the SSH `-R` destination:

1. Laptop → Pi: `ssh -N -R 127.0.0.1:9876:127.0.0.1:9876 user@PI_HOST`
2. App VM → Pi: `ssh -N -L 127.0.0.1:9876:127.0.0.1:9876 user@PI_HOST`

---

## 8. Troubleshooting

### `Warning: remote port forwarding failed for listen port 9876`

Something already listens on `127.0.0.1:9876` on the **app host** (usually a hung previous `ssh -R` after a network drop).

On the app host:

```bash
sudo lsof -iTCP:9876 -sTCP:LISTEN
# kill the sshd session holding the port, e.g.:
# kill <pid>
```

Then start the tunnel again (manual or `pi-atlassian-tunnel-start`).

### Tunnel LaunchAgent: `state = spawn scheduled`, `last exit code = 78`

Almost always bad log paths in the plist (`/Users/TU_USUARIO/...`). Fix paths to your real home, `bootout` + `bootstrap` + `kickstart`.

### `make pi-health` OK but UI shows AI unavailable

Local health only proves the **laptop** worker. Check on the app host:

```bash
curl -s http://127.0.0.1:9876/health
curl -s http://localhost:3000/api/ai/status
```

If `"configured": false`, set `CODEX_WORKER_URL` / `CODEX_WORKER_TOKEN` and restart the BFF. If health on the host fails, fix the reverse tunnel.

### `tsx: not found` when running `make pi` on the server

You are on the wrong machine. Install and run the worker only on the laptop (`npm --prefix tools/codex-worker install`).

### Compliance

Codex traffic leaves from the **laptop**, not the app host. Confirm this is acceptable for your organization.

---

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
