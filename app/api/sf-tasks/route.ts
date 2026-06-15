import { NextRequest, NextResponse } from 'next/server'
import jsforce from 'jsforce'

type SFTaskRecord = {
  Id: string
  Subject: string
  WhatId: string | null
  What: { Name: string } | null
  Priority: string
  ActivityDate: string | null
}

export async function GET(req: NextRequest) {
  const email = req.cookies.get('agent_dashboard_user')?.value
  if (!email) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

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

    const safeEmail = email.replace(/'/g, "\\'")
    const result = await conn.query<SFTaskRecord>(
      `SELECT Id, Subject, WhatId, What.Name, Priority, ActivityDate
       FROM Task
       WHERE IsClosed = false
       AND Owner.Email = '${safeEmail}'
       ORDER BY Priority DESC NULLS LAST, ActivityDate ASC NULLS LAST
       LIMIT 200`
    )

    const tasks = result.records.map(t => ({
      id:       t.Id,
      subject:  t.Subject,
      whatId:   t.WhatId ?? null,
      whatName: t.What?.Name ?? null,
      priority: t.Priority,
      dueDate:  t.ActivityDate,
      taskUrl:  `${instanceUrl}/lightning/r/Task/${t.Id}/view`,
      oppUrl:   t.WhatId ? `${instanceUrl}/lightning/r/Opportunity/${t.WhatId}/view` : null,
    }))

    return NextResponse.json({ tasks, userEmail: email })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
