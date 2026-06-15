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

type CaseRecord = {
  Id: string
  Subject: string
  Status: string
  Next_Renewal_Opportunity__c: string
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
              Renewal_Date__c, Sales_Ops__r.Name
       FROM Opportunity
       WHERE IsClosed = false
       AND Customer_Termination_Deadline__c != null
       AND Type = 'Renewal'
       AND NNR_Required__c = 'Yes'
       AND NNR_Sent__c = 'To Be Sent'
       AND (Handled_by_BU__c = false OR Handled_by_BU__c = null)
       AND Renewal_Date__c >= TODAY
       AND Owner.Name != 'Fionn AI'
       ORDER BY Sales_Ops__r.Name ASC NULLS LAST, Customer_Termination_Deadline__c ASC NULLS LAST
       LIMIT 500`
    )

    // Fetch NNR cases for these opportunities
    const oppIds = result.records.map(o => `'${o.Id}'`).join(',')
    const caseResult = oppIds.length
      ? await conn.query<CaseRecord>(
          `SELECT Id, Subject, Status, Next_Renewal_Opportunity__c
           FROM Case
           WHERE Subject LIKE '%NNR%'
           AND Next_Renewal_Opportunity__c IN (${oppIds})
           ORDER BY CreatedDate DESC`
        )
      : { records: [] as CaseRecord[] }

    // Index cases by opp ID (keep most recent per opp)
    const caseByOpp = new Map<string, CaseRecord>()
    for (const c of caseResult.records) {
      if (!caseByOpp.has(c.Next_Renewal_Opportunity__c)) {
        caseByOpp.set(c.Next_Renewal_Opportunity__c, c)
      }
    }

    const opps = result.records.map(o => {
      const nnrCase = caseByOpp.get(o.Id)
      return {
        id:          o.Id,
        name:        o.Name,
        nnrDeadline: o.Customer_Termination_Deadline__c,
        nnrRequired: o.NNR_Required__c,
        nnrSent:     o.NNR_Sent__c,
        renewalDate: o.Renewal_Date__c,
        salesOps:    o.Sales_Ops__r?.Name ?? 'Unassigned',
        oppUrl:      `${instanceUrl}/lightning/r/Opportunity/${o.Id}/view`,
        caseId:      nnrCase?.Id ?? null,
        caseStatus:  nnrCase?.Status ?? null,
        caseUrl:     nnrCase ? `${instanceUrl}/lightning/r/Case/${nnrCase.Id}/view` : null,
      }
    })

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
