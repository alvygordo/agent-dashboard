import type { Connection } from 'jsforce'

export type PrimaryQuoteInfo = {
  id: string
  name: string | null
  quoteNumber: string | null
  status: string | null
  quoteUrl: string
  unsignedAttachmentUrl: string | null
  unsignedAttachmentTitle: string | null
}

type QuoteRow = {
  Id: string
  Name?: string
  SBQQ__Status__c?: string | null
}

type LinkRow = {
  ContentDocumentId: string
  ContentDocument?: {
    Title?: string
    FileExtension?: string | null
  } | null
}

function contentDocumentUrl(lightningBase: string, contentDocumentId: string): string {
  return `${lightningBase}/lightning/r/ContentDocument/${contentDocumentId}/view`
}

function pickUnsignedAttachment(links: LinkRow[]): LinkRow | null {
  const pdfs = links.filter((l) => {
    const ext = (l.ContentDocument?.FileExtension ?? '').toLowerCase()
    const title = (l.ContentDocument?.Title ?? '').toLowerCase()
    return ext === 'pdf' || title.endsWith('.pdf')
  })

  const candidates = pdfs.length > 0 ? pdfs : links

  const unsigned = candidates.find((l) => {
    const title = (l.ContentDocument?.Title ?? '').toLowerCase()
    return title.includes('unsigned') || (!title.includes('signed') && !title.includes('po'))
  })

  return unsigned ?? candidates[0] ?? null
}

async function fetchQuoteAttachments(
  conn: Connection,
  quoteId: string,
  lightningBase: string,
): Promise<{ url: string | null; title: string | null }> {
  try {
    const safeId = quoteId.replace(/'/g, "\\'")
    const links = await conn.query<LinkRow>(
      `SELECT ContentDocumentId, ContentDocument.Title, ContentDocument.FileExtension
       FROM ContentDocumentLink
       WHERE LinkedEntityId = '${safeId}'
       ORDER BY SystemModstamp DESC
       LIMIT 25`,
    )
    const pick = pickUnsignedAttachment(links.records)
    if (!pick?.ContentDocumentId) return { url: null, title: null }
    return {
      url: contentDocumentUrl(lightningBase, pick.ContentDocumentId),
      title: pick.ContentDocument?.Title ?? null,
    }
  } catch {
    return { url: null, title: null }
  }
}

async function fetchQuoteRow(conn: Connection, quoteId: string): Promise<QuoteRow | null> {
  const safeId = quoteId.replace(/'/g, "\\'")
  try {
    const q = await conn.query<QuoteRow>(
      `SELECT Id, Name, SBQQ__Status__c
       FROM SBQQ__Quote__c
       WHERE Id = '${safeId}'
       LIMIT 1`,
    )
    return q.records[0] ?? null
  } catch {
    return null
  }
}

export async function fetchPrimaryQuoteInfo(
  conn: Connection,
  quoteId: string,
  lightningBase: string,
  statusHint?: string | null,
): Promise<PrimaryQuoteInfo | null> {
  const quote = await fetchQuoteRow(conn, quoteId)
  const attachments = await fetchQuoteAttachments(conn, quoteId, lightningBase)

  if (!quote) {
    if (!statusHint?.trim() && !attachments.url) return null
    return {
      id: quoteId,
      name: null,
      quoteNumber: null,
      status: statusHint?.trim() ?? null,
      quoteUrl: `${lightningBase}/lightning/r/SBQQ__Quote__c/${quoteId}/view`,
      unsignedAttachmentUrl: attachments.url,
      unsignedAttachmentTitle: attachments.title,
    }
  }

  return {
    id: quote.Id,
    name: quote.Name ?? null,
    quoteNumber: quote.Name ?? null,
    status: quote.SBQQ__Status__c ?? statusHint?.trim() ?? null,
    quoteUrl: `${lightningBase}/lightning/r/SBQQ__Quote__c/${quote.Id}/view`,
    unsignedAttachmentUrl: attachments.url,
    unsignedAttachmentTitle: attachments.title,
  }
}

type OppArQuoteRow = {
  Id: string
  AR_Quote__c: string | null
  AR_Quote__r?: {
    Name?: string | null
    SBQQ__Status__c?: string | null
  } | null
}

/** AR Quote on the opportunity (`AR_Quote__c`) — not the CPQ primary quote. */
export async function fetchArQuotesByOpp(
  conn: Connection,
  oppIds: string[],
  lightningBase: string,
): Promise<Map<string, PrimaryQuoteInfo>> {
  const uniqueIds = [...new Set(oppIds.filter(Boolean))]
  if (uniqueIds.length === 0) return new Map()

  const inClause = uniqueIds.map((id) => `'${id.replace(/'/g, "\\'")}'`).join(',')
  const result = await conn.query<OppArQuoteRow>(
    `SELECT Id, AR_Quote__c,
            AR_Quote__r.Name,
            AR_Quote__r.SBQQ__Status__c
     FROM Opportunity
     WHERE Id IN (${inClause})
     AND AR_Quote__c != null`,
  )

  const byOpp = new Map<string, PrimaryQuoteInfo>()
  for (const row of result.records) {
    const quoteId = row.AR_Quote__c
    if (!quoteId) continue
    const name = row.AR_Quote__r?.Name ?? null
    byOpp.set(row.Id, {
      id: quoteId,
      name,
      quoteNumber: name,
      status: row.AR_Quote__r?.SBQQ__Status__c ?? null,
      quoteUrl: `${lightningBase}/lightning/r/SBQQ__Quote__c/${quoteId}/view`,
      unsignedAttachmentUrl: null,
      unsignedAttachmentTitle: null,
    })
  }

  return byOpp
}

/** CPQ quotes by Id (for Cancel AR Quotes tasks linked directly to SBQQ__Quote__c). */
export async function fetchQuotesById(
  conn: Connection,
  quoteIds: string[],
  lightningBase: string,
): Promise<Map<string, PrimaryQuoteInfo>> {
  const uniqueIds = [...new Set(quoteIds.filter(Boolean))]
  if (uniqueIds.length === 0) return new Map()

  const inClause = uniqueIds.map((id) => `'${id.replace(/'/g, "\\'")}'`).join(',')
  const result = await conn.query<QuoteRow>(
    `SELECT Id, Name, SBQQ__Status__c
     FROM SBQQ__Quote__c
     WHERE Id IN (${inClause})`,
  )

  const byId = new Map<string, PrimaryQuoteInfo>()
  for (const row of result.records) {
    byId.set(row.Id, {
      id: row.Id,
      name: row.Name ?? null,
      quoteNumber: row.Name ?? null,
      status: row.SBQQ__Status__c ?? null,
      quoteUrl: `${lightningBase}/lightning/r/SBQQ__Quote__c/${row.Id}/view`,
      unsignedAttachmentUrl: null,
      unsignedAttachmentTitle: null,
    })
  }

  return byId
}
