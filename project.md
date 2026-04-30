# Prompt para Copilot Cloud: Jira Time Tracking Manager SPA

Actúa como un equipo senior de frontend, arquitectura de integración y seguridad. Quiero que generes una aplicación para modificar el time tracking de historias y subtareas de Jira Cloud usando Vue.js moderno, Vite y TypeScript.

El objetivo no es crear una demo superficial, sino una primera versión funcional, mantenible y segura.

---

## 1. Objetivo del proyecto

Crear una SPA llamada `jira-time-tracking-manager` que permita:

1. Conectarse a Jira Cloud usando un API token ya existente.
2. Buscar historias y subtareas mediante JQL.
3. Visualizar el time tracking de cada issue:
   - original estimate
   - remaining estimate
   - time spent
   - worklogs asociados
4. Crear, modificar y borrar worklogs.
5. Preparar cambios en una vista previa antes de enviarlos a Jira.
6. Ejecutar cambios individuales o en bloque con feedback claro de éxito/error.
7. Vista de horas del usuario resumido por día/semana/mes.
8. Vista de tareas asignadas al usuario con time tracking.

La interfaz principal debe ser una SPA en Vue, pero las llamadas a Jira no deben exponer el API token en el navegador.

---

## 2. Decisión de arquitectura obligatoria

Aunque la aplicación visible será una SPA, no hagas llamadas directas desde el navegador a Jira Cloud usando Basic Auth.

Motivos:

- El API token quedaría expuesto en el bundle, en DevTools o en storage del navegador.
- Jira Cloud puede bloquear llamadas directas desde navegador por CORS.
- El token no debe viajar nunca al cliente.

Implementa una arquitectura SPA + BFF/proxy mínimo:

- `client/`: Vue SPA con Vite.
- `server/`: API mínima en Node.js para firmar y reenviar peticiones a Jira.
- El servidor lee credenciales desde variables de entorno.
- El cliente solo llama a endpoints internos `/api/...`.
- Nunca devuelvas el API token al frontend.
- Nunca guardes el token en `localStorage`, `sessionStorage`, IndexedDB ni cookies legibles por JS.

Para un MVP local, el servidor puede ser un Fastify o Express muy pequeño. Prioriza Fastify por simplicidad, tipado y rendimiento.

---

## 3. Stack requerido

Usa versiones modernas y estables en el momento de generar el proyecto:

- Vue 3 con Composition API y `<script setup>`.
- Vite.
- TypeScript en modo estricto.
- Vue Router.
- Pinia para estado global.
- TanStack Query para estado remoto, cache, loading y retry controlado.
- Zod para validar formularios, variables de entorno y payloads.
- Vitest para tests unitarios.
- Vue Test Utils para tests de componentes.
- ESLint + Prettier.
- Tailwind CSS para UI rápida y limpia.

No uses Vue CLI. No uses Options API salvo que sea estrictamente necesario.

Node mínimo recomendado: versión compatible con Vite actual, preferiblemente Node 22 LTS o superior.

---

## 4. Variables de entorno

Crea `.env.example` en raíz o en `server/` con estas variables:

```env
JIRA_BASE_URL=https://your-domain.atlassian.net
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=your-api-token
SERVER_PORT=3000
CLIENT_ORIGIN=http://localhost:5173
```

Reglas:

- No crear `.env` real.
- No commitear tokens.
- Añadir `.env` a `.gitignore`.
- Validar variables de entorno al arrancar el servidor usando Zod.
- Fallar rápido con un error claro si falta alguna variable.

---

## 5. Autenticación contra Jira

El servidor debe usar Basic Auth con:

- username: email de Atlassian
- password: API token

Construir header:

```ts
Authorization: `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`
```

No loguear nunca este header.

Añadir un endpoint interno para comprobar conexión:

```http
GET /api/jira/me
```

Este endpoint llamará a Jira:

```http
GET /rest/api/3/myself
```

Debe devolver al frontend únicamente datos seguros como `accountId`, `displayName`, `emailAddress` si Jira lo devuelve y `active`.

---

## 6. Endpoints internos que debe exponer el servidor

Implementa endpoints internos pensados para la SPA. No expongas un proxy abierto que permita llamar a cualquier URL arbitraria.

### 6.1 Healthcheck

```http
GET /api/health
```

Respuesta:

