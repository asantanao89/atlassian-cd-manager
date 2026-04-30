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
