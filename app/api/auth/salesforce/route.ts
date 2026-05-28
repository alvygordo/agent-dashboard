import { NextResponse } from 'next/server'
import { randomBytes, createHash } from 'crypto'

export async function GET() {
  const codeVerifier = randomBytes(32).toString('base64url')
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url')

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.SF_CONSUMER_KEY!,
    redirect_uri: process.env.SF_CALLBACK_URL!,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256'
  })

  const sfDomain = process.env.NEXT_PUBLIC_ENV === 'production'
    ? 'https://trilogy-sales.my.salesforce.com'
    : 'https://trilogy-sales--full.sandbox.my.salesforce.com'

  const authUrl = `${sfDomain}/services/oauth2/authorize?${params}`

  const response = NextResponse.redirect(authUrl)
  response.cookies.set('sf_code_verifier', codeVerifier, {
    httpOnly: true,
    maxAge: 300,
    path: '/'
  })

  return response
}