```json
{
  "status": "ok"
}
```

### 6.2 Usuario actual Jira

```http
GET /api/jira/me
```

### 6.3 Buscar issues por JQL

```http
POST /api/jira/issues/search
```

Body:

```json
{
  "jql": "project = ABC AND issuetype in (Story, Sub-task) ORDER BY updated DESC",
  "maxResults": 50,
  "nextPageToken": null
}
```

Llamar preferiblemente a Jira Cloud REST API v3:

```http
POST /rest/api/3/search/jql
```

Campos mínimos a pedir:

- `summary`
- `status`
- `issuetype`
- `parent`
- `subtasks`
- `timetracking`
- `assignee`
- `updated`

La respuesta interna debe normalizar los datos para el frontend.

### 6.4 Obtener detalle de issue

```http
GET /api/jira/issues/:issueKey
```

Debe llamar a:

```http
GET /rest/api/3/issue/{issueIdOrKey}
```

Incluir fields relevantes:

- summary
- status
- issuetype
- parent
- subtasks
- timetracking
- assignee
- worklog
- updated

### 6.5 Obtener worklogs de un issue

```http
GET /api/jira/issues/:issueKey/worklogs
```

Debe llamar a:

```http
GET /rest/api/3/issue/{issueIdOrKey}/worklog
```

### 6.6 Crear worklog

```http
POST /api/jira/issues/:issueKey/worklogs
```

Body interno:

```json
{
  "timeSpent": "1h 30m",
  "started": "2026-04-29T09:00:00.000+0000",
  "comment": "Trabajo realizado",
  "adjustEstimate": "auto"
}
```

Debe llamar a:

```http
POST /rest/api/3/issue/{issueIdOrKey}/worklog?adjustEstimate=auto&notifyUsers=false
```

Convertir `comment` a Atlassian Document Format:

```json
{
  "type": "doc",
  "version": 1,
  "content": [
    {
      "type": "paragraph",
      "content": [
        {
          "type": "text",
          "text": "Trabajo realizado"
        }
      ]
    }
  ]
}
```

### 6.7 Actualizar worklog

```http
PUT /api/jira/issues/:issueKey/worklogs/:worklogId
```

Body interno:

```json
{
  "timeSpent": "45m",
  "started": "2026-04-29T10:00:00.000+0000",
  "comment": "Ajuste de tiempo",
  "adjustEstimate": "auto"
}
```

Debe llamar a:

```http
PUT /rest/api/3/issue/{issueIdOrKey}/worklog/{id}?adjustEstimate=auto&notifyUsers=false
```

### 6.8 Borrar worklog

```http
DELETE /api/jira/issues/:issueKey/worklogs/:worklogId
```

Query interna opcional:

```http
?adjustEstimate=auto
```

Debe llamar a:

```http
DELETE /rest/api/3/issue/{issueIdOrKey}/worklog/{id}?adjustEstimate=auto&notifyUsers=false
```

### 6.9 Actualizar estimates del issue

```http
PUT /api/jira/issues/:issueKey/timetracking
```

Body interno:

```json
{
  "originalEstimate": "4h",
  "remainingEstimate": "2h"
}
```

Debe llamar a:

```http
PUT /rest/api/3/issue/{issueIdOrKey}
```

Payload Jira:

```json
{
  "fields": {
    "timetracking": {
      "originalEstimate": "4h",
      "remainingEstimate": "2h"
    }
  }
}
```

Importante:

- Validar que las estimaciones están en formato Jira válido.
- Si Jira devuelve error indicando que `timetracking` no está en la pantalla de edición o no es editable, mostrar un error claro al usuario.
- No prometer que `timeSpent` se puede editar directamente. `timeSpent` debe modificarse creando, editando o borrando worklogs.

---

## 7. Modelo de datos frontend

Crear tipos TypeScript explícitos. Ejemplo:

