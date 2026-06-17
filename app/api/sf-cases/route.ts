import { NextRequest, NextResponse } from 'next/server'
import jsforce from 'jsforce'

type CaseRecord = {
  Id: string
  CaseNumber: string
  Subject: string
  Status: string
  Priority: string
  Account: { Name: string } | null
  CreatedDate: string
}

export async function GET(req: NextRequest) {
  const email = req.cookies.get('agent_dashboard_user')?.value

  const username    = process.env.SALESFORCE_USERNAME
  const password    = process.env.SALESFORCE_PASSWORD
  const token       = process.env.SALESFORCE_TOKEN
  const instanceUrl = process.env.SALESFORCE_INSTANCE_URL ?? 'https://trilogy-sales.lightning.force.com'

  if (!username || !password || !token) {
    return NextResponse.json({ error: 'SF credentials not configured' }, { status: 500 })
  }

  try {
    const conn = new jsforce.Connection({ loginUrl: 'https://login.salesforce.com' })
    await conn.login(username, password + token)

    const ownerFilter = email
      ? `AND Owner.Email = '${email.replace(/'/g, "\\'")}'`
      : ''

    const result = await conn.query<CaseRecord>(
      `SELECT Id, CaseNumber, Subject, Status, Priority, Account.Name, CreatedDate
       FROM Case
       WHERE IsClosed = false
       AND Status NOT IN ('Legal Completed', 'Closed', 'Not Actionable / Rejected')
       ${ownerFilter}
       ORDER BY CreatedDate DESC
       LIMIT 200`
    )

    const cases = result.records.map(c => ({
      id:          c.Id,
      caseNumber:  c.CaseNumber,
      subject:     c.Subject,
      status:      c.Status,
      priority:    c.Priority,
      accountName: c.Account?.Name ?? null,
      createdDate: c.CreatedDate,
      url:         `${instanceUrl}/lightning/r/Case/${c.Id}/view`,
    }))

    return NextResponse.json({ cases, total: cases.length })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
