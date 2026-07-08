import { NextRequest, NextResponse } from 'next/server'
import { agentForVercelProject } from '@/lib/deploy-log-config'
import { logDeployToNotion } from '@/lib/notion-deploy-log'
import {
  deploymentCommitMessage,
  deploymentCommitSha,
  parseDeploymentEvent,
  verifyVercelWebhookSignature,
} from '@/lib/vercel-webhook'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const secret = process.env.VERCEL_DEPLOY_WEBHOOK_SECRET
  if (!secret) {
    return NextResponse.json(
      { error: 'VERCEL_DEPLOY_WEBHOOK_SECRET is not configured.' },
      { status: 503 },
    )
  }

  const rawBody = await req.text()
  const signature = req.headers.get('x-vercel-signature')

  if (!verifyVercelWebhookSignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 403 })
  }

  let event
  try {
    event = parseDeploymentEvent(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  if (event.type !== 'deployment.succeeded') {
    return NextResponse.json({ ok: true, skipped: event.type })
  }

  const target = event.payload?.target
  if (target !== 'production') {
    return NextResponse.json({ ok: true, skipped: 'non-production' })
  }

  const deployment = event.payload?.deployment
  const projectName = deployment?.name ?? event.payload?.project?.name
  if (!projectName) {
    return NextResponse.json({ error: 'Missing project name in payload.' }, { status: 400 })
  }

  const agent = agentForVercelProject(projectName)
  if (!agent) {
    return NextResponse.json({ ok: true, skipped: `unknown-project:${projectName}` })
  }

  if (agent.includes('(sandbox)')) {
    return NextResponse.json({ ok: true, skipped: 'sandbox-project' })
  }

  const meta = deployment?.meta
  const commit = deploymentCommitMessage(meta)

  try {
    await logDeployToNotion({
      agent,
      commit,
      deployUrl: deployment?.url,
      deploymentId: deployment?.id,
      commitSha: deploymentCommitSha(meta),
    })
    return NextResponse.json({ ok: true, agent, commit })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Notion write failed.'
    console.error('vercel-deploy-webhook:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