```ts
export type JiraIssueType = 'Story' | 'Sub-task' | string

export interface JiraIssueSummary {
  id: string
  key: string
  summary: string
  issueType: JiraIssueType
  statusName: string
  assigneeName: string | null
  parentKey: string | null
  updated: string
  timetracking: JiraTimeTracking
}

export interface JiraTimeTracking {
  originalEstimate?: string
  remainingEstimate?: string
  timeSpent?: string
  originalEstimateSeconds?: number
  remainingEstimateSeconds?: number
  timeSpentSeconds?: number
}

export interface JiraWorklog {
  id: string
  issueId: string
  authorDisplayName: string
  updateAuthorDisplayName: string
  started: string
  updated: string
  timeSpent: string
  timeSpentSeconds: number
  commentText: string
}

export interface PendingChange {
  id: string
  issueKey: string
  type: 'update-estimate' | 'create-worklog' | 'update-worklog' | 'delete-worklog'
  before: unknown
  after: unknown
  status: 'draft' | 'running' | 'success' | 'error'
  errorMessage?: string
}
```

---

## 8. Funcionalidades UI requeridas

### 8.1 Layout general

Crear layout limpio con:

- Header con nombre de app y estado de conexión con Jira.
- Sidebar o panel superior con búsqueda JQL.
- Área principal con tabla/árbol de issues.
- Panel lateral o modal para editar issue/worklogs.
- Panel inferior o página separada para cambios pendientes.

### 8.2 Pantalla de conexión

Mostrar:

- Estado de conexión con `/api/jira/me`.
- Usuario conectado.
- URL base de Jira, pero nunca mostrar token.
- Botón “Probar conexión”.

### 8.3 Buscador JQL

Debe incluir:

- Textarea para JQL.
- Botones rápidos:
  - Historias y subtareas por proyecto.
  - Mis issues abiertas.
  - Issues actualizadas recientemente.
- Campo `maxResults`.
- Botón “Buscar”.
- Estados loading/error/empty.

Ejemplos de JQL sugeridos:

```text
project = ABC AND issuetype in (Story, Sub-task) ORDER BY updated DESC
assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC
project = ABC AND updated >= -14d ORDER BY updated DESC
```

### 8.4 Tabla de issues

Columnas mínimas:

- Key
- Tipo
- Summary
- Estado
- Assignee
- Original estimate
- Remaining estimate
- Time spent
- Updated
- Acciones

Acciones:

- Ver detalle.
- Editar estimates.
- Ver worklogs.
- Crear worklog.

Si un issue tiene subtareas, mostrar estructura parent/subtasks cuando sea posible.

### 8.5 Editor de estimates

Formulario:

- Original estimate
- Remaining estimate

Reglas:

- Permitir valores tipo Jira: `30m`, `1h`, `1h 30m`, `2d`, `1w 2d 3h 30m`.
- No aceptar valores negativos.
- Botón “Añadir a cambios pendientes”.
- Botón “Guardar ahora” opcional.

### 8.6 Editor de worklogs

Formulario para crear/editar:

- Fecha/hora de inicio.
- Tiempo dedicado.
- Comentario.
- Ajuste de estimación:
  - auto
  - leave
  - new
  - manual
- Si `adjustEstimate = new`, pedir `newEstimate`.
- Si `adjustEstimate = manual`, pedir `increaseBy` o campo equivalente según API de Jira.

Reglas:

- `timeSpent` obligatorio.
- `started` obligatorio.
- Comentario opcional.
- Confirmar antes de borrar un worklog.

### 8.7 Cambios pendientes / bulk actions

Crear una vista “Cambios pendientes” con:

- Lista de cambios preparados.
- Diferencia before/after legible.
- Botón para eliminar cambio de la cola.
- Botón “Ejecutar todos”.
- Ejecución secuencial para evitar rate limits.
- Resultado por cambio.
- No detener todo el lote si un cambio falla; marcar error y continuar.

---

## 9. Utilidades obligatorias

### 9.1 Parser/formatter de duración Jira

Crear funciones:

```ts
parseJiraDurationToSeconds(input: string): number
formatSecondsToJiraDuration(seconds: number): string
isValidJiraDuration(input: string): boolean
```

Soportar:

- `w`
- `d`
- `h`
- `m`

Asumir por defecto:

- 1 semana = 5 días
- 1 día = 8 horas
- 1 hora = 60 minutos

Documentar esta decisión porque Jira puede tener configuración propia de jornada laboral.

### 9.2 Constructor ADF para comentarios

Crear:

```ts
buildAdfComment(text: string): AtlassianDocumentFormatDoc
extractPlainTextFromAdf(doc: unknown): string
```

Debe tolerar comentarios vacíos o formatos inesperados sin romper la UI.

