import type { JiraApiError } from './jiraErrors'
import { getJiraClient } from './jiraClient'

const MEDIA_FILE_ID_RE =
  /\/file\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/i

type AttachmentMeta = { id?: string }

function extractMediaFileId(location: string | null | undefined): string | null {
  if (!location) return null
  const match = location.match(MEDIA_FILE_ID_RE)
  return match?.[1]?.toLowerCase() ?? null
}

/**
 * ADF media nodes use Media Platform file IDs, not Jira attachment IDs.
 * Resolve by probing `/attachment/content/{id}` redirect Location for each issue attachment.
 */
export async function fetchIssueMediaBinary(
  issueKey: string,
  fileId: string,
): Promise<
  | { ok: true; data: Buffer; contentType: string }
  | { ok: false; error: JiraApiError }
> {
  const jira = getJiraClient()
  const normalizedFileId = fileId.trim().toLowerCase()
  if (!normalizedFileId) {
    return {
      ok: false,
      error: { statusCode: 400, message: 'Missing media file id' },
    }
  }

  const issueResult = await jira.get<{
    fields?: { attachment?: AttachmentMeta[] }
  }>(`/rest/api/3/issue/${encodeURIComponent(issueKey)}?fields=attachment`)
  if (!issueResult.ok) return issueResult

  const attachments = Array.isArray(issueResult.data.fields?.attachment)
    ? issueResult.data.fields.attachment
    : []

  for (const attachment of attachments) {
    const attachmentId = String(attachment?.id ?? '').trim()
    if (!attachmentId) continue

    const redirect = await jira.getRedirectLocation(
      `/rest/api/3/attachment/content/${encodeURIComponent(attachmentId)}`,
    )
    if (!redirect.ok) continue

    const mediaId = extractMediaFileId(redirect.data)
    if (!mediaId || mediaId !== normalizedFileId) continue

    const binary = await jira.getBinary(
      `/rest/api/3/attachment/content/${encodeURIComponent(attachmentId)}`,
    )
    if (!binary.ok) return binary
    return {
      ok: true,
      data: binary.data,
      contentType: binary.contentType,
    }
  }

  return {
    ok: false,
    error: {
      statusCode: 404,
      message: 'Media file not found among issue attachments',
    },
  }
}
