import { z } from 'zod'
import { isValidJiraDuration } from '../utils/jiraDuration'

const jiraDurationSchema = z
  .string()
  .min(1, 'Duration is required')
  .refine((value) => isValidJiraDuration(value), {
    message: 'Invalid Jira duration format. Example: 1h 30m, 2d, 1w',
  })

export const searchIssuesSchema = z.object({
  jql: z.string().min(1, 'JQL cannot be empty'),
  maxResults: z.number().int().min(1).max(100).default(50),
  nextPageToken: z.string().nullable().optional(),
  includeWorklogs: z.boolean().optional().default(false),
})

export const createWorklogSchema = z.object({
  timeSpent: jiraDurationSchema,
  started: z.string().min(1, 'started is required'),
  comment: z.string().optional().default(''),
  adjustEstimate: z.enum(['auto', 'leave', 'new', 'manual']).default('auto'),
  newEstimate: jiraDurationSchema.optional(),
  increaseBy: jiraDurationSchema.optional(),
}).superRefine((data, ctx) => {
  if (data.adjustEstimate === 'new' && !data.newEstimate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['newEstimate'],
      message: 'newEstimate is required when adjustEstimate is "new"',
    })
  }
  if (data.adjustEstimate === 'manual' && !data.increaseBy) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['increaseBy'],
      message: 'increaseBy is required when adjustEstimate is "manual"',
    })
  }
})

export const updateWorklogSchema = z.object({
  timeSpent: jiraDurationSchema,
  started: z.string().min(1, 'started is required'),
  comment: z.string().optional().default(''),
  adjustEstimate: z.enum(['auto', 'leave', 'new', 'manual']).default('auto'),
  newEstimate: jiraDurationSchema.optional(),
  increaseBy: jiraDurationSchema.optional(),
}).superRefine((data, ctx) => {
  if (data.adjustEstimate === 'new' && !data.newEstimate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['newEstimate'],
      message: 'newEstimate is required when adjustEstimate is "new"',
    })
  }
  if (data.adjustEstimate === 'manual' && !data.increaseBy) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['increaseBy'],
      message: 'increaseBy is required when adjustEstimate is "manual"',
    })
  }
})

export const updateTimetrackingSchema = z
  .object({
    originalEstimate: jiraDurationSchema.optional(),
    remainingEstimate: jiraDurationSchema.optional(),
  })
  .refine((data) => data.originalEstimate !== undefined || data.remainingEstimate !== undefined, {
    message: 'At least one of originalEstimate or remainingEstimate must be provided',
  })

export const transitionIssueSchema = z.object({
  transitionId: z.string().min(1, 'transitionId is required'),
})

export const createStorySchema = z.object({
  summary: z.string().trim().min(1, 'summary is required'),
  issueTypeId: z.string().trim().min(1, 'issueTypeId is required'),
  componentIds: z.array(z.string().min(1)).min(1, 'At least one component is required'),
  valor: z.string().trim().min(1, 'valor is required'),
  description: z.string().trim().optional().default(''),
  parentKey: z
    .string()
    .trim()
    .regex(/^[A-Z][A-Z0-9]+-\d+$/i, 'parentKey must be a Jira issue key')
    .optional()
    .nullable()
    .transform((v) => (v ? v.toUpperCase() : null)),
  pilarId: z
    .string()
    .trim()
    .min(1)
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
  storyPoints: z
    .union([z.number(), z.null(), z.undefined()])
    .optional()
    .transform((v) => (v === undefined || v === null ? null : v))
    .refine((v) => v === null || (Number.isInteger(v) && v >= 0), {
      message: 'storyPoints must be a non-negative integer',
    }),
  acceptanceCriteria: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (typeof v === 'string' && v.trim() ? v.trim() : null)),
})

const storyFieldBackupSchema = z
  .object({
    summary: z.string().optional(),
    description: z.string().optional(),
    acceptanceCriteria: z.string().optional(),
  })
  .partial()
  .optional()

export const updateStorySchema = createStorySchema.extend({
  fieldBackup: storyFieldBackupSchema,
})

export const listStoryParentsSchema = z.object({
  includeDone: z
    .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
    .optional()
    .default(false)
    .transform((v) => v === true || v === 'true' || v === '1'),
  q: z.string().trim().optional().default(''),
})
