import type { Connection } from 'jsforce'

export type OppLinkedCase = {
  id: string
  subject: string
  status: string
  oppId: string
}

type CaseRecord = {
  Id: string
  Subject: string
  Status: string
  Next_Renewal_Opportunity__c: string
}

/** Most recent Case per opportunity, matched by subject pattern on Next_Renewal_Opportunity__c. */
export async function fetchLatestCasesByOpp(
  conn: Connection,
  oppIds: string[],
  subjectLike: string,
): Promise<Map<string, OppLinkedCase>> {
  const uniqueIds = [...new Set(oppIds.filter(Boolean))]
  if (uniqueIds.length === 0) return new Map()

  const inClause = uniqueIds.map((id) => `'${id.replace(/'/g, "\\'")}'`).join(',')
  const safeLike = subjectLike.replace(/'/g, "\\'")

  const result = await conn.query<CaseRecord>(
    `SELECT Id, Subject, Status, Next_Renewal_Opportunity__c
     FROM Case
     WHERE Subject LIKE '${safeLike}'
     AND Next_Renewal_Opportunity__c IN (${inClause})
     ORDER BY CreatedDate DESC`,
  )

  const byOpp = new Map<string, OppLinkedCase>()
  for (const c of result.records) {
    if (!byOpp.has(c.Next_Renewal_Opportunity__c)) {
      byOpp.set(c.Next_Renewal_Opportunity__c, {
        id: c.Id,
        subject: c.Subject,
        status: c.Status,
        oppId: c.Next_Renewal_Opportunity__c,
      })
    }
  }
  return byOpp
}

export function sfCaseUrl(instanceUrl: string, caseId: string): string {
  return `${instanceUrl}/lightning/r/Case/${caseId}/view`
}

export function sfQuoteUrl(instanceUrl: string, quoteId: string): string {
  return `${instanceUrl}/lightning/r/SBQQ__Quote__c/${quoteId}/view`
}

export function isLegalCaseStatusTask(subject: string): boolean {
  return subject.toLowerCase().includes('update legal case status')
}

export function isSendNnrTask(subject: string): boolean {
  return subject.toLowerCase().includes('send nnr')
}
