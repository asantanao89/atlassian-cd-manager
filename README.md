# Atlassian CD Manager

SPA + BFF para gestionar time tracking, historias CDPM, ramas y pull requests de Bitbucket desde una interfaz local o desplegada.

**Arquitectura:** Vue 3 (cliente) + Fastify (BFF). Los tokens de Jira/Bitbucket **nunca** llegan al navegador.

Navegación principal: **Tracking** · **Historias** · **Branch** · **Pull Request**.

---

## Funcionalidades

### Tracking (`/timer`)

Gestión de worklogs y seguimiento de horas del usuario autenticado.

| Subvista | Ruta | Qué hace |
|---|---|---|
| Resumen | `/timer/resumen` | Cards día/semana/mes vs objetivo, gráfico diario, vacaciones/ausencias, issues abiertas y de sprint |
| Worklogs pendientes | `/timer/pendientes` | Cola de borradores (crear/editar/borrar) y ejecución en bloque |
| Histórico | `/timer/historico` | Gráficos mensuales de horas (últimos 6 meses, solo lectura) |

En las tablas de issues puedes:

- Ver/crear/editar worklogs (inmediato o en cola)
- Cambiar estado del issue
- Abrir en Jira, copiar clave
- Crear rama / pull request (Bitbucket)
- Notificar a Discord (si está configurado)
- Ver PRs abiertos del parent

### Historias (`/stories`)

Crear, editar o clonar issues del proyecto **CDPM** (configuración fija en el servidor).

