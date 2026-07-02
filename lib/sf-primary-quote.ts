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
  SBQQ__QuoteNumber__c?: string | null
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

export async function fetchPrimaryQuoteInfo(
  conn: Connection,
  quoteId: string,
  lightningBase: string,
): Promise<PrimaryQuoteInfo | null> {
  const safeId = quoteId.replace(/'/g, "\\'")

  let quote: QuoteRow | undefined
  try {
    const q = await conn.query<QuoteRow>(
      `SELECT Id, Name, SBQQ__Status__c, SBQQ__QuoteNumber__c
       FROM SBQQ__Quote__c
       WHERE Id = '${safeId}'
       LIMIT 1`,
    )
    quote = q.records[0]
  } catch {
    return null
  }

  if (!quote) return null

  let attachmentUrl: string | null = null
  let attachmentTitle: string | null = null

  try {
    const links = await conn.query<LinkRow>(
      `SELECT ContentDocumentId, ContentDocument.Title, ContentDocument.FileExtension
       FROM ContentDocumentLink
       WHERE LinkedEntityId = '${safeId}'
       ORDER BY SystemModstamp DESC
       LIMIT 25`,
    )
    const pick = pickUnsignedAttachment(links.records)
    if (pick?.ContentDocumentId) {
      attachmentUrl = contentDocumentUrl(lightningBase, pick.ContentDocumentId)
      attachmentTitle = pick.ContentDocument?.Title ?? null
    }
  } catch {
    // attachments optional
  }

  return {
    id: quote.Id,
    name: quote.Name ?? null,
    quoteNumber: quote.SBQQ__QuoteNumber__c ?? quote.Name ?? null,
    status: quote.SBQQ__Status__c ?? null,
    quoteUrl: `${lightningBase}/lightning/r/SBQQ__Quote__c/${quote.Id}/view`,
    unsignedAttachmentUrl: attachmentUrl,
    unsignedAttachmentTitle: attachmentTitle,
  }
}