### 9.3 Normalizadores de respuesta Jira

Crear adaptadores para no acoplar componentes Vue directamente al JSON bruto de Jira:

```ts
normalizeIssue(raw: unknown): JiraIssueSummary
normalizeWorklog(raw: unknown): JiraWorklog
```

---

## 10. Gestión de errores

Crear manejo consistente para:

- 400: validación o campo no editable.
- 401: credenciales incorrectas o token revocado.
- 403: permisos insuficientes.
- 404: issue/worklog no encontrado.
- 429: rate limit.
- 5xx: error de Jira.
- Error de red.

El frontend debe mostrar mensajes comprensibles y accionables.

Ejemplos:

- “Jira ha rechazado la actualización porque el campo Time Tracking no está en la pantalla de edición del issue.”
- “El token no tiene permisos para trabajar sobre este proyecto o issue.”
- “La sesión con Jira no es válida. Revisa `JIRA_EMAIL` y `JIRA_API_TOKEN` en el servidor.”

---

## 11. Seguridad y privacidad

Obligatorio:

- No loguear API token.
- No loguear Authorization header.
- No enviar el token al cliente.
- No añadir proxy abierto.
- Validar input del cliente antes de llamar a Jira.
- Sanitizar errores antes de devolverlos al frontend.
- Añadir CORS restrictivo en el servidor usando `CLIENT_ORIGIN`.
- Añadir rate limiting básico en endpoints de escritura.

No implementar login multiusuario en la primera versión. Esta app es una herramienta interna/local con un único token configurado en servidor.

---

## 12. Estructura de proyecto esperada

Generar una estructura similar a esta:

```text
jira-time-tracking-manager/
  client/
    index.html
    package.json
    vite.config.ts
    tsconfig.json
    src/
      main.ts
      App.vue
      router/
        index.ts
      stores/
        pendingChanges.store.ts
      api/
        httpClient.ts
        jiraApi.ts
      types/
        jira.ts
        pendingChange.ts
      utils/
        jiraDuration.ts
        adf.ts
      components/
        AppHeader.vue
        ConnectionStatus.vue
        JqlSearchPanel.vue
        IssueTable.vue
        IssueTimeTrackingEditor.vue
        WorklogList.vue
        WorklogEditor.vue
        PendingChangesPanel.vue
        ConfirmDialog.vue
      views/
        DashboardView.vue
        PendingChangesView.vue
      tests/
        jiraDuration.test.ts
        adf.test.ts
  server/
    package.json
    tsconfig.json
    src/
      index.ts
      env.ts
      jira/
        jiraClient.ts
        jiraNormalizer.ts
        jiraErrors.ts
      routes/
        health.routes.ts
        jira.routes.ts
      schemas/
        jira.schemas.ts
      utils/
        adf.ts
        jiraDuration.ts
  package.json
  README.md
  .gitignore
  .env.example
```

Puedes simplificar si lo justificas, pero no mezcles lógica de Jira dentro de componentes Vue.

---

## 13. Scripts esperados

En el `package.json` raíz, crear scripts:

```json
{
  "scripts": {
    "dev": "concurrently \"npm:dev:server\" \"npm:dev:client\"",
    "dev:client": "npm --prefix client run dev",
    "dev:server": "npm --prefix server run dev",
    "build": "npm --prefix client run build && npm --prefix server run build",
    "test": "npm --prefix client run test && npm --prefix server run test",
    "lint": "npm --prefix client run lint && npm --prefix server run lint",
    "typecheck": "npm --prefix client run typecheck && npm --prefix server run typecheck"
  }
}
```

Instalar `concurrently` solo si se usa este enfoque.

---

## 14. Calidad de implementación

Requisitos:

- TypeScript estricto.
- Componentes pequeños y reutilizables.
- Composables para lógica compleja si procede.
- No usar `any` salvo con justificación puntual.
- No ignorar errores con `catch {}` vacío.
- No crear una UI excesivamente ornamentada.
- Priorizar legibilidad y mantenibilidad.
- Añadir loading states y empty states.
- Añadir tests para utilidades críticas.

---

## 15. Tests mínimos

Crear tests unitarios para:

### Duraciones Jira

Casos:

