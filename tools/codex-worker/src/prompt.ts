export type ImproveFieldId = 'summary' | 'description' | 'acceptanceCriteria'

export interface ImproveContext {
  summary: string
  description: string
  acceptanceCriteria: string
  componentName: string | null
  valor: string
  projectKey: string
  projectName: string
  issueTypeName: string
  unOptionValue: string
}

export const DESCRIPTION_TEMPLATE_SECTIONS = [
  '1. Objetivo',
  '2. Descripción funcional',
  '3. Alcance',
  '4. Impacto / Dependencias',
  '5. Información adicional',
] as const

export const ACCEPTANCE_CRITERIA_TABLE_HEADERS = [
  'N',
  'Contexto',
  'Escenario',
  'Comportamiento',
  'Resultado',
] as const

function buildSummarySection(context: ImproveContext): string {
  const hasSummary = context.summary.trim().length > 0
  const hasDescription = context.description.trim().length > 0

  if (!hasSummary && hasDescription) {
    return [
      '## Campo a mejorar: Summary',
      '',
      'Modo: GENERAR DESDE DESCRIPTION',
      'El Summary está vacío. Genera un summary nuevo a partir de la Description.',
      'Formato: historia de usuario en español "Como <rol> quiero <acción> para <beneficio>".',
      'Usa solo lo inferible de la Description; no inventes requisitos nuevos.',
      'Devuelve improvedValue con solo el texto del summary (sin markdown).',
      'Para Summary: missingSections y followUpQuestions deben ser arrays vacíos [].',
      'Ignora cualquier otro metadato de Jira (equipo, component, proyecto, etc.).',
      '',
      `Summary actual: (vacío)`,
      `Description (fuente): ${context.description.trim()}`,
    ].join('\n')
  }

  return [
    '## Campo a mejorar: Summary',
    '',
    'Reescribe el summary como una historia de usuario clara en español,',
    'en formato: "Como <rol> quiero <acción> para <beneficio>".',
    'Mantén el idioma y el alcance; no inventes requisitos nuevos.',
    'Puedes usar la Description solo como contexto adicional.',
    'Devuelve improvedValue con solo el texto del summary (sin markdown).',
    'Para Summary: missingSections y followUpQuestions deben ser arrays vacíos [].',
    'Ignora cualquier otro metadato de Jira (equipo, component, proyecto, etc.).',
    '',
    `Summary actual: ${context.summary.trim() || '(vacío)'}`,
    `Description (contexto): ${context.description.trim() || '(vacío)'}`,
  ].join('\n')
}

function buildDescriptionSection(context: ImproveContext): string {
  return [
    '## Campo a mejorar: Description',
    '',
    'Genera la Description en español en Markdown usando EXACTAMENTE este template',
    '(solo estas secciones; no añadas otras):',
    '',
    ...DESCRIPTION_TEMPLATE_SECTIONS.map((s) => `## ${s}`),
    '',
    'Formato Markdown OBLIGATORIO:',
    '- Cada título de sección debe ser un heading h2 de Markdown: empieza por "## "',
    '  seguido del número y el nombre exactos (ejemplo: "## 1. Objetivo").',
    '- NO uses # (h1), ### (h3), ****, ni títulos en negrita sin ##.',
    '- El contenido de cada sección va debajo del ## como texto normal (párrafos).',
    '- Deja una línea en blanco entre el ## y el texto, y entre secciones.',
    '- Ejemplo de bloque:',
    '  ## 1. Objetivo',
    '  ',
    '  Texto del objetivo en párrafo normal.',
    '  ',
    '  ## 2. Descripción funcional',
    '  ',
    '  Texto de la funcionalidad…',
    '',
    'La descripción (en conjunto) debe responder claramente a estas preguntas:',
    '- ¿Qué problema se quiere resolver?',
    '- ¿Quién necesita esta funcionalidad?',
    '- ¿Qué podrá hacer el usuario?',
    '- ¿Cuál es el alcance de esta historia?',
    '',
    'Reglas de contenido:',
    '- Usa ÚNICAMENTE Summary y Description como contexto. No uses ni menciones',
    '  equipo, component, proyecto, UN u otros metadatos de Jira.',
    '- Rellena solo lo inferible de Summary/Description; NO inventes requisitos.',
    '- Secciones obligatorias: 1–3. Si falta información, escribe un placeholder',
    '  del tipo "[Completar: …]" en esa sección y añádela a missingSections.',
    '- Secciones opcionales: 4–5. Si no hay datos, omítelas o déjalas vacías;',
    '  no las metas en missingSections ni pidas completarlas en followUpQuestions.',
    '- followUpQuestions: preguntas concretas en español para completar lo que falta',
    '  (solo secciones 1–3 y las preguntas guía anteriores). Usa [] si no hay gaps.',
    '- improvedValue = solo el Markdown de la Description (sin explicaciones fuera).',
    '- En el cuerpo puedes usar listas (-), negrita (**texto**) o itálica (*texto*),',
    '  pero NUNCA conviertas el cuerpo en headings.',
    '- PROHIBIDO: no incluyas "Valor de negocio" ni ninguna sección equivalente.',
    '  Si la Description actual la tiene, elimínala del resultado.',
    '',
    `Summary: ${context.summary.trim() || '(vacío)'}`,
    `Description actual: ${context.description.trim() || '(vacío)'}`,
  ].join('\n')
}

