import { commitType } from '@/lib/deploy-log-config'

const NOTION_DATA_SOURCE_ID = process.env.NOTION_DEPLOY_LOG_DATA_SOURCE_ID
const NOTION_DATABASE_ID = process.env.NOTION_DEPLOY_LOG_DATABASE_ID

export type DeployLogEntry = {
  agent: string
  commit: string
  dateIso?: string
  deployUrl?: string
  deploymentId?: string
  commitSha?: string
}

async function postNotionPage(
  token: string,
  version: string,
  payload: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; status: number; body: string }> {
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
    return { ok: false, status: res.status, body: await res.text() }
  }
  return { ok: true }
}

export async function logDeployToNotion(entry: DeployLogEntry): Promise<void> {
  const token = process.env.NOTION_TOKEN
  if (!token) {
    throw new Error('NOTION_TOKEN is not configured on Vercel.')
  }
  if (!NOTION_DATA_SOURCE_ID && !NOTION_DATABASE_ID) {
    throw new Error(
      'Set NOTION_DEPLOY_LOG_DATA_SOURCE_ID or NOTION_DEPLOY_LOG_DATABASE_ID on Vercel.',
    )
  }

  const date = (entry.dateIso ?? new Date().toISOString()).slice(0, 10)
  const type = commitType(entry.commit)

  const properties: Record<string, unknown> = {
    Commit: { title: [{ type: 'text', text: { content: entry.commit.slice(0, 2000) } }] },
    Agent: { select: { name: entry.agent } },
    Date: { date: { start: date } },
    Type: { select: { name: type } },
  }

  if (entry.deployUrl) {
    properties['Deploy URL'] = { url: `https://${entry.deployUrl}` }
  }

  const modernPayload = NOTION_DATA_SOURCE_ID
    ? { parent: { data_source_id: NOTION_DATA_SOURCE_ID }, properties }
    : null

  const classicPayload = NOTION_DATABASE_ID
    ? { parent: { database_id: NOTION_DATABASE_ID }, properties }
    : null

  const errors: string[] = []

  if (modernPayload) {
    const modern = await postNotionPage(token, '2025-09-03', modernPayload)
    if (modern.ok) return
    errors.push(`Modern (${modern.status}): ${modern.body}`)
  }

  if (classicPayload) {
    const classic = await postNotionPage(token, '2022-06-28', classicPayload)
    if (classic.ok) return
    errors.push(`Classic (${classic.status}): ${classic.body}`)
  }

  throw new Error(errors.join(' | ') || 'Notion write failed.')
}