- `30m` => 1800
- `1h` => 3600
- `1h 30m` => 5400
- `1d` => 28800
- `1w` => 144000
- `1w 2d 3h 30m` => valor correcto
- string vacío => inválido
- `-1h` => inválido
- `abc` => inválido

### ADF

Casos:

- Texto normal a ADF.
- Texto vacío.
- ADF simple a texto plano.
- ADF inesperado no rompe.

### Normalizadores

Casos:

- Issue con timetracking completo.
- Issue sin assignee.
- Issue sin timetracking.
- Worklog con comentario ADF.
- Worklog sin comentario.

---

## 16. README obligatorio

Crear `README.md` con:

1. Descripción del proyecto.
2. Requisitos.
3. Instalación.
4. Configuración de `.env`.
5. Cómo arrancar en local.
6. Cómo probar conexión con Jira.
7. Cómo buscar issues por JQL.
8. Limitaciones conocidas.
9. Advertencia de seguridad sobre el API token.
10. Troubleshooting:
    - 401
    - 403
    - CORS
    - campo timetracking no editable
    - formato de duración inválido

---

## 17. Limitaciones conocidas que deben documentarse

Documenta explícitamente:

- `timeSpent` no se edita como campo directo; se modifica vía worklogs.
- La configuración de jornada laboral en Jira puede no coincidir con la conversión local de semanas/días a segundos.
- Algunas instancias de Jira no permiten editar `timetracking` si el campo no está en la pantalla de edición.
- Los permisos del usuario asociado al token determinan qué issues se pueden leer/modificar.
- Esta primera versión no es multiusuario.

---

## 18. Criterios de aceptación

La tarea se considera terminada cuando:

1. `npm install` funciona en raíz, `client` y `server` según la estructura elegida.
2. `npm run dev` levanta cliente y servidor.
3. La SPA muestra el estado de conexión con Jira.
4. Se puede ejecutar una búsqueda JQL real.
5. La tabla muestra historias y subtareas con datos de time tracking.
6. Se puede abrir el detalle de un issue.
7. Se pueden listar worklogs de un issue.
8. Se puede crear un worklog.
9. Se puede editar un worklog.
10. Se puede borrar un worklog con confirmación.
11. Se pueden modificar original/remaining estimate cuando Jira lo permita.
12. Los cambios pendientes se pueden preparar antes de enviarse.
13. Los errores de Jira se muestran de forma comprensible.
14. El API token nunca aparece en el frontend ni en logs.
15. Hay tests unitarios para duración, ADF y normalizadores.
16. El README explica configuración, uso y limitaciones.

---

## 19. Orden recomendado de implementación

Implementa en este orden:

1. Estructura monorepo `client` + `server`.
2. Configuración TypeScript, lint, test y scripts.
3. Servidor Fastify con env validation, CORS restrictivo y healthcheck.
4. Jira client con Basic Auth seguro.
5. Endpoint `/api/jira/me`.
6. SPA base con conexión y layout.
7. Search JQL backend + frontend.
8. Tabla de issues.
9. Worklogs backend + frontend.
10. Editor de estimates.
11. Cola de cambios pendientes.
12. Tests.
13. README.

No entregues únicamente scaffolding. Implementa una versión funcional de extremo a extremo para el flujo principal.

---

## 20. Referencias técnicas útiles

Usar Jira Cloud REST API v3:

- Issue search: `POST /rest/api/3/search/jql`
- Issue detail: `GET /rest/api/3/issue/{issueIdOrKey}`
- Edit issue: `PUT /rest/api/3/issue/{issueIdOrKey}`
- Get worklogs: `GET /rest/api/3/issue/{issueIdOrKey}/worklog`
- Add worklog: `POST /rest/api/3/issue/{issueIdOrKey}/worklog`
- Update worklog: `PUT /rest/api/3/issue/{issueIdOrKey}/worklog/{id}`
- Delete worklog: `DELETE /rest/api/3/issue/{issueIdOrKey}/worklog/{id}`
- Current user: `GET /rest/api/3/myself`

Atlassian Cloud usa Basic Auth con email + API token para scripts o integraciones personales.

---

## 21. Resultado esperado de Copilot

Genera todos los ficheros necesarios para que pueda clonar/abrir el proyecto, configurar `.env`, instalar dependencias, ejecutar `npm run dev` y empezar a modificar time tracking de issues reales de Jira Cloud desde la SPA.
