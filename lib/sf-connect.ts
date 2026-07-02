import jsforce, { type Connection } from 'jsforce'

export function sfLoginUrl() {
  return process.env.NEXT_PUBLIC_ENV === 'production'
    ? 'https://login.salesforce.com'
    : 'https://test.salesforce.com'
}

export async function connectSalesforce(): Promise<Connection> {
  const username = process.env.SALESFORCE_USERNAME
  const password = process.env.SALESFORCE_PASSWORD
  const token = process.env.SALESFORCE_TOKEN
  if (!username || !password || !token) {
    throw new Error('SF credentials not configured')
  }
  const conn = new jsforce.Connection({ loginUrl: sfLoginUrl() })
  await conn.login(username, password + token)
  return conn
}
