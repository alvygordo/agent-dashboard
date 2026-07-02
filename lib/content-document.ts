import type { Connection } from 'jsforce'

export type ContentDocumentDownloadResult =
  | {
      ok: true
      buffer: Buffer
      title: string
      fileExtension: string | null
      contentDocumentId: string
      versionId: string
    }
  | {
      ok: false
      stage: 'url' | 'metadata' | 'download' | 'empty'
      message: string
      contentDocumentId?: string
      versionId?: string
      httpStatus?: number
    }

export function parseContentDocumentId(url: string): string | null {
  const trimmed = url.trim()
  if (!trimmed) return null

  const docMatch = trimmed.match(/ContentDocument\/([a-zA-Z0-9]{15,18})/i)
  if (docMatch) return docMatch[1]

  const versionMatch = trimmed.match(/ContentVersion\/([a-zA-Z0-9]{15,18})/i)
  if (versionMatch) return versionMatch[1]

  const fileParam = trimmed.match(/[?&]file=([a-zA-Z0-9]{15,18})/i)
  if (fileParam) return fileParam[1]

  // Bare 15/18-char Salesforce id pasted directly
  if (/^[a-zA-Z0-9]{15,18}$/.test(trimmed)) return trimmed

  return null
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
  const safeId = idFromUrl.replace(/'/g, "\\'")

  const docRes = await conn.query<{
    Id: string
    Title: string
    FileExtension: string | null
    LatestPublishedVersionId: string
  }>(
    `SELECT Id, Title, FileExtension, LatestPublishedVersionId
     FROM ContentDocument
     WHERE Id = '${safeId}'
     LIMIT 1`,
  )
  const doc = docRes.records[0]
  if (doc?.LatestPublishedVersionId) {
    return {
      contentDocumentId: doc.Id,
      latestVersionId: doc.LatestPublishedVersionId,
      title: doc.Title,
      fileExtension: doc.FileExtension ?? null,
    }
  }

  const cvById = await conn.query<{
    Id: string
    ContentDocumentId: string
    Title: string
    FileExtension: string | null
  }>(
    `SELECT Id, ContentDocumentId, Title, FileExtension
     FROM ContentVersion
     WHERE Id = '${safeId}'
     LIMIT 1`,
  )
  const cv = cvById.records[0]
  if (cv) {
    return {
      contentDocumentId: cv.ContentDocumentId,
      latestVersionId: cv.Id,
      title: cv.Title,
      fileExtension: cv.FileExtension ?? null,
    }
  }

  const cvByDoc = await conn.query<{
    Id: string
    ContentDocumentId: string
    Title: string
    FileExtension: string | null
  }>(
    `SELECT Id, ContentDocumentId, Title, FileExtension
     FROM ContentVersion
     WHERE ContentDocumentId = '${safeId}' AND IsLatest = true
     LIMIT 1`,
  )
  const latest = cvByDoc.records[0]
  if (!latest) return null

  return {
    contentDocumentId: latest.ContentDocumentId,
    latestVersionId: latest.Id,
    title: latest.Title,
    fileExtension: latest.FileExtension ?? null,
  }
}

function orgLabelFromInstanceUrl(instanceUrl: string | undefined): string {
  if (!instanceUrl) return 'connected Salesforce org'
  if (instanceUrl.includes('sandbox')) return 'sandbox org'
  return 'production org'
}

function urlLooksProduction(url: string): boolean {
  return /trilogy-sales\.lightning\.force\.com/i.test(url)
    && !/--.*sandbox/i.test(url)
}

export async function downloadContentDocument(
  conn: Connection,
  url: string,
): Promise<ContentDocumentDownloadResult> {
  const idFromUrl = parseContentDocumentId(url)
  if (!idFromUrl) {
    return {
      ok: false,
      stage: 'url',
      message: 'Link is not a Salesforce ContentDocument URL — paste a link like …/ContentDocument/069…/view',
    }
  }

  let meta: ContentMeta | null
  try {
    meta = await resolveContentMeta(conn, idFromUrl)
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : 'metadata query failed'
    return {
      ok: false,
      stage: 'metadata',
      message: `Could not look up file in ${orgLabelFromInstanceUrl(conn.instanceUrl)} (${detail}).`,
      contentDocumentId: idFromUrl,
    }
  }

  if (!meta) {
    const orgHint = orgLabelFromInstanceUrl(conn.instanceUrl)
    const prodUrlOnSandbox =
      urlLooksProduction(url) && orgHint === 'sandbox org'
        ? ' This link points at production Lightning — the sandbox API cannot read production-only files. Open the file in sandbox Salesforce and paste that link instead.'
        : ''
    return {
      ok: false,
      stage: 'metadata',
      message: `File ${idFromUrl} was not found in the ${orgHint}.${prodUrlOnSandbox}`,
      contentDocumentId: idFromUrl,
    }
  }

  const downloadUrl =
    `${conn.instanceUrl}/services/data/v${conn.version}/sobjects/ContentVersion/${meta.latestVersionId}/VersionData`

  let res: Response
  try {
    res = await fetch(downloadUrl, {
      headers: {
        Authorization: `Bearer ${conn.accessToken}`,
        Accept: 'application/octet-stream',
      },
    })
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : 'network error'
    return {
      ok: false,
      stage: 'download',
      message: `Download request failed (${detail}).`,
      contentDocumentId: meta.contentDocumentId,
      versionId: meta.latestVersionId,
    }
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    const permissionHint = res.status === 403 || res.status === 404
      ? ' The integration user may lack Files access or permission to this document.'
      : ''
    return {
      ok: false,
      stage: 'download',
      message: `Download failed (HTTP ${res.status})${permissionHint}${body ? ` — ${body.slice(0, 120)}` : ''}`,
      contentDocumentId: meta.contentDocumentId,
      versionId: meta.latestVersionId,
      httpStatus: res.status,
    }
  }

  const bytes = await res.arrayBuffer()
  if (bytes.byteLength === 0) {
    return {
      ok: false,
      stage: 'empty',
      message: 'Downloaded file is empty.',
      contentDocumentId: meta.contentDocumentId,
      versionId: meta.latestVersionId,
    }
  }

  return {
    ok: true,
    buffer: Buffer.from(bytes),
    title: meta.title,
    fileExtension: meta.fileExtension,
    contentDocumentId: meta.contentDocumentId,
    versionId: meta.latestVersionId,
  }
}

/** @deprecated Use downloadContentDocument result object */
export type DownloadedDocument = {
  buffer: Buffer
  title: string
  fileExtension: string | null
  contentDocumentId: string
}
