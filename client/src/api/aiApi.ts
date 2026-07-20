import { httpClient } from './httpClient'
import type { ImproveFieldId } from '../utils/aiImprovePrompt'

export interface ImproveFieldParams {
  fields: ImproveFieldId[]
  summary: string
  description: string
  acceptanceCriteria?: string
  componentName: string | null
  valor: string
  projectKey: string
  projectName: string
  issueTypeName: string
  unOptionValue: string
}

export interface ImproveFieldResponse {
  improvedValue: string
  improvedSummary?: string
  rationale?: string
  missingSections?: string[]
  followUpQuestions?: string[]
}

export type AiWorkerStatusReason = 'ok' | 'not_configured' | 'unhealthy' | 'unreachable'

export interface AiWorkerStatus {
  configured: boolean
  available: boolean
  reason: AiWorkerStatusReason
}

export const aiApi = {
  getStatus: (): Promise<AiWorkerStatus> => httpClient.get<AiWorkerStatus>('/api/ai/status'),

  improveField: (params: ImproveFieldParams): Promise<ImproveFieldResponse> =>
    httpClient.post<ImproveFieldResponse>('/api/ai/improve-summary', params),

  /** @deprecated use improveField */
  improveSummary: (params: ImproveFieldParams): Promise<ImproveFieldResponse> =>
    httpClient.post<ImproveFieldResponse>('/api/ai/improve-summary', params),
}