function buildAcceptanceCriteriaSection(context: ImproveContext): string {
  const hasList = context.acceptanceCriteria.trim().length > 0
  return [
    '## Campo a mejorar: Criterios de Aceptación',
    '',
    'Genera una tabla Markdown de criterios de aceptación con EXACTAMENTE estas columnas',
    `(en este orden): ${ACCEPTANCE_CRITERIA_TABLE_HEADERS.join(' | ')}.`,
    '',
    'Formato de salida (improvedValue = solo la tabla Markdown, sin texto extra):',
    '',
    '| N | Contexto | Escenario | Comportamiento | Resultado |',
    '| --- | --- | --- | --- | --- |',
    '| 1 | … | DADO … | CUANDO … | ENTONCES … |',
    '',
    'Reglas de formato:',
    '- Cada criterio es UNA fila (N = 1, 2, 3…).',
    '- Escenario debe empezar por DADO (contexto/precondiciones del escenario).',
    '- Comportamiento debe empezar por CUANDO (acción del usuario/sistema).',
    '- Resultado debe empezar por ENTONCES (resultado esperado).',
    '- Contexto: información de entorno/datos de apoyo; si no hay, deja vacío o "—".',
    '- No uses metadatos de Jira (component, proyecto, UN, etc.).',
    '',
    hasList
      ? [
          'Modo: CONVERTIR LISTA',
          '- Usa la lista de criterios como fuente principal.',
          '- Summary/Description solo para aclarar, sin inventar criterios fuera de la lista.',
          '- Si un ítem es ambiguo, rellénalo lo mejor posible y añádelo a missingSections;',
          '  propón followUpQuestions. Si todo está claro, usa [].',
        ].join('\n')
      : [
          'Modo: GENERAR DESDE SUMMARY/DESCRIPTION',
          '- La lista de criterios está vacía.',
          '- Usa ÚNICAMENTE Summary y Description para proponer criterios convenientes,',
          '  verificables y alineados con lo descrito (sin inventar alcance nuevo).',
          '- Incluye filas para el happy path y, si se deduce, errores/validaciones relevantes.',
          '- Si Summary/Description son demasiado pobres, genera una tabla mínima razonable',
          '  con placeholders [Completar: …] donde falte detalle, rellena missingSections',
          '  y followUpQuestions. Si hay suficiente info, missingSections y',
          '  followUpQuestions = [].',
        ].join('\n'),
    '',
    `Summary: ${context.summary.trim() || '(vacío)'}`,
    `Description: ${context.description.trim() || '(vacío)'}`,
    '',
    'Lista de criterios (si existe):',
    hasList ? context.acceptanceCriteria.trim() : '(vacía — generar desde Summary/Description)',
  ].join('\n')
}

export function buildImprovePrompt(fields: ImproveFieldId[], context: ImproveContext): string {
  const uniqueFields = [...new Set(fields)]
  if (uniqueFields.length === 0) {
    return ''
  }

  const lines: string[] = [
    'Eres un agente dedicado a mejorar historias de usuario de Jira.',
    'Usa solo Summary, Description y, si aplica, la lista de criterios como contexto.',
    'No uses component, proyecto, UN ni otros metadatos.',
    'Responde siempre con el schema JSON (improvedValue, missingSections, followUpQuestions).',
    '',
    '## Contexto',
    `Summary: ${context.summary.trim() || '(vacío)'}`,
    `Description: ${context.description.trim() || '(vacío)'}`,
    `Criterios / lista: ${context.acceptanceCriteria.trim() || '(vacío)'}`,
    '',
  ]

  for (const field of uniqueFields) {
    if (field === 'summary') {
      lines.push(buildSummarySection(context), '')
    }
    if (field === 'description') {
      lines.push(buildDescriptionSection(context), '')
    }
    if (field === 'acceptanceCriteria') {
      lines.push(buildAcceptanceCriteriaSection(context), '')
    }
  }

  return lines.join('\n').trim() + '\n'
}
