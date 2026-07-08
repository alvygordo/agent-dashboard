import { createHmac, timingSafeEqual } from 'crypto'

export function verifyVercelWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!signatureHeader) return false

  const expected = createHmac('sha1', secret).update(rawBody).digest('hex')
  const a = Buffer.from(signatureHeader)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export type VercelDeploymentEvent = {
  type: string
  payload?: {
    target?: string | null
    deployment?: {
      id?: string
      url?: string
      name?: string
      meta?: Record<string, string | undefined>
    }
    project?: { id?: string; name?: string }
  }
}

export function parseDeploymentEvent(rawBody: string): VercelDeploymentEvent {
  return JSON.parse(rawBody) as VercelDeploymentEvent
}

export function deploymentCommitMessage(meta?: Record<string, string | undefined>): string {
  return (
    meta?.githubCommitMessage?.split('\n')[0]?.trim() ||
    meta?.gitlabCommitMessage?.split('\n')[0]?.trim() ||
    meta?.bitbucketCommitMessage?.split('\n')[0]?.trim() ||
    'Production deployment'
  )
}

export function deploymentCommitSha(meta?: Record<string, string | undefined>): string | undefined {
  return meta?.githubCommitSha || meta?.gitlabCommitSha || meta?.bitbucketCommitSha
}
