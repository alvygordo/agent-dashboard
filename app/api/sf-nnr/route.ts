import { NextRequest, NextResponse } from 'next/server'
import jsforce from 'jsforce'

type OppRecord = {
  Id: string
  Name: string
  Customer_Termination_Deadline__c: string | null
  NNR_Required__c: string | null
  NNR_Sent__c: string | null
  Renewal_Date__c: string | null
  Sales_Ops__r: { Name: string } | null
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

    const result = await conn.query<OppRecord>(
      `SELECT Id, Name, Customer_Termination_Deadline__c, NNR_Required__c, NNR_Sent__c,
              Renewal_Date__c, Owner.Name
       FROM Opportunity
       WHERE IsClosed = false
       AND Customer_Termination_Deadline__c != null
       AND Type = 'Renewal'
       AND NNR_Required__c = 'Yes'
       AND (Handled_by_BU__c = false OR Handled_by_BU__c = null)
       AND Renewal_Date__c >= TODAY
       AND Owner.Name != 'Fionn AI'
       ORDER BY Sales_Ops__r.Name ASC NULLS LAST, Customer_Termination_Deadline__c ASC NULLS LAST
       LIMIT 500`
    )

    const opps = result.records.map(o => ({
      id:          o.Id,
      name:        o.Name,
      nnrDeadline: o.Customer_Termination_Deadline__c,
      nnrRequired: o.NNR_Required__c,
      nnrSent:     o.NNR_Sent__c,
      renewalDate: o.Renewal_Date__c,
      salesOps:    o.Sales_Ops__r?.Name ?? 'Unassigned',
      oppUrl:      `${instanceUrl}/lightning/r/Opportunity/${o.Id}/view`,
    }))

    // Group by Sales Ops
    const grouped: Record<string, typeof opps> = {}
    for (const opp of opps) {
      if (!grouped[opp.salesOps]) grouped[opp.salesOps] = []
      grouped[opp.salesOps].push(opp)
    }

    return NextResponse.json({ grouped, total: opps.length })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
