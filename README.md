# Jira Time Tracking Manager

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
SERVER_PORT=3000
CLIENT_ORIGIN=http://localhost:5173
```

> ⚠️ **Nunca commitees el archivo `.env` real.** Ya está en `.gitignore`.

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
