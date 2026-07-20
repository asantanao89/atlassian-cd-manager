import { z } from 'zod'

export const improveFieldSchema = z.object({
  fields: z
    .array(z.enum(['summary', 'description', 'acceptanceCriteria']))
    .min(1, 'At least one field is required'),
  summary: z.string(),
  description: z.string().optional().default(''),
  acceptanceCriteria: z.string().optional().default(''),
  componentName: z.string().nullable(),
  valor: z.string(),
  projectKey: z.string(),
  projectName: z.string(),
  issueTypeName: z.string(),
  unOptionValue: z.string(),
})

/** @deprecated use improveFieldSchema */
export const improveSummarySchema = improveFieldSchema
