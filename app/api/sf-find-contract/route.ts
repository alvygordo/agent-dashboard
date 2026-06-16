import { NextRequest, NextResponse } from 'next/server'
import jsforce from 'jsforce'

type FileRecord = {
  ContentDocumentId: string
  ContentDocument: {
    Title: string
    FileType: string
    ContentSize: number
    CreatedDate: string
    LatestPublishedVersionId: string
  }
}

type OppRecord = {
  Id: string
  Name: string
  AccountId: string | null
}

const CONTRACT_KEYWORDS = [
  'master service', 'msa', 'master agreement', 'subscription agreement',
  'order form', 'statement of work', 'sow', 'amendment', 'addendum',
  'renewal', 'contract', 'agreement', 'license', 'terms',
]

function scoreFile(title: string): number {
  const t = title.toLowerCase()
  let score = 0
  for (const kw of CONTRACT_KEYWORDS) {
    if (t.includes(kw)) score += kw.length > 6 ? 2 : 1
  }
  if (t.endsWith('.pdf') || t.includes('pdf')) score += 1
  if (t.includes('signed') || t.includes('executed')) score += 3
  return score
}

export async function GET(req: NextRequest) {
  const oppName = req.nextUrl.searchParams.get('opp')
  if (!oppName) return NextResponse.json({ error: 'opp param required' }, { status: 400 })

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

    const safe = oppName.replace(/'/g, "\\'")
    const oppResult = await conn.query<OppRecord>(
      `SELECT Id, Name, AccountId FROM Opportunity WHERE Name LIKE '%${safe}%' ORDER BY CloseDate DESC LIMIT 5`
    )

    if (!oppResult.records.length) {
      return NextResponse.json({ error: 'Opportunity not found', files: [] })
    }

    const opp = oppResult.records[0]
    const oppId = opp.Id

    const fileResult = await conn.query<FileRecord>(
      `SELECT ContentDocumentId,
              ContentDocument.Title,
              ContentDocument.FileType,
              ContentDocument.ContentSize,
              ContentDocument.CreatedDate,
              ContentDocument.LatestPublishedVersionId
       FROM ContentDocumentLink
       WHERE LinkedEntityId = '${oppId}'
         AND ContentDocument.FileType IN ('PDF','WORD','DOCX','DOC')
       ORDER BY ContentDocument.CreatedDate DESC
       LIMIT 50`
    )

    const scored = fileResult.records
      .map(f => ({
        contentDocumentId: f.ContentDocumentId,
        title: f.ContentDocument.Title,
        fileType: f.ContentDocument.FileType,
        createdDate: f.ContentDocument.CreatedDate,
        url: `${instanceUrl}/lightning/r/ContentDocument/${f.ContentDocumentId}/view`,
        score: scoreFile(f.ContentDocument.Title),
      }))
      .sort((a, b) => b.score - a.score)

    const best = scored[0] ?? null

    return NextResponse.json({
      oppId,
      oppName: opp.Name,
      oppUrl: `${instanceUrl}/lightning/r/Opportunity/${oppId}/view`,
      contract: best,
      allFiles: scored.slice(0, 5),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
