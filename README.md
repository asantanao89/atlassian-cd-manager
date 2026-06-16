# Atlassian CD Manager

SPA + BFF para gestionar el time tracking (worklogs) de issues de Jira Cloud desde una interfaz local.

---

## Descripción

Aplicación local que permite:

- Visualizar original estimate, remaining estimate, time spent y worklogs
- Crear, modificar y borrar worklogs
- Preparar cambios en cola antes de enviarlos a Jira (bulk actions)
- Ejecutar cambios en bloque con feedback individual por cambio
- Ver resumen de horas del usuario (día/semana/mes)
- Ver issues asignadas al usuario con su estado de time tracking

**Arquitectura:** SPA Vue 3 (cliente) + servidor Fastify mínimo (BFF). El API token **nunca** llega al navegador.

---

## Requisitos

- Node.js 22 LTS o superior
- Una cuenta de Atlassian con acceso a Jira Cloud
- Un API token de Atlassian ([generar aquí](https://id.atlassian.com/manage-profile/security/api-tokens))

---

## Instalación

```bash
# Instalar dependencias raíz
npm install

# Instalar dependencias de cliente y servidor
npm --prefix client install
npm --prefix server install
```

---

## Configuración

Copia `.env.example` a `server/.env` y rellena los valores:

```bash
cp .env.example server/.env
```

Edita `server/.env`:

```env
JIRA_BASE_URL=https://your-domain.atlassian.net
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=your-api-token
BITBUCKET_BASE_URL=https://api.bitbucket.org/2.0
BITBUCKET_WORKSPACE=your-workspace
BITBUCKET_REPO_SLUG=your-repository-slug
BITBUCKET_API_USER=your-bitbucket-username-or-email
BITBUCKET_API_TOKEN=your-bitbucket-app-password
SERVER_PORT=3000
CLIENT_ORIGIN=http://localhost:5173
```

> ⚠️ **Nunca commitees el archivo `.env` real.** Ya está en `.gitignore`.

### Pull Request (Bitbucket)

Para habilitar la vista **Pull Request** se requieren credenciales de Bitbucket Cloud con permisos de lectura/escritura sobre el repositorio:

- `BITBUCKET_WORKSPACE`
- `BITBUCKET_REPO_SLUG`
- `BITBUCKET_API_USER`
- `BITBUCKET_API_TOKEN`

> También se aceptan los nombres antiguos `BITBUCKET_USERNAME` y `BITBUCKET_APP_PASSWORD` por compatibilidad.

Flujo implementado en la vista:

1. Cargar ramas disponibles del repositorio configurado.
2. Seleccionar rama origen y rama target.
3. Crear pull request.
4. Mostrar resumen del PR creado con enlace para abrirlo en una nueva pestaña.

### Notificaciones Discord (opcional)

Para habilitar el botón **Notificar a Discord** en las tablas de issues, define `DISCORD_CHANNELS` en `server/.env` como un array JSON en una sola línea:

```env
DISCORD_CHANNELS=[{"id":"dev","name":"#desarrollo","webhookUrl":"https://discord.com/api/webhooks/..."},{"id":"qa","name":"#qa","webhookUrl":"https://discord.com/api/webhooks/..."}]
```

Cada entrada necesita:

- `id`: identificador interno (único)
- `name`: nombre mostrado en el selector del popup
- `webhookUrl`: URL del webhook de Discord (nunca se expone al navegador)

Para crear un webhook en Discord: **Server Settings → Integrations → Webhooks → New Webhook**. Asigna el webhook al canal deseado y copia la URL.

Flujo en la app:

1. Pulsar el botón de Discord en una fila de issue.
2. Seleccionar canal y revisar/editar el mensaje pre-rellenado (enlace Jira + PRs abiertos).
3. Enviar; el servidor reenvía el mensaje al webhook configurado.

---

## Arrancar en local

```bash
npm run dev
```

Esto levanta simultáneamente:
- **Servidor**: `http://localhost:3000`
- **Cliente**: `http://localhost:5173`

---

## Probar la conexión con Jira

Una vez arrancado, abre `http://localhost:5173`. En la parte superior verás el estado de conexión con Jira. Si aparece el nombre del usuario conectado, todo está correcto.

También puedes probar el endpoint directamente:

```bash
curl http://localhost:3000/api/jira/me
```

---

## Vista de seguimiento personal

En la pestaña **Mi seguimiento** se muestra:

- Resumen de horas del usuario actual por **día**, **semana** y **mes**.
- Lista de worklogs recientes del usuario.
- Lista de issues asignadas con columnas de time tracking (original, restante, dedicado).

### Convención de vacaciones y ausencias

- Los días seleccionables incluyen todos los días laborables del mes actual.
- También se permiten días laborables fuera del mes cuando pertenecen a una semana que intersecta el mes actual.
- No se usa lógica de sprint para vacaciones/ausencias ni para estos límites.

Regla formal del proyecto:
- `.github/instructions/vacation-week-overlap.instructions.md`

---

## Scripts disponibles

| Comando | Descripción |
|---|---|
| `npm run dev` | Levanta cliente y servidor en paralelo |
| `npm run build` | Compila cliente y servidor |
| `npm run test` | Ejecuta tests de cliente y servidor |
| `npm run typecheck` | Verifica tipos TypeScript |
| `npm run lint` | Ejecuta ESLint |

---

## Despliegue en servidor de desarrollo

Pasos para servir la aplicación en un servidor Linux con nginx y systemd.

### 1. Clonar y construir

```bash
git clone <repo> /var/www/atlassian-cd-manager
cd /var/www/atlassian-cd-manager
npm install
npm --prefix client install
npm --prefix server install
```

### 2. Configurar variables de entorno del servidor

```bash
cp .env.example /var/www/atlassian-cd-manager/server/.env
```

Edita `server/.env` con los valores reales y ajusta `CLIENT_ORIGIN` al dominio con HTTPS:

```env
JIRA_BASE_URL=https://your-domain.atlassian.net
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=your-api-token
SERVER_PORT=3000
CLIENT_ORIGIN=https://atlassian-cd-manager.example.com
```

### 3. Configurar variable de entorno del cliente

Crea `client/.env.production` para que el build use rutas relativas y nginx enrute las llamadas `/api/` al servidor Fastify:

```bash
echo "VITE_API_BASE_URL=" > /var/www/atlassian-cd-manager/client/.env.production
```

> Sin este archivo, el cliente usará el fallback `http://localhost:3000` hardcodeado en el bundle, causando errores CORS.

### 4. Compilar

```bash
cd /var/www/atlassian-cd-manager
npm run build
```

Los estáticos del cliente quedan en `client/dist/`.

### 5. Configurar nginx

Crea `/etc/nginx/sites-available/atlassian-cd-manager`:

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

    # Frontend (Vue SPA)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend (Fastify API)
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Activa el sitio:

```bash
sudo ln -s /etc/nginx/sites-available/atlassian-cd-manager /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 6. Configurar el servicio systemd

Crea `/etc/systemd/system/atlassian-cd-manager.service`:

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

> **Nota:** `ExecStart` debe apuntar a un binario de node accesible por `www-data`. Si usas nvm, el binario estará en `~/.nvm/versions/node/<version>/bin/node` y solo será accesible para tu usuario. Cópialo a una ruta del sistema:
>
> ```bash
> sudo cp $(which node) /usr/local/bin/node
> ```
>
> Si en el futuro actualizas node con nvm, repite este paso.

Activa e inicia el servicio:

```bash
sudo systemctl daemon-reload
sudo systemctl enable atlassian-cd-manager
sudo systemctl start atlassian-cd-manager
sudo systemctl status atlassian-cd-manager
```

### 7. Verificar

```bash
# El servidor Fastify está corriendo
curl http://localhost:3000/api/jira/me

# El proxy de nginx funciona
curl https://atlassian-cd-manager.example.com/api/jira/me
```

### Actualizar tras cambios en el repo

```bash
cd /var/www/atlassian-cd-manager
git pull
npm run build
sudo systemctl restart atlassian-cd-manager
```

---

## Limitaciones conocidas

1. **`timeSpent` no es editable directamente.** En Jira, el tiempo dedicado se calcula sumando los worklogs. Para modificarlo, crea, edita o elimina worklogs.

2. **Configuración de jornada laboral.** Esta aplicación asume: 1 semana = 5 días, 1 día = 8 horas. Si tu instancia de Jira tiene una configuración diferente, las conversiones de duraciones pueden no coincidir. Consulta _Jira Settings > Time tracking_.

3. **Permisos del token.** El usuario asociado al API token solo puede leer y modificar issues para los que tenga permisos. Si un issue no aparece en los resultados o devuelve 403, el token no tiene acceso.

4. **Aplicación no multiusuario.** Esta primera versión es una herramienta de uso personal/local con un único token configurado en el servidor.

---

## Advertencia de seguridad

> El API token de Jira **nunca** se envía al navegador. Vive exclusivamente en el servidor como variable de entorno y se usa solo para construir la cabecera `Authorization: Basic ...` en las llamadas a Jira.
>
> No commitees `.env` ni expongas el servidor a internet sin protección adicional.

---

## Troubleshooting

### Error 401 — Credenciales inválidas

Verifica que `JIRA_EMAIL` y `JIRA_API_TOKEN` en `server/.env` sean correctos. El token se genera en [https://id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens).

### Error 403 — Sin permisos

El token tiene credenciales válidas pero el usuario no tiene permisos sobre el proyecto o issue. Comprueba los permisos en Jira.

### Error CORS

Si el cliente no puede conectar con el servidor, asegúrate de que `CLIENT_ORIGIN` en `server/.env` coincide exactamente con la URL del cliente (ej: `http://localhost:5173`).

### Formato de duración inválido

Los valores de duración deben seguir el formato Jira: `30m`, `1h`, `1h 30m`, `2d`, `1w 2d 3h 30m`. No se admiten valores negativos ni formatos como `1:30` o `90`.

### El servidor no arranca

Asegúrate de haber creado `server/.env` con todas las variables requeridas. El servidor falla rápido con un error claro si alguna variable falta o es inválida.
