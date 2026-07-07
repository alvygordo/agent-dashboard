import { NextRequest, NextResponse } from 'next/server'
import jsforce from 'jsforce'
import {
  fetchLatestCasesByOpp,
  isLegalCaseStatusTask,
  isSendNnrTask,
  sfCaseUrl,
} from '@/lib/sf-renewal-cases'
import { fetchArQuotesByOpp, fetchQuoteTaskContextsById } from '@/lib/sf-primary-quote'
import { isCancelArQuotesTask } from '@/lib/sf-task-routing'

type SFTaskRecord = {
  Id: string
  Subject: string
  WhatId: string | null
  What: { Name: string; Type: string } | null
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
      `SELECT Id, Subject, WhatId, What.Name, What.Type, Priority, ActivityDate
       FROM Task
       WHERE IsClosed = false
       AND Owner.Email = '${safeEmail}'
       ORDER BY ActivityDate ASC NULLS LAST, Priority DESC NULLS LAST
       LIMIT 200`,
    )

    const baseTasks = result.records.map((t) => ({
      id:       t.Id,
      subject:  t.Subject,
      whatId:   t.WhatId ?? null,
      whatName: t.What?.Name ?? null,
      whatType: t.What?.Type ?? null,
      priority: t.Priority,
      dueDate:  t.ActivityDate,
      taskUrl:  `${instanceUrl}/lightning/r/Task/${t.Id}/view`,
      oppUrl:   t.WhatId && t.What?.Type === 'Opportunity'
        ? `${instanceUrl}/lightning/r/Opportunity/${t.WhatId}/view`
        : null,
      relatedToName: t.What?.Name ?? null,
      relatedToUrl: t.WhatId && t.What?.Type === 'Opportunity'
        ? `${instanceUrl}/lightning/r/Opportunity/${t.WhatId}/view`
        : null,
      caseLink: null as { url: string; status: string } | null,
      quoteLink: null as { url: string; status: string; name: string } | null,
    }))

    const legalOppIds = baseTasks
      .filter((t) => isLegalCaseStatusTask(t.subject) && t.whatId)
      .map((t) => t.whatId!)
    const nnrOppIds = baseTasks
      .filter((t) => isSendNnrTask(t.subject) && t.whatId)
      .map((t) => t.whatId!)

    const cancelArTasks = baseTasks.filter((t) => isCancelArQuotesTask(t.subject) && t.whatId)
    const cancelArOppIds = cancelArTasks
      .filter((t) => t.whatType === 'Opportunity')
      .map((t) => t.whatId!)
    const cancelArQuoteIds = cancelArTasks
      .filter((t) => t.whatType === 'SBQQ__Quote__c')
      .map((t) => t.whatId!)

    const [legalCases, nnrCases, quotesByOpp, quotesById] = await Promise.all([
      fetchLatestCasesByOpp(conn, legalOppIds, '%Legal Review%'),
      fetchLatestCasesByOpp(conn, nnrOppIds, '%NNR%'),
      fetchArQuotesByOpp(conn, cancelArOppIds, instanceUrl),
      fetchQuoteTaskContextsById(conn, cancelArQuoteIds, instanceUrl),
    ])

    const tasks = baseTasks.map((t) => {
      if (!t.whatId) return t

      if (isCancelArQuotesTask(t.subject)) {
        if (t.whatType === 'SBQQ__Quote__c') {
          const quote = quotesById.get(t.whatId)
          if (quote) {
            const oppUrl = quote.oppId
              ? `${instanceUrl}/lightning/r/Opportunity/${quote.oppId}/view`
              : t.relatedToUrl
            return {
              ...t,
              relatedToName: quote.oppName ?? t.relatedToName,
              relatedToUrl: oppUrl,
              oppUrl: oppUrl ?? t.oppUrl,
              quoteLink: {
                url: quote.quoteUrl,
                status: quote.status ?? '—',
                name: quote.quoteNumber ?? quote.name ?? 'AR Quote',
              },
            }
          }
        } else {
          const quote = quotesByOpp.get(t.whatId)
          if (quote) {
            return {
              ...t,
              quoteLink: {
                url: quote.quoteUrl,
                status: quote.status ?? '—',
                name: quote.quoteNumber ?? quote.name ?? 'AR Quote',
              },
            }
          }
        }
      }

      if (isLegalCaseStatusTask(t.subject)) {
        const legalCase = legalCases.get(t.whatId)
        if (legalCase) {
          return {
            ...t,
            caseLink: {
              url: sfCaseUrl(instanceUrl, legalCase.id),
              status: legalCase.status,
            },
          }
        }
      }

      if (isSendNnrTask(t.subject)) {
        const nnrCase = nnrCases.get(t.whatId)
        if (nnrCase) {
          return {
            ...t,
            caseLink: {
              url: sfCaseUrl(instanceUrl, nnrCase.id),
              status: nnrCase.status,
            },
          }
        }
      }

      return t
    })

    return NextResponse.json({ tasks, userEmail: email })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
