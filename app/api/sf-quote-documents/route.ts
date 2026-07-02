import { NextRequest, NextResponse } from 'next/server'
import { downloadContentDocument } from '@/lib/content-document'
import { parsePdfBuffer } from '@/lib/pdf-text'
import {
  buildDocumentAnalysis,
  type DocumentAnalysisBundle,
  type SfAlignmentInput,
} from '@/lib/quote-alignment'
import type { QuoteReviewMode } from '@/lib/quote-review-mode'
import { type ExtractOptions, parseDocumentText } from '@/lib/quote-field-extract'
import { connectSalesforce } from '@/lib/sf-connect'

export const maxDuration = 60

type AnalyzeRequest = {
  analysisMode: QuoteReviewMode
  comparePo?: boolean
  unsignedQuoteUrl?: string
  signedQuoteUrl?: string
  purchaseOrderUrl?: string
  salesforce: SfAlignmentInput
}

async function analyzeUrl(
  conn: Awaited<ReturnType<typeof connectSalesforce>>,
  url: string,
  docKind: 'quote' | 'po',
  extractOptions?: ExtractOptions,
): Promise<{ doc: ReturnType<typeof parseDocumentText> | null; error: string | null }> {
  const trimmed = url.trim()
  if (!trimmed) return { doc: null, error: null }

  try {
    const downloaded = await downloadContentDocument(conn, trimmed)
    if (!downloaded.ok) {
      return { doc: null, error: downloaded.message }
    }

    const ext = (downloaded.fileExtension ?? '').toLowerCase()
    if (ext && ext !== 'pdf') {
      return {
        doc: null,
        error: `Document is ${ext.toUpperCase()}, not PDF — open manually to review.`,
      }
    }

    const parsed = await parsePdfBuffer(downloaded.buffer)
    const doc = parseDocumentText(parsed.text, {
      title: downloaded.title,
      pageCount: parsed.pageCount,
      pageTexts: parsed.pageTexts,
      docKind,
      productHint: extractOptions?.productHint,
      expectedTotal: extractOptions?.expectedTotal,
      mirrorSupplier: extractOptions?.mirrorSupplier,
      termHint: extractOptions?.termHint,
      quoteNumberHint: extractOptions?.quoteNumberHint,
      renewalDateHint: extractOptions?.renewalDateHint,
      expiryDateHint: extractOptions?.expiryDateHint,
    })
    return { doc, error: null }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown parse error'
    return { doc: null, error: message }
  }
}

const VALID_MODES = new Set<QuoteReviewMode>([
  'quote-signed-adobe',
  'quote-signed-manual',
  'po-received',
])

export async function POST(req: NextRequest) {
  const email = req.cookies.get('agent_dashboard_user')?.value
  if (!email) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  let body: AnalyzeRequest
  try {
    body = await req.json() as AnalyzeRequest
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const mode = body.analysisMode ?? 'quote-signed-manual'
  if (!VALID_MODES.has(mode)) {
    return NextResponse.json({ error: 'Invalid analysis mode' }, { status: 400 })
  }

  const needsUnsigned = mode === 'quote-signed-manual' || mode === 'po-received'
  const needsSigned = mode === 'quote-signed-adobe' || mode === 'quote-signed-manual'

  if (needsUnsigned && !body.unsignedQuoteUrl?.trim()) {
    return NextResponse.json({ error: 'Unsigned quote URL is required for this Win Type path' }, { status: 400 })
  }
  if (needsSigned && !body.signedQuoteUrl?.trim()) {
    return NextResponse.json({ error: 'Signed quote URL is required for this Win Type path' }, { status: 400 })
  }
  if (mode === 'po-received' && !body.purchaseOrderUrl?.trim()) {
    return NextResponse.json({ error: 'Purchase order URL is required for PO Received' }, { status: 400 })
  }

  try {
    const conn = await connectSalesforce()
    const comparePo = body.comparePo !== false
    const poProvided = comparePo && Boolean(body.purchaseOrderUrl?.trim())
    const productHint = body.salesforce.product
    const termHint = body.salesforce.currentTerm
    const arrHint = body.salesforce.currentArr != null
      ? `$${body.salesforce.currentArr.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : null

    const unsignedResult = needsUnsigned && body.unsignedQuoteUrl?.trim()
      ? await analyzeUrl(conn, body.unsignedQuoteUrl, 'quote', {
          productHint,
          docKind: 'quote',
          termHint,
          quoteNumberHint: body.salesforce.primaryQuoteNumber ?? null,
          renewalDateHint: body.salesforce.renewalDate,
          expiryDateHint: body.salesforce.expiryDate,
        })
      : { doc: null, error: null }

    const signedResult = needsSigned && body.signedQuoteUrl?.trim()
      ? await analyzeUrl(conn, body.signedQuoteUrl, 'quote', {
          productHint,
          docKind: 'quote',
          termHint,
          expectedTotal: unsignedResult.doc?.fields.totalAmount ?? arrHint,
          quoteNumberHint:
            unsignedResult.doc?.fields.quoteNumber
            ?? body.salesforce.primaryQuoteNumber
            ?? null,
          renewalDateHint: body.salesforce.renewalDate,
          expiryDateHint: body.salesforce.expiryDate,
        })
      : { doc: null, error: null }

    const poBaselineTotal =
      mode === 'po-received'
        ? (unsignedResult.doc?.fields.totalAmount ?? arrHint)
        : (signedResult.doc?.fields.totalAmount ?? unsignedResult.doc?.fields.totalAmount ?? arrHint)

    const poResult = poProvided
      ? await analyzeUrl(conn, body.purchaseOrderUrl!, 'po', {
          docKind: 'po',
          productHint,
          expectedTotal: poBaselineTotal,
          mirrorSupplier:
            mode === 'po-received'
              ? unsignedResult.doc?.fields.supplierName ?? null
              : signedResult.doc?.fields.supplierName ?? null,
        })
      : { doc: null, error: null }

    const errors: DocumentAnalysisBundle['errors'] = []
    if (unsignedResult.error) errors.push({ doc: 'unsigned', message: unsignedResult.error })
    if (signedResult.error) errors.push({ doc: 'signed', message: signedResult.error })
    if (poResult.error) errors.push({ doc: 'po', message: poResult.error })

    const analysis = buildDocumentAnalysis(
      body.salesforce,
      unsignedResult.doc,
      signedResult.doc,
      poResult.doc,
      errors,
      poProvided,
      mode,
    )

    return NextResponse.json({
      ...analysis,
      connectedOrg: conn.instanceUrl ?? null,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
