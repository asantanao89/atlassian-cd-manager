/** Parse a Jira issue key from raw key or browse/board URL. */
export function parseJiraIssueKey(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  const browse = trimmed.match(/\/browse\/([A-Z][A-Z0-9]+-\d+)/i)
  if (browse) return browse[1].toUpperCase()

  const selected = trimmed.match(/[?&#](?:selectedIssue|issueKey)=([A-Z][A-Z0-9]+-\d+)/i)
  if (selected) return selected[1].toUpperCase()

  const keyOnly = trimmed.match(/^([A-Z][A-Z0-9]+-\d+)$/i)
  if (keyOnly) return keyOnly[1].toUpperCase()

  return null
}
