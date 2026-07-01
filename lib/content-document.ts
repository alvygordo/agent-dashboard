import type { Connection } from 'jsforce'

export function parseContentDocumentId(url: string): string | null {
  const trimmed = url.trim()
  if (!trimmed) return null
  const docMatch = trimmed.match(/ContentDocument\/([a-zA-Z0-9]{15,18})/i)
  if (docMatch) return docMatch[1]
  const versionMatch = trimmed.match(/ContentVersion\/([a-zA-Z0-9]{15,18})/i)
  return versionMatch ? versionMatch[1] : null
}

type ContentMeta = {
  contentDocumentId: string
  latestVersionId: string
  title: string
  fileExtension: string | null
}

async function resolveContentMeta(
  conn: Connection,
  idFromUrl: string,
): Promise<ContentMeta | null> {
  // ContentDocument id (069...)
  if (idFromUrl.startsWith('069')) {
    const docRes = await conn.query<{
      Id: string
      Title: string
      FileExtension: string | null
      LatestPublishedVersionId: string
    }>(
      `SELECT Id, Title, FileExtension, LatestPublishedVersionId
       FROM ContentDocument
       WHERE Id = '${idFromUrl.replace(/'/g, "\\'")}'
       LIMIT 1`,
    )
    const doc = docRes.records[0]
    if (!doc?.LatestPublishedVersionId) return null
    return {
      contentDocumentId: doc.Id,
      latestVersionId: doc.LatestPublishedVersionId,
      title: doc.Title,
      fileExtension: doc.FileExtension ?? null,
    }
  }

  // ContentVersion id (068...)
  const cvRes = await conn.query<{
    Id: string
    ContentDocumentId: string
    Title: string
    FileExtension: string | null
  }>(
    `SELECT Id, ContentDocumentId, Title, FileExtension
     FROM ContentVersion
     WHERE Id = '${idFromUrl.replace(/'/g, "\\'")}'
     LIMIT 1`,
  )
  const cv = cvRes.records[0]
  if (!cv) return null
  return {
    contentDocumentId: cv.ContentDocumentId,
    latestVersionId: cv.Id,
    title: cv.Title,
    fileExtension: cv.FileExtension ?? null,
  }
}

export type DownloadedDocument = {
  buffer: Buffer
  title: string
  fileExtension: string | null
  contentDocumentId: string
}

export async function downloadContentDocument(
  conn: Connection,
  url: string,
): Promise<DownloadedDocument | null> {
  const idFromUrl = parseContentDocumentId(url)
  if (!idFromUrl) return null

  const meta = await resolveContentMeta(conn, idFromUrl)
  if (!meta) return null

  const downloadUrl =
    `${conn.instanceUrl}/services/data/v${conn.version}/sobjects/ContentVersion/${meta.latestVersionId}/VersionData`

  const res = await fetch(downloadUrl, {
    headers: { Authorization: `Bearer ${conn.accessToken}` },
  })
  if (!res.ok) return null

  const bytes = await res.arrayBuffer()
  return {
    buffer: Buffer.from(bytes),
    title: meta.title,
    fileExtension: meta.fileExtension,
    contentDocumentId: meta.contentDocumentId,
  }
}