- Modos: crear nueva · editar por clave · clonar (selector de campos)
- Campos: work type, summary, description, parent (épica), components, Pilares, Valor, story points, criterios de aceptación
- Vista previa Markdown antes de guardar
- Mejora con AI (Codex) de summary, description y criterios de aceptación (opcional; ver [Codex worker](#codex-worker-ai))

### Branch (`/branch`)

Crear una rama en Bitbucket a partir de una clave/URL de issue:

1. Indicar issue y tipo (`feature` / `bugfix` / `hotfix` / `chore` / `release`)
2. Elegir repositorio y punto de partida
3. Crear y copiar el comando `git fetch && checkout`

### Pull Request (`/pull-request`)

Crear un PR en Bitbucket:

1. Elegir repo, rama origen y target
2. Título (auto desde la rama origen) y descripción (auto desde commits)
3. Crear y abrir el PR en una pestaña nueva

También se puede abrir pre-rellenado desde las tablas de issues (`?repo=` / `?source=`).

### Discord (opcional)

Desde las tablas de issues: elegir canal, revisar el mensaje (enlace Jira + PRs abiertos) y enviar. Los webhooks viven solo en el servidor.

---

## Requisitos

- Node.js 22 LTS o superior (recomendado: nvm + `.nvmrc` del repo)
- Cuenta Atlassian con acceso a Jira Cloud
- API token de Atlassian ([generar aquí](https://id.atlassian.com/manage-profile/security/api-tokens))
- Para Branch / PR: acceso a Bitbucket Cloud y token/app password
- Para AI en Historias: Codex CLI en el **laptop** + túnel SSH reverse al host del BFF (ver más abajo)

---

## Instalación

```bash
npm install
npm --prefix client install
npm --prefix server install

# Solo si vas a usar AI en Historias
npm --prefix tools/codex-worker install
```

---

## Configuración

```bash
cp .env.example server/.env
```

Edita `server/.env`:

```env
# --- Jira (obligatorio) ---
JIRA_BASE_URL=https://your-domain.atlassian.net
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=your-api-token

# --- Bitbucket (Branch / Pull Request) ---
BITBUCKET_BASE_URL=https://api.bitbucket.org/2.0
BITBUCKET_WORKSPACE=your-workspace
# Uno o varios repos separados por coma
BITBUCKET_REPO_SLUG=your-repository-slug
# Con tokens ATATT... usa el email de la cuenta Atlassian
BITBUCKET_API_USER=your-atlassian-account-email
BITBUCKET_API_TOKEN=your-bitbucket-api-token-or-app-password
# Alias legacy aún soportados:
# BITBUCKET_USERNAME=...
# BITBUCKET_APP_PASSWORD=...

# --- Servidor ---
SERVER_PORT=3000
CLIENT_ORIGIN=http://localhost:5173

# --- Codex worker / AI (opcional) ---
# CODEX_WORKER_URL=http://127.0.0.1:9876
# CODEX_WORKER_TOKEN=generate-a-long-random-secret

# --- Discord (opcional, JSON en una sola línea) ---
# DISCORD_CHANNELS=[{"id":"dev","name":"#desarrollo","webhookUrl":"https://discord.com/api/webhooks/..."}]
```

> ⚠️ **Nunca commitees el `.env` real.** Ya está en `.gitignore`.

### Discord

`DISCORD_CHANNELS` es un array JSON de `{ id, name, webhookUrl }`. El `webhookUrl` no se expone al navegador.

Crear webhook: **Server Settings → Integrations → Webhooks → New Webhook**.

### Bitbucket

Necesario para **Branch** y **Pull Request**. Con API tokens Atlassian (`ATATT...`), `BITBUCKET_API_USER` debe ser el **email** de la cuenta.

---

## Arrancar en local

```bash
# Recomendado (nvm use + npm run dev)
make dev

# Equivalente
npm run dev
```

- **Servidor:** `http://localhost:3000`
- **Cliente:** `http://localhost:5173`

Comprobar Jira:

```bash
curl http://localhost:3000/api/jira/me
```

En la UI, el estado de conexión muestra el usuario autenticado si todo es correcto.

---

## Codex worker (AI)

La mejora con AI del formulario de **Historias** no ejecuta Codex en el servidor: el BFF llama a un worker HTTP que vive en el **laptop** (`tools/codex-worker`, `make pi`). Ese worker se publica en `127.0.0.1:9876` del host donde corre la app mediante un túnel SSH **reverse** (`-R`). Detalle: [`tools/codex-worker/README.md`](tools/codex-worker/README.md).

En el formulario verás el indicador **AI disponible / AI no disponible** (consulta `GET /api/ai/status` cada 15s). Si el worker o el túnel fallan, los botones **AI** se deshabilitan; el `?` del badge explica cómo comprobarlo.

### Arranque del worker (solo en el laptop)

No ejecutes `make pi` en la VM/servidor: Codex y el worker van en el portátil.

```bash
npm --prefix tools/codex-worker install
make pi
curl -s http://127.0.0.1:9876/health
```

Requisitos en el laptop: `CODEX_WORKER_TOKEN` en `server/.env`, Codex CLI instalado y autenticado (`codex login`).

### Arranque al login (macOS LaunchAgent)

```bash
make pi-install
```

| Comando | Descripción |
|---|---|
| `make pi-install` | Instala y arranca el LaunchAgent |
| `make pi-uninstall` | Lo elimina |
| `make pi-start` / `make pi-stop` | Arranca / detiene |
| `make pi-status` | Estado + health local |
| `make pi-health` | `curl` a `http://127.0.0.1:9876/health` (worker/túnel) |
| `make pi-logs` | Logs en `~/Library/Logs/atlassian-cd-manager/` |

### Túnel SSH (laptop → host de la app)

Con el worker escuchando en el laptop, expón el puerto en el **mismo host donde corre el BFF**:

```bash
ssh -N -R 127.0.0.1:9876:127.0.0.1:9876 user@APP_HOST
```

Ejemplo:

```bash
ssh -N -R 127.0.0.1:9876:127.0.0.1:9876 itp@develop-5.intechpartner.com
```

Con eso, en el servidor `http://127.0.0.1:9876` apunta al worker del laptop. **No hace falta un segundo túnel desde la VM** (`ssh -L`): el BFF ya ve el worker en localhost.

> Solo necesitarías un forward local adicional si el BFF viviera en una máquina distinta del destino del `-R` (p. ej. Raspberry Pi como puente entre laptop y otra VM). En el setup habitual (app en el host al que haces el `-R`) ese paso no aplica.

### Env en el servidor (BFF)

```env
CODEX_WORKER_URL=http://127.0.0.1:9876
CODEX_WORKER_TOKEN=generate-a-long-random-secret
```

El token debe coincidir con el del laptop (`server/.env` local, leído por `make pi` / LaunchAgent). Reinicia el servicio tras cambiar el `.env`.

Verificación en el servidor:

```bash
curl -s http://127.0.0.1:9876/health
curl -s http://localhost:3000/api/ai/status
# → "available": true
```

---

## Detalle por área

### Tracking — vacaciones y ausencias

- Días seleccionables: laborables del mes actual
- También laborables fuera del mes si la semana intersecta el mes actual
- No usa lógica de sprint; se guardan en el navegador (`localStorage`)

Regla formal: `.github/instructions/vacation-week-overlap.instructions.md`

### Historias — alcance CDPM

La creación/edición está fijada al proyecto **CDPM** y a campos/components concretos (`server/src/jira/storyCreateConfig.ts`). No es un creador genérico de issues de cualquier proyecto.

Work types permitidos: Error, Historia, Tarea, Épica.

### Branch / Pull Request

Flujos típicos:

1. **Branch:** issue → tipo de rama → repo → crear → checkout.
2. **PR:** repo → origen/target → título/descripción → crear → enlace.

Desde Tracking puedes saltar a estos flujos con contexto (issue / repo).

---

## Scripts disponibles

| Comando | Descripción |
|---|---|
| `make dev` | Cliente + servidor (`nvm use` + `npm run dev`) |
| `make pi` | Codex worker en foreground |
| `make pi-install` / `pi-uninstall` / `pi-start` / `pi-stop` / `pi-status` / `pi-health` / `pi-logs` | LaunchAgent del worker (macOS) + health |
| `npm run dev` | Cliente + servidor en paralelo |
| `npm run build` | Compila cliente y servidor |
| `npm run test` | Tests |
| `npm run typecheck` | TypeScript |
| `npm run lint` | ESLint |

---

## Despliegue en servidor de desarrollo

Pasos para Linux con nginx + systemd.

### 1. Clonar e instalar

```bash
git clone <repo> /var/www/atlassian-cd-manager
cd /var/www/atlassian-cd-manager
npm install
npm --prefix client install
npm --prefix server install
```

### 2. Entorno del servidor

```bash
cp .env.example /var/www/atlassian-cd-manager/server/.env
```

Ajusta valores reales y `CLIENT_ORIGIN` al dominio HTTPS. Incluye Bitbucket / Discord / Codex si los usas.

### 3. Entorno del cliente (build)

```bash
echo "VITE_API_BASE_URL=" > /var/www/atlassian-cd-manager/client/.env.production
```

> Sin esto, el bundle usará `http://localhost:3000` y fallará por CORS detrás de nginx.

### 4. Compilar

```bash
cd /var/www/atlassian-cd-manager
npm run build
```

Estáticos en `client/dist/`.

### 5. nginx

`/etc/nginx/sites-available/atlassian-cd-manager`:

```nginx
server {
    listen 80;
    server_name atlassian-cd-manager.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name atlassian-cd-manager.example.com;

    ssl_certificate     /etc/ssl/certs/your-cert.bundle;
    ssl_certificate_key /etc/ssl/private/your-cert.key;

    root /var/www/atlassian-cd-manager/client/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/atlassian-cd-manager /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 6. systemd

`/etc/systemd/system/atlassian-cd-manager.service`:

```ini
[Unit]
Description=Atlassian CD Manager API
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/atlassian-cd-manager/server
ExecStart=/usr/local/bin/node dist/index.js
Restart=on-failure
RestartSec=5
EnvironmentFile=/var/www/atlassian-cd-manager/server/.env

[Install]
WantedBy=multi-user.target
```

> `ExecStart` debe usar un `node` accesible por `www-data`. Con nvm:
>
> ```bash
> sudo cp $(which node) /usr/local/bin/node
> ```

```bash
sudo systemctl daemon-reload
sudo systemctl enable atlassian-cd-manager
sudo systemctl start atlassian-cd-manager
sudo systemctl status atlassian-cd-manager
```

### 7. Verificar

```bash
curl http://localhost:3000/api/jira/me
curl https://atlassian-cd-manager.example.com/api/jira/me
```

### Actualizar

```bash
cd /var/www/atlassian-cd-manager
git pull
npm run build
sudo systemctl restart atlassian-cd-manager
```

Si usas AI desde el servidor: mantén el worker en el laptop (`make pi` / `make pi-install`) y el túnel reverse (`ssh -R …:9876`) hacia ese host.

---

## Limitaciones conocidas

1. **`timeSpent` no es editable directamente.** Se calcula sumando worklogs; para cambiarlo, crea/edita/borra worklogs.
2. **Jornada laboral fija.** Asume 1 semana = 5 días, 1 día = 8 horas. Si Jira usa otra configuración, las conversiones pueden diferir.
3. **Permisos del token.** Solo se pueden tocar issues/repositorios a los que el usuario del token tenga acceso.
4. **No multiusuario.** Un único token/identidad en el servidor.
5. **Historias solo CDPM.** Campos y components fijados en código; no es un creador genérico de Jira.
6. **Vacaciones locales.** Las ausencias del Tracking se guardan en el navegador, no en Jira.
7. **AI opcional.** Sin worker en el laptop + túnel reverse al host del BFF, el formulario de Historias funciona pero sin botones AI.

---

## Advertencia de seguridad

> Los tokens de Jira/Bitbucket y los webhooks de Discord **nunca** se envían al navegador. Viven en el servidor.
>
> No commitees `.env` ni expongas el servicio a internet sin protección adicional.
>
> El tráfico de Codex sale desde el **laptop** (worker), no desde la VM. Confirma que es aceptable para tu organización.

---

## Troubleshooting

### Error 401 — Credenciales inválidas

Revisa `JIRA_EMAIL` y `JIRA_API_TOKEN` en `server/.env`. Token: [id.atlassian.com](https://id.atlassian.com/manage-profile/security/api-tokens).

### Error 403 — Sin permisos

Credenciales válidas pero sin acceso al proyecto/issue/repo. Revisa permisos en Jira/Bitbucket.

### Error CORS

`CLIENT_ORIGIN` debe coincidir exactamente con la URL del cliente (ej. `http://localhost:5173` o el dominio HTTPS).

### Formato de duración inválido

Formato Jira: `30m`, `1h`, `1h 30m`, `2d`, `1w 2d 3h 30m`. No uses `1:30` ni `90`.

### El servidor no arranca

Falta o es inválida alguna variable requerida en `server/.env`. El servidor falla rápido con un mensaje claro.

### Branch / PR devuelven 503

Faltan variables Bitbucket o el token no autentica. Con tokens `ATATT...`, usa el email en `BITBUCKET_API_USER`.

### Discord no aparece / 503

`DISCORD_CHANNELS` ausente, mal formado (debe ser JSON en una línea) o webhook inválido.

### AI no disponible en Historias

1. En el **laptop** (no en la VM): `make pi-status` (o `make pi` / `make pi-install`).
2. Health en el laptop: `curl -s http://127.0.0.1:9876/health`.
3. Túnel reverse activo hacia el host de la app: `ssh -N -R 127.0.0.1:9876:127.0.0.1:9876 user@APP_HOST`.
4. En el servidor, `CODEX_WORKER_URL` y `CODEX_WORKER_TOKEN` alineados con el worker; reinicia el BFF tras cambiar el `.env`.
5. En el servidor: `curl -s http://127.0.0.1:9876/health` y `curl -s http://localhost:3000/api/ai/status` → `"available": true`.
6. No hace falta un `ssh -L` en la VM si el BFF corre en el mismo host destino del `-R`.
