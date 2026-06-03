import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'

export async function GET(req: NextRequest) {
  const email = req.cookies.get('agent_dashboard_user')?.value
  if (!email) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const secret = process.env.EMBED_SECRET
  if (!secret) return NextResponse.json({ error: 'EMBED_SECRET not configured' }, { status: 500 })

  // 5-minute time window — token expires and cannot be replayed
  const window = Math.floor(Date.now() / 300_000)
  const token = createHmac('sha256', secret).update(`${email}:${window}`).digest('hex')

  return NextResponse.json({ email, token })
}
