const NOTION_DATA_SOURCE_ID =
  process.env.NOTION_BUILD_LOG_DATA_SOURCE_ID ??
  '38a85e92-7d31-80c4-aca9-000bf6440696'
const NOTION_DATABASE_ID =
  process.env.NOTION_BUILD_LOG_DATABASE_ID ?? '38a85e927d3180c1bba5ccc08b96c257'

function commitType(commit: string): string {
  const prefix = commit.split(':')[0]?.trim() ?? ''
  switch (prefix) {
    case 'feat':
    case 'fix':
    case 'chore':
    case 'revert':
    case 'debug':
    case 'temp':
      return prefix
    case 'docs':
      return 'chore'
    default:
      return prefix.startsWith('Merge') ? 'Merge sandbox' : 'chore'
  }
}

async function postNotionPage(
  token: string,
  version: string,
  payload: Record<string, unknown>,
): Promise<boolean> {
  const res = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Notion-Version': version,
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const body = await res.text()
    console.error(`Notion API ${version} failed (${res.status}): ${body}`)
    return false
  }

  return true
}

export async function logCommitToNotionBuildLog(
  commit: string,
  dateIso?: string,
): Promise<void> {
  const token = process.env.NOTION_TOKEN
  if (!token) {
    throw new Error('NOTION_TOKEN is not configured on Vercel.')
  }

  const date = (dateIso ?? new Date().toISOString()).slice(0, 10)
  const type = commitType(commit)

  const properties = {
    Commit: { title: [{ type: 'text', text: { content: commit } }] },
    Date: { date: { start: date } },
    Type: { select: { name: type } },
  }

  const modernPayload = {
    parent: { data_source_id: NOTION_DATA_SOURCE_ID },
    properties,
  }

  const classicPayload = {
    parent: { database_id: NOTION_DATABASE_ID },
    properties,
  }

  if (await postNotionPage(token, '2025-09-03', modernPayload)) return
  if (await postNotionPage(token, '2022-06-28', classicPayload)) return

  throw new Error('Both Notion API attempts failed.')
}
