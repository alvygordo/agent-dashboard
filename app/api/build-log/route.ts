import { NextRequest, NextResponse } from 'next/server'
import { logCommitToNotionBuildLog } from '@/lib/notion-build-log'

type GitHubPushPayload = {
  head_commit?: { message?: string; timestamp?: string }
}

export async function POST(req: NextRequest) {
  if (!process.env.NOTION_TOKEN) {
    return NextResponse.json(
      { error: 'NOTION_TOKEN is not configured on Vercel.' },
      { status: 503 },
    )
  }

  let body: { subject?: string } & GitHubPushPayload
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const commit =
    (typeof body.subject === 'string' && body.subject.trim()) ||
    (typeof body.head_commit?.message === 'string' && body.head_commit.message.trim()) ||
    ''

  if (!commit) {
    return NextResponse.json(
      { error: 'subject or head_commit.message is required.' },
      { status: 400 },
    )
  }

  try {
    await logCommitToNotionBuildLog(commit, body.head_commit?.timestamp)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
