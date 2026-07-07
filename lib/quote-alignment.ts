import type { AnalysisFlag, AnalysisSeverity } from '@/lib/quote-review-analysis'
import { usesUnsignedQuoteBaseline, type QuoteReviewMode } from '@/lib/quote-review-mode'
import {
  datesAlign,
  finalizeQuoteDocumentFields,
  formatFieldValue,
  formatQuoteDateDisplay,
  normalizeDateForCompare,
  paymentTermsAlign,
  resolveProvisioningDates,
  sanitizeQuoteFields,
  type ParsedDocument,
  termDurationMonths,
  termsAlign,
  valuesAlign,
} from '@/lib/quote-field-extract'
import { formatUsDate } from '@/lib/sf-field-format'

export type AlignmentStatus = 'aligned' | 'mismatch' | 'partial' | 'unknown' | 'na'

export type AlignmentRow = {
  field: string
  salesforce: string
  signedQuote: string
  purchaseOrder: string
  status: AlignmentStatus
}

export type QuoteComparisonCheck = {
  check: string
  severity: AnalysisSeverity
  finding: string
}

export type DocumentAnalysisBundle = {
  analysisMode: QuoteReviewMode
  documentIds: {
    quoteNumber: string | null
    poNumber: string | null
    poReferencesQuote: boolean | null
    poReferencesQuoteDetail: string
  }
  unsigned: ParsedDocument | null
  signed: ParsedDocument | null
  purchaseOrder: ParsedDocument | null
  errors: { doc: string; message: string }[]
  quoteComparison: {
    unsignedPages: number | null
    signedPages: number | null
    checks: QuoteComparisonCheck[]
    summary: string
    overallSeverity: AnalysisSeverity
  }
  poAudit: {
    present: boolean
    pageCount: number | null
    summary: string
    checks: QuoteComparisonCheck[]
    overallSeverity: AnalysisSeverity
    tcConflict: 'none_detected' | 'possible_conflict' | 'unknown' | 'not_applicable'
    tcConflictNote: string
    tcConflictDetails: string[]
  }
  alignment: {
    rows: AlignmentRow[]
    overallAligned: boolean
    summary: string
    overallSeverity: AnalysisSeverity
  }
  connectedOrg?: string | null
}

export type SfAlignmentInput = {
  accountName: string | null
  product: string | null
  supportPlan: string | null
  userCount: number | null
  renewalDate: string | null
  expiryDate: string | null
  currentTerm: string | number | null
  currentArr: number | null
  paymentTerms?: string | null
  primaryQuoteNumber?: string | null
  winType?: string | null
}

export type AlignmentSummary = DocumentAnalysisBundle['alignment']

/** Salesforce-only rows — shown immediately before PDF analysis finishes. */
export function buildSfBaselineAlignment(
  sf: SfAlignmentInput,
  poProvided: boolean,
  pendingLabel = 'Pending PDF analysis',
): AlignmentSummary {
  const rows = buildAlignmentRows(sf, null, null, poProvided).map((row) => ({
    ...row,
    signedQuote: row.signedQuote === '—' ? pendingLabel : row.signedQuote,
    purchaseOrder: poProvided
      ? (row.purchaseOrder === '—' ? pendingLabel : row.purchaseOrder)
      : 'N/A',
    status: 'unknown' as AlignmentStatus,
  }))

  return {
    rows,
    overallAligned: false,
    summary: poProvided
      ? 'Salesforce values below. Signed quote and PO columns update when PDF analysis completes.'
      : 'Salesforce values below. Signed quote column updates when PDF analysis completes.',
    overallSeverity: 'pending',
  }
}

function severityFromStatuses(statuses: AlignmentStatus[]): AnalysisSeverity {
  if (statuses.some((s) => s === 'mismatch')) return 'warn'
  if (statuses.some((s) => s === 'partial' || s === 'unknown')) return 'pending'
  if (statuses.every((s) => s === 'aligned' || s === 'na')) return 'pass'
  return 'pending'
}

type CompareMode = 'three-way' | 'sf-signed' | 'signed-po' | 'product-row'

function compareAlignment(
  mode: CompareMode,
  sf: string | null,
  signed: string | null,
  po: string | null,
  poProvided: boolean,
): AlignmentStatus {
  const hasSf = Boolean(sf?.trim() && sf !== '—')
  const hasSigned = Boolean(signed?.trim() && !signed.startsWith('Not extracted'))
  const hasPo = Boolean(po?.trim() && po !== 'Not listed on PO' && !po.startsWith('Not extracted'))

  if (mode === 'signed-po') {
    if (!hasSigned && !hasPo) return 'unknown'
    if (!hasPo) return poProvided ? 'unknown' : 'na'
    if (!hasSigned) return 'unknown'
    return valuesAlign(signed, po) ? 'aligned' : 'mismatch'
  }

  if (mode === 'product-row') {
    if (hasSf && hasSigned && valuesAlign(sf, signed)) {
      if (!poProvided || !hasPo) return 'aligned'
      if (valuesAlign(sf, po) || valuesAlign(signed, po)) return 'aligned'
      return 'mismatch'
    }
    if (hasSf && hasSigned) return 'mismatch'
    return 'unknown'
  }

  if (mode === 'sf-signed') {
    if (!hasSf && !hasSigned) return 'unknown'
    if (!hasSigned) return 'unknown'
    if (!hasSf) return 'partial'
    return valuesAlign(sf, signed) ? 'aligned' : 'mismatch'
  }

  // three-way
  if (!hasSigned && !hasPo && !hasSf) return 'unknown'
  const sfSigned = hasSf && hasSigned ? valuesAlign(sf, signed) : null
  const poSigned = hasPo && hasSigned ? valuesAlign(po, signed) : null
  if (!poProvided) {
    if (sfSigned === true) return 'aligned'
    if (sfSigned === false) return 'mismatch'
    return 'unknown'
  }
  if (sfSigned === true && (poSigned === true || !hasPo)) return 'aligned'
  if (sfSigned === false || poSigned === false) return 'mismatch'
  return 'unknown'
}

function formatAlignmentDate(value: string | null | undefined): string {
  if (!value?.trim()) return '—'
  return formatQuoteDateDisplay(value)
}

function enrichQuoteDocument(doc: ParsedDocument | null): ParsedDocument | null {
  if (!doc) return null
  const fullText = doc.pageTexts.length > 0 ? doc.pageTexts.join('\n') : null
  const finalized = finalizeQuoteDocumentFields(doc.fields, fullText)
  const provisioned = resolveProvisioningDates({
    renewalDate: finalized.renewalDate,
    extractedExpiry: finalized.expiryDate,
    term: finalized.term,
  })
  return {
    ...doc,
    fields: {
      ...finalized,
      renewalDate: provisioned.renewalDate ?? finalized.renewalDate,
      expiryDate: provisioned.expiryDate ?? finalized.expiryDate,
    },
  }
}

function buildAlignmentRows(
  sf: SfAlignmentInput,
  signed: ParsedDocument | null,
  po: ParsedDocument | null,
  poProvided: boolean,
  errors: { doc: string; message: string }[] = [],
  options: { quoteVsSalesforce?: boolean } = {},
): AlignmentRow[] {
  const quoteVsSf = options.quoteVsSalesforce ?? false
  const sfFields = signedFieldsFromSf(sf)
  const sq = signed?.fields ?? null
  const poFields = po?.fields ?? null
  const signedFailed = errors.some((e) => e.doc === 'signed')
  const poFailed = errors.some((e) => e.doc === 'po')

  const poProductDisplay = poFields?.product
    ? formatFieldValue(poFields.product)
    : poProvided
      ? (poFailed ? 'Not extracted (download failed)' : 'Not listed on PO')
      : 'N/A'

  const specs: {
    field: string
    mode: CompareMode
    sf: string | null
    signed: string | null
    po: string | null
    signedDisplay?: string
    poDisplay?: string
    sfDisplay?: string
  }[] = [
    { field: 'Customer name', mode: 'three-way', sf: sfFields.customerName, signed: sq?.customerName ?? null, po: poFields?.customerName ?? null },
    { field: 'End user name', mode: 'three-way', sf: sfFields.endUserName, signed: sq?.endUserName ?? null, po: poFields?.endUserName ?? null },
    {
      field: 'Product',
      mode: 'product-row',
      sf: sfFields.product,
      signed: sq?.product ?? sfFields.product,
      po: poFields?.product ?? null,
      poDisplay: poProductDisplay,
    },
    { field: 'Support plan', mode: 'three-way', sf: sfFields.supportPlan, signed: sq?.supportPlan ?? null, po: poFields?.supportPlan ?? null },
    { field: 'Users / seats / qty', mode: 'sf-signed', sf: sfFields.quantity, signed: sq?.quantity ?? null, po: poFields?.quantity ?? null },
    {
      field: 'Renewal date (term start)',
      mode: quoteVsSf ? 'sf-signed' : 'signed-po',
      sf: sfFields.renewalDate,
      signed: sq?.renewalDate ?? null,
      po: poFields?.renewalDate ?? null,
      sfDisplay: sfFields.renewalDate
        ? `${sfFields.renewalDate}${quoteVsSf ? ' (opp renewal)' : ' (current term)'}`
        : '—',
    },
    {
      field: 'Expiry date (term end)',
      mode: quoteVsSf ? 'sf-signed' : 'signed-po',
      sf: sfFields.expiryDate,
      signed: sq?.expiryDate ?? null,
      po: poFields?.expiryDate ?? null,
      sfDisplay: sfFields.expiryDate
        ? `${sfFields.expiryDate}${quoteVsSf ? ' (prior term)' : ' (current term)'}`
        : '—',
    },
    {
      field: 'Term duration',
      mode: quoteVsSf ? 'sf-signed' : 'signed-po',
      sf: sfTermLabel(sf),
      signed: sq?.term ?? null,
      po: poFields?.term ?? null,
      sfDisplay: quoteVsSf && sfTermLabel(sf)
        ? `${sfTermLabel(sf)} (current subscription)`
        : (sfTermLabel(sf) ?? '—'),
    },
    {
      field: 'Service provider / supplier',
      mode: quoteVsSf ? 'sf-signed' : 'signed-po',
      sf: '—',
      signed: sq?.supplierName ?? null,
      po: poFields?.supplierName ?? null,
      sfDisplay: '—',
    },
    {
      field: 'Payment terms',
      mode: quoteVsSf ? 'sf-signed' : 'signed-po',
      sf: '—',
      signed: sq?.paymentTerms ?? null,
      po: poFields?.paymentTerms ?? null,
      sfDisplay: '—',
    },
  ]

  return specs.map((spec) => {
    let signedVal = spec.signed
    const poVal = spec.po
    if (quoteVsSf && spec.field === 'Expiry date (term end)' && sq?.renewalDate) {
      signedVal = resolveProvisioningDates({
        renewalDate: sq.renewalDate,
        extractedExpiry: sq.expiryDate,
        term: sq.term,
      }).expiryDate ?? signedVal
    }
    let status: AlignmentStatus

    if (spec.field === 'Payment terms') {
      if (quoteVsSf) {
        status = sq?.paymentTerms ? 'partial' : 'unknown'
      } else if (!sq?.paymentTerms && !poFields?.paymentTerms) status = 'unknown'
      else if (!sq?.paymentTerms || !poFields?.paymentTerms) status = 'unknown'
      else status = paymentTermsAlign(sq.paymentTerms, poFields.paymentTerms) ? 'aligned' : 'mismatch'
    } else if (spec.field === 'Service provider / supplier') {
      status = quoteVsSf
        ? (sq?.supplierName ? 'partial' : 'unknown')
        : compareAlignment('signed-po', null, sq?.supplierName ?? null, poFields?.supplierName ?? null, poProvided)
    } else if (spec.field === 'Renewal date (term start)') {
      if (quoteVsSf) {
        const sfRenewalCandidates = [sf.renewalDate, sfFields.renewalDate].filter(Boolean)
        status = !sq?.renewalDate
          ? 'unknown'
          : sfRenewalCandidates.some((d) => datesAlign(sq.renewalDate, d))
            ? 'aligned'
            : 'mismatch'
      } else {
        status = !sq?.renewalDate && !poFields?.renewalDate
          ? 'unknown'
          : !sq?.renewalDate || !poFields?.renewalDate
            ? 'unknown'
            : datesAlign(sq.renewalDate, poFields.renewalDate) ? 'aligned' : 'mismatch'
      }
    } else if (spec.field === 'Expiry date (term end)') {
      if (quoteVsSf) {
        const provisioned = sq?.renewalDate
          ? resolveProvisioningDates({
            renewalDate: sq.renewalDate,
            extractedExpiry: sq.expiryDate,
            term: sq.term,
          })
          : null
        const expiry = provisioned?.expiryDate ?? sq?.expiryDate ?? null
        const renewal = provisioned?.renewalDate ?? sq?.renewalDate ?? null
        status = !expiry || !renewal
          ? 'unknown'
          : normalizeDateForCompare(expiry)! > normalizeDateForCompare(renewal)!
            ? 'aligned'
            : 'mismatch'
      } else {
        status = !sq?.expiryDate && !poFields?.expiryDate
          ? 'unknown'
          : !sq?.expiryDate || !poFields?.expiryDate
            ? 'unknown'
            : datesAlign(sq.expiryDate, poFields.expiryDate) ? 'aligned' : 'mismatch'
      }
    } else if (spec.field === 'Term duration') {
      if (quoteVsSf) {
        status = sq?.term ? 'aligned' : 'unknown'
      } else if (!sq?.term && !poFields?.term) status = 'unknown'
      else if (!sq?.term || !poFields?.term) status = 'unknown'
      else status = termsAlign(sq.term, poFields.term) ? 'aligned' : 'mismatch'
    } else {
      status = compareAlignment(spec.mode, spec.sf, signedVal, poVal, poProvided)
    }

    const signedDisplay = spec.signedDisplay ?? (signedVal
      ? (spec.field.includes('date') || spec.field.includes('term end')
        ? formatAlignmentDate(signedVal)
        : formatFieldValue(signedVal))
      : signedFailed ? 'Not extracted (download failed)' : '—')

    const poDisplay = spec.poDisplay ?? (!poProvided
      ? 'N/A'
      : poVal
        ? (spec.field.includes('date') || spec.field.includes('term end')
          ? formatAlignmentDate(poVal)
          : formatFieldValue(poVal))
        : poFailed ? 'Not extracted (download failed)' : '—')

    return {
      field: spec.field,
      salesforce: spec.sfDisplay ?? formatFieldValue(spec.sf),
      signedQuote: signedDisplay,
      purchaseOrder: poDisplay,
      status,
    }
  })
}

function sfTermLabel(sf: SfAlignmentInput): string | null {
  if (sf.currentTerm == null) return null
  const months = String(sf.currentTerm).match(/(\d+)/)?.[1]
  return months ? `${months} months` : null
}

function signedFieldsFromSf(sf: SfAlignmentInput) {
  return {
    customerName: sf.accountName,
    endUserName: sf.accountName,
    product: sf.product,
    supportPlan: sf.supportPlan,
    quantity: sf.userCount != null ? String(sf.userCount) : null,
    renewalDate: sf.renewalDate ? formatUsDate(sf.renewalDate) : null,
    expiryDate: sf.expiryDate ? formatUsDate(sf.expiryDate) : null,
  }
}

function compareTermPair(
  label: string,
  leftVal: string | null,
  rightVal: string | null,
  leftLabel: string,
  rightLabel: string,
): QuoteComparisonCheck {
  if (!leftVal && !rightVal) {
    return {
      check: label,
      severity: 'pending',
      finding: `Could not extract ${label.toLowerCase()} from either document — verify manually.`,
    }
  }
  if (!leftVal || !rightVal) {
    return {
      check: label,
      severity: 'pending',
      finding: `${label} found on ${leftVal ? leftLabel : rightLabel} only (${leftVal ?? rightVal}) — open both documents to confirm.`,
    }
  }
  if (termsAlign(leftVal, rightVal)) {
    const lm = termDurationMonths(leftVal)
    const rm = termDurationMonths(rightVal)
    const durationNote = lm != null ? ` (${lm} months)` : ''
    return {
      check: label,
      severity: 'pass',
      finding: `Match${durationNote} — ${leftVal} (${leftLabel}) = ${rightVal} (${rightLabel}).`,
    }
  }
  return {
    check: label,
    severity: 'warn',
    finding: `Mismatch — ${leftLabel}: ${leftVal}; ${rightLabel}: ${rightVal}. Flag for review.`,
  }
}

function comparePaymentTermsPair(
  leftVal: string | null,
  rightVal: string | null,
  leftLabel: string,
  rightLabel: string,
): QuoteComparisonCheck {
  if (!leftVal && !rightVal) {
    return { check: 'Payment terms', severity: 'pending', finding: 'Could not extract payment terms from either document — verify manually.' }
  }
  if (!leftVal || !rightVal) {
    return {
      check: 'Payment terms',
      severity: 'pending',
      finding: `Payment terms on ${leftVal ? leftLabel : rightLabel} only (${leftVal ?? rightVal}) — open both documents to confirm.`,
    }
  }
  if (paymentTermsAlign(leftVal, rightVal)) {
    return {
      check: 'Payment terms',
      severity: 'pass',
      finding: `Match — ${leftVal} (${leftLabel}) = ${rightVal} (${rightLabel}).`,
    }
  }
  return {
    check: 'Payment terms',
    severity: 'warn',
    finding: `Mismatch — ${leftLabel}: ${leftVal}; ${rightLabel}: ${rightVal}. Flag for review.`,
  }
}

function compareFieldPair(
  label: string,
  leftVal: string | null,
  rightVal: string | null,
  leftLabel: string,
  rightLabel: string,
): QuoteComparisonCheck {
  if (!leftVal && !rightVal) {
    return {
      check: label,
      severity: 'pending',
      finding: `Could not extract ${label.toLowerCase()} from either document — verify manually.`,
    }
  }
  if (!leftVal || !rightVal) {
    return {
      check: label,
      severity: 'pending',
      finding: `${label} found on ${leftVal ? leftLabel : rightLabel} only (${leftVal ?? rightVal}) — open both documents to confirm.`,
    }
  }
  if (valuesAlign(leftVal, rightVal)) {
    return {
      check: label,
      severity: 'pass',
      finding: `Match — ${leftVal} (${leftLabel}) = ${rightVal} (${rightLabel}).`,
    }
  }
  return {
    check: label,
    severity: 'warn',
    finding: `Mismatch — ${leftLabel}: ${leftVal}; ${rightLabel}: ${rightVal}. Flag for review.`,
  }
}

function compareQuotePair(
  label: string,
  unsignedVal: string | null,
  signedVal: string | null,
): QuoteComparisonCheck {
  return compareFieldPair(label, unsignedVal, signedVal, 'unsigned', 'signed')
}

function detectTcConflict(
  signed: ParsedDocument | null,
  po: ParsedDocument | null,
  poProvided: boolean,
  errors: { doc: string; message: string }[],
): { level: DocumentAnalysisBundle['poAudit']['tcConflict']; note: string; details: string[] } {
  if (!poProvided) {
    return { level: 'not_applicable', note: 'No PO document provided.', details: [] }
  }
  if (!po) {
    const poError = errors.find((e) => e.doc === 'po')?.message
    return {
      level: 'unknown',
      note: poError ?? 'PO could not be downloaded — open the PO PDF to check for conflicting purchaser terms.',
      details: [],
    }
  }
  if (po.fields.notes.some((n) => n.includes('only a PO number'))) {
    return {
      level: 'unknown',
      note: 'PO text is too minimal to assess T&C conflict — request a full PO or confirm terms separately.',
      details: [],
    }
  }

  const details = po.tcSnippets.map((s) => {
    const ref = s.clauseRef ? `${s.clauseRef} · ` : ''
    return `PO page ${s.page}: ${ref}"${s.excerpt}"`
  })

  if (details.length === 0 && !po.hasBuyerTermsLanguage && !po.hasTermsSection) {
    return {
      level: 'none_detected',
      note: 'No purchaser-specific T&C language detected in PO extracted text.',
      details: [],
    }
  }

  if (details.length > 0 || po.hasBuyerTermsLanguage) {
    const headline = details.length > 0
      ? `Possible PO T&C conflict — review ${details.length} excerpt${details.length === 1 ? '' : 's'} below (compare to signed quote T&Cs).`
      : 'PO may include purchaser T&Cs that could conflict with the signed quote — legal review recommended.'
    return { level: 'possible_conflict', note: headline, details }
  }

  return { level: 'unknown', note: 'T&C sections present but automated conflict check is inconclusive — compare PO and signed quote T&Cs manually.', details }
}

function normalizeQuoteRef(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
}

function looksLikeSfQuoteNumber(value: string | null | undefined): boolean {
  if (!value?.trim()) return false
  return /^Q[-_]?\d{4,8}$/i.test(value.trim())
}

/** Prefer primary quote # from Salesforce over stray numeric hits in PDF text. */
export function resolveQuoteNumber(
  extracted: string | null | undefined,
  sfPrimaryQuoteNumber: string | null | undefined,
): string | null {
  const sf = sfPrimaryQuoteNumber?.trim() || null
  const ext = extracted?.trim() || null

  if (sf && looksLikeSfQuoteNumber(sf)) {
    if (!ext) return sf
    if (normalizeQuoteRef(ext) === normalizeQuoteRef(sf)) return ext.startsWith('Q') ? ext : sf
    if (/^\d+$/.test(ext)) return sf
    if (!looksLikeSfQuoteNumber(ext)) return sf
  }

  if (ext && looksLikeSfQuoteNumber(ext)) return ext
  return ext ?? sf
}

function poReferencesQuoteNumber(
  po: ParsedDocument | null,
  quoteNumber: string | null,
): { found: boolean | null; detail: string } {
  if (!po || !quoteNumber?.trim()) {
    return {
      found: null,
      detail: quoteNumber
        ? 'Could not verify PO quote reference — PO text not extracted.'
        : 'Could not verify PO quote reference — quote number not extracted from unsigned quote.',
    }
  }
  const needle = normalizeQuoteRef(quoteNumber)
  const hay = normalizeQuoteRef(po.pageTexts.join('\n'))
  if (!needle || hay.length < 10) {
    return { found: null, detail: 'Could not verify PO quote reference — insufficient text.' }
  }
  if (hay.includes(needle)) {
    return { found: true, detail: `PO text references quote ${quoteNumber}.` }
  }
  const alt = quoteNumber.replace(/^Q-/i, '')
  if (alt !== quoteNumber && hay.includes(normalizeQuoteRef(alt))) {
    return { found: true, detail: `PO text references quote number ${alt} (matches ${quoteNumber}).` }
  }
  return {
    found: false,
    detail: `PO does not appear to reference quote ${quoteNumber} — confirm the PO cites the correct quote before renewing on PO only.`,
  }
}

function signedSignatureCheck(signed: ParsedDocument | null): QuoteComparisonCheck {
  if (!signed) {
    return { check: 'Signature', severity: 'pending', finding: 'Could not read signed quote — verify signature manually.' }
  }
  const { signerName, signedDate } = signed.fields
  const customerBlockNote = signed.fields.notes.some((n) => n.includes('For Customer'))
  if (signerName && signedDate) {
    return {
      check: 'Signature',
      severity: 'pass',
      finding: `Customer signature detected — ${signerName}, dated ${signedDate}.`,
    }
  }
  if (signerName?.includes('Customer signature block') || customerBlockNote) {
    return {
      check: 'Signature',
      severity: 'pending',
      finding: `Customer signature block found (For Customer)${signerName && !signerName.includes('block present') ? ` — ${signerName}` : ''}${signedDate ? `, dated ${signedDate}` : ''}. Confirm signatory name and date on the PDF.`,
    }
  }
  if (signerName || signedDate) {
    return {
      check: 'Signature',
      severity: 'pending',
      finding: `Partial signature info — ${[signerName, signedDate].filter(Boolean).join(', ')}. Confirm signatory and date on the PDF.`,
    }
  }
  return {
    check: 'Signature',
    severity: 'warn',
    finding: 'No signature block detected in extracted text — look for the For Customer signature block (name and date).',
  }
}

function buildUnsignedSignedChecks(
  sf: SfAlignmentInput,
  unsigned: ParsedDocument | null,
  signed: ParsedDocument | null,
  errors: { doc: string; message: string }[],
): QuoteComparisonCheck[] {
  const u = unsigned?.fields ?? null
  const s = signed?.fields ?? null
  const quoteChecks: QuoteComparisonCheck[] = []

  const unsignedErr = errors.find((e) => e.doc === 'unsigned')
  const signedErr = errors.find((e) => e.doc === 'signed')
  if (unsignedErr) {
    quoteChecks.push({ check: 'Unsigned quote PDF', severity: 'fail', finding: unsignedErr.message })
  }
  if (signedErr) {
    quoteChecks.push({ check: 'Signed quote PDF', severity: 'fail', finding: signedErr.message })
  }

  const unsignedPages = unsigned?.pageCount ?? null
  const signedPages = signed?.pageCount ?? null

  if (unsignedPages != null && signedPages != null) {
    const pageRatio = signedPages / Math.max(unsignedPages, 1)
    if (unsignedPages === signedPages) {
      quoteChecks.push({
        check: 'Page count',
        severity: 'pass',
        finding: `Both PDFs are ${unsignedPages} page${unsignedPages === 1 ? '' : 's'}.`,
      })
    } else if (pageRatio >= 1.5) {
      quoteChecks.push({
        check: 'Page count',
        severity: 'pending',
        finding: `Signed quote has ${signedPages} pages vs ${unsignedPages} on unsigned — likely a combined document (e.g. quote + SOW). Compare the section that matches quote ${u?.quoteNumber ?? 'number'} on the unsigned PDF; attaching separate docs is optional if the relevant section aligns.`,
      })
    } else {
      quoteChecks.push({
        check: 'Page count',
        severity: 'warn',
        finding: `Page count differs — unsigned: ${unsignedPages} page${unsignedPages === 1 ? '' : 's'}, signed: ${signedPages} page${signedPages === 1 ? '' : 's'}. Extra pages may indicate altered clauses.`,
      })
    }
  } else {
    quoteChecks.push({
      check: 'Page count',
      severity: 'pending',
      finding: `Unsigned: ${unsignedPages ?? 'unknown'} pages · Signed: ${signedPages ?? 'unknown'} pages — could not read one or both PDFs.`,
    })
  }

  quoteChecks.push(
    compareQuotePair(
      'Quote number',
      resolveQuoteNumber(u?.quoteNumber ?? null, sf.primaryQuoteNumber),
      resolveQuoteNumber(s?.quoteNumber ?? null, sf.primaryQuoteNumber),
    ),
    compareQuotePair('Pricing / total', u?.totalAmount ?? null, s?.totalAmount ?? null),
    compareTermPair('Term length', u?.term ?? sfTermLabel(sf), s?.term ?? sfTermLabel(sf), 'unsigned', 'signed'),
    compareQuotePair('Product', sf.product ?? u?.product ?? null, s?.product ?? null),
    compareQuotePair('Quantity / users', u?.quantity ?? null, s?.quantity ?? null),
  )
  quoteChecks.push(signedSignatureCheck(signed))

  const clauseCheck: QuoteComparisonCheck = (() => {
    if (!unsigned || !signed) {
      return {
        check: 'Clauses / alterations',
        severity: 'pending',
        finding: 'Could not read both PDFs — manually confirm no clauses were altered on the signed copy.',
      }
    }
    if (unsigned.unreadable || signed.unreadable) {
      return {
        check: 'Clauses / alterations',
        severity: 'pending',
        finding: 'Text extraction was limited — visually compare both PDFs for handwritten edits or clause changes.',
      }
    }
    const lenRatio = signed.textLength / Math.max(unsigned.textLength, 1)
    const pageRatio = (signed.pageCount ?? 1) / Math.max(unsigned.pageCount ?? 1, 1)
    if (pageRatio >= 1.5) {
      return {
        check: 'Clauses / alterations',
        severity: 'pending',
        finding: 'Signed document appears combined with additional content — review the unsigned-quote section only for clause changes.',
      }
    }
    if (lenRatio > 1.15 || lenRatio < 0.85) {
      return {
        check: 'Clauses / alterations',
        severity: 'warn',
        finding: `Signed quote text length differs significantly from unsigned (${Math.round(lenRatio * 100)}%) — review for added or removed clauses.`,
      }
    }
    return {
      check: 'Clauses / alterations',
      severity: 'pass',
      finding: 'No significant text-length difference detected between unsigned and signed PDFs.',
    }
  })()
  quoteChecks.push(clauseCheck)

  return quoteChecks
}

export function buildDocumentAnalysis(
  sf: SfAlignmentInput,
  unsigned: ParsedDocument | null,
  signed: ParsedDocument | null,
  po: ParsedDocument | null,
  errors: { doc: string; message: string }[],
  poProvided: boolean,
  mode: QuoteReviewMode = 'quote-signed-manual',
): DocumentAnalysisBundle {
  const fieldHints = {
    accountName: sf.accountName,
    product: sf.product,
    supportPlan: sf.supportPlan,
    renewalDate: sf.renewalDate,
    expiryDate: sf.expiryDate,
  }

  const signedForAnalysis = signed
    ? enrichQuoteDocument({
      ...signed,
      fields: sanitizeQuoteFields(
        signed.fields,
        unsigned?.fields ?? null,
        fieldHints,
        { documentOnlyTermFields: !usesUnsignedQuoteBaseline(mode) },
      ),
    })
    : null

  const unsignedForAnalysis = enrichQuoteDocument(unsigned)
  const u = unsignedForAnalysis?.fields ?? null
  const s = signedForAnalysis?.fields ?? null
  const p = po?.fields ?? null

  const quoteBaselineFields = usesUnsignedQuoteBaseline(mode) ? u : s
  const quoteBaselineLabel = usesUnsignedQuoteBaseline(mode) ? 'unsigned quote' : 'signed quote'
  const alignmentQuoteDoc = usesUnsignedQuoteBaseline(mode) ? unsignedForAnalysis : signedForAnalysis
  const tcQuoteDoc = usesUnsignedQuoteBaseline(mode) ? unsignedForAnalysis : signedForAnalysis

  const unsignedPages = unsigned?.pageCount ?? null
  const signedPages = signed?.pageCount ?? null

  let quoteChecks: QuoteComparisonCheck[] = []
  let quoteSummary: string
  let quoteOverall: AnalysisSeverity

  if (mode === 'quote-signed-adobe') {
    const signedErr = errors.find((e) => e.doc === 'signed')
    if (signedErr) {
      quoteChecks.push({ check: 'Signed quote PDF', severity: 'fail', finding: signedErr.message })
    }
    if (s?.quoteNumber || sf.primaryQuoteNumber) {
      const resolvedQuote = resolveQuoteNumber(s?.quoteNumber ?? null, sf.primaryQuoteNumber)
      if (resolvedQuote) {
        quoteChecks.push({
          check: 'Quote number',
          severity: 'pass',
          finding: sf.primaryQuoteNumber
            ? `Quote ${resolvedQuote} — primary quote ${sf.primaryQuoteNumber} from Salesforce.`
            : `Quote ${resolvedQuote} extracted from Adobe-signed document.`,
        })
      }
    }
    quoteChecks.push(signedSignatureCheck(signedForAnalysis))
    const quoteMismatch = quoteChecks.some((c) => c.severity === 'warn' || c.severity === 'fail')
    const quotePending = quoteChecks.some((c) => c.severity === 'pending')
    quoteOverall = quoteMismatch ? 'warn' : quotePending ? 'pending' : 'pass'
    quoteSummary =
      'Primary quote is Adobe-signed — unsigned comparison skipped. Review signed quote vs PO below.'
  } else if (usesUnsignedQuoteBaseline(mode)) {
    const unsignedErr = errors.find((e) => e.doc === 'unsigned')
    if (unsignedErr) {
      quoteChecks.push({
        check: mode === 'auto-renew' ? 'AR quote PDF' : 'Unsigned quote PDF',
        severity: 'fail',
        finding: unsignedErr.message,
      })
    } else if (unsigned) {
      quoteChecks.push({
        check: mode === 'auto-renew' ? 'AR quote PDF' : 'Unsigned quote PDF',
        severity: 'pass',
        finding: `${mode === 'auto-renew' ? 'AR quote' : 'Unsigned quote'} loaded${u?.quoteNumber || sf.primaryQuoteNumber ? ` — Quote ${resolveQuoteNumber(u?.quoteNumber ?? null, sf.primaryQuoteNumber) ?? sf.primaryQuoteNumber}` : ''}${unsignedPages != null ? ` (${unsignedPages} page${unsignedPages === 1 ? '' : 's'})` : ''}.`,
      })
    }
    const quoteMismatch = quoteChecks.some((c) => c.severity === 'warn' || c.severity === 'fail')
    const quotePending = quoteChecks.some((c) => c.severity === 'pending')
    quoteOverall = quoteMismatch ? 'warn' : quotePending ? 'pending' : 'pass'
    quoteSummary =
      mode === 'auto-renew'
        ? 'Auto-Renew — no signed quote or PO. Confirm AR quote PDF matches Salesforce, then copy the provisioning template.'
        : 'PO Received — customer did not sign the quote. Compare unsigned quote to PO in the Purchase order section.'
  } else {
    quoteChecks = buildUnsignedSignedChecks(sf, unsigned, signedForAnalysis, errors)
    const quoteMismatch = quoteChecks.some((c) => c.severity === 'warn' || c.severity === 'fail')
    const quotePending = quoteChecks.some((c) => c.severity === 'pending')
    quoteOverall = quoteMismatch ? 'warn' : quotePending ? 'pending' : 'pass'
    quoteSummary = quoteMismatch
      ? 'One or more fields differ between unsigned and signed quotes — review flagged items before accepting.'
      : quotePending
        ? 'Some comparisons could not be automated — complete manual PDF review.'
        : 'Unsigned and signed quotes appear aligned on extracted fields and page count.'
  }

  const poChecks: QuoteComparisonCheck[] = []
  let poSummary = 'No purchase order provided.'
  let poOverall: AnalysisSeverity = 'pending'

  const quoteNumber = resolveQuoteNumber(
    usesUnsignedQuoteBaseline(mode)
      ? (u?.quoteNumber ?? null)
      : (s?.quoteNumber ?? u?.quoteNumber ?? null),
    sf.primaryQuoteNumber,
  )
  const poNumber = p?.poNumber ?? null
  const quoteRef = mode === 'po-received'
    ? poReferencesQuoteNumber(po, quoteNumber)
    : { found: null as boolean | null, detail: '' }

  if (poProvided) {
    if (!po) {
      poChecks.push({
        check: 'PO document',
        severity: 'fail',
        finding: errors.find((e) => e.doc === 'po')?.message
          ?? 'Could not download or parse PO PDF — open the link manually.',
      })
      poSummary = 'PO link provided but document could not be analyzed.'
      poOverall = 'fail'
    } else if (po.fields.notes.some((n) => n.includes('only a PO number'))) {
      poChecks.push({
        check: 'PO content',
        severity: 'warn',
        finding: `Attached PO appears to show only PO number${p?.poNumber ? ` (${p.poNumber})` : ''} — no pricing, product scope, or terms visible. Request a full PO or confirm details separately.`,
      })
      poChecks.push({
        check: `Price vs ${quoteBaselineLabel}`,
        severity: 'pending',
        finding: 'Cannot compare pricing — PO has no extractable amount.',
      })
      poChecks.push({
        check: `Product scope vs ${quoteBaselineLabel}`,
        severity: 'pending',
        finding: 'Cannot compare product scope — PO has no extractable line items.',
      })
      poSummary = `PO #${p?.poNumber ?? 'unknown'} only — insufficient detail for automated alignment.`
      poOverall = 'warn'
    } else {
      const poPageNote = po.pageCount
        ? `${po.pageCount} page${po.pageCount === 1 ? '' : 's'}`
        : 'unknown pages'
      const detailParts = [
        p?.poNumber ? `PO #${p.poNumber}` : null,
        p?.totalAmount ? `Total ${p.totalAmount}` : null,
        p?.product ? `Product: ${p.product}` : 'Product: not listed on PO',
        p?.quantity ? `Qty: ${p.quantity}` : null,
        p?.paymentTerms ? `Payment: ${p.paymentTerms}` : null,
        p?.term ? `Term: ${p.term}` : null,
      ].filter(Boolean)
      poChecks.push({
        check: 'PO document',
        severity: 'pass',
        finding: `Extracted from PO (${poPageNote}): ${detailParts.join(' · ') || 'limited detail — open PDF to verify.'}`,
      })

      poChecks.push(
        compareFieldPair('Price / total', quoteBaselineFields?.totalAmount ?? null, p?.totalAmount ?? null, quoteBaselineLabel, 'PO'),
        compareFieldPair('Product scope', quoteBaselineFields?.product ?? sf.product ?? null, p?.product ?? null, quoteBaselineLabel, 'PO'),
        comparePaymentTermsPair(quoteBaselineFields?.paymentTerms ?? null, p?.paymentTerms ?? null, quoteBaselineLabel, 'PO'),
        compareTermPair('Term duration', quoteBaselineFields?.term ?? null, p?.term ?? null, quoteBaselineLabel, 'PO'),
        compareFieldPair('Quantity', quoteBaselineFields?.quantity ?? null, p?.quantity ?? null, quoteBaselineLabel, 'PO'),
      )

      if (mode === 'po-received') {
        poChecks.push({
          check: 'PO references quote #',
          severity: quoteRef.found === true ? 'pass' : quoteRef.found === false ? 'warn' : 'pending',
          finding: quoteRef.detail,
        })
      }

      const poMismatch = poChecks.some((c) => c.severity === 'warn')
      const poPending = poChecks.some((c) => c.severity === 'pending')
      poOverall = poMismatch ? 'warn' : poPending ? 'pending' : 'pass'
      poSummary = poMismatch
        ? `PO details differ from ${quoteBaselineLabel} on one or more fields — review before provisioning.`
        : poPending
          ? 'PO partially extracted — confirm price, scope, and terms on the PDF.'
          : `PO appears aligned with ${quoteBaselineLabel} on extracted fields.`
    }
  }

  const tc = detectTcConflict(tcQuoteDoc, po, poProvided, errors)
  if (poProvided && po) {
    poChecks.push({
      check: 'T&C conflict check',
      severity: tc.level === 'possible_conflict' ? 'warn' : tc.level === 'none_detected' ? 'pass' : 'pending',
      finding: tc.details.length > 0 ? `${tc.note} ${tc.details.join(' | ')}` : tc.note,
    })
    if (tc.level === 'possible_conflict' && poOverall === 'pass') poOverall = 'warn'
  }

  const alignmentRows = buildAlignmentRows(sf, alignmentQuoteDoc, po, poProvided, errors, {
    quoteVsSalesforce: mode === 'auto-renew' || (usesUnsignedQuoteBaseline(mode) && !poProvided),
  })
  const dataStatuses = alignmentRows.map((r) => r.status)
  const alignmentOverall = severityFromStatuses(dataStatuses)
  const alignedCount = alignmentRows.filter((r) => r.status === 'aligned').length
  const mismatchCount = alignmentRows.filter((r) => r.status === 'mismatch').length
  const pdfFailed = errors.length > 0
  const qtyNotes = [
    ...(alignmentQuoteDoc?.fields.notes ?? []),
    ...(po?.fields.notes ?? []),
  ].filter((n) => /line item|footer mentions/i.test(n))

  const alignmentSourceLabel =
    mode === 'auto-renew'
      ? 'AR quote'
      : mode === 'po-received'
        ? 'unsigned quote and PO'
        : 'signed quote and PO'

  let alignmentSummary = pdfFailed
    ? 'PDF extraction failed for one or more documents — Salesforce values shown; open PDFs manually to complete alignment.'
    : mismatchCount > 0
      ? `${mismatchCount} field${mismatchCount === 1 ? '' : 's'} mismatch across Salesforce, ${alignmentSourceLabel} — review the alignment table.`
      : alignedCount >= 5
        ? `Core fields align across sources (${alignedCount} matched).`
        : 'Limited extraction — use the alignment table and open PDFs to confirm all fields.'

  if (qtyNotes.length > 0) {
    alignmentSummary += ` Note: ${qtyNotes.join(' ')}`
  }

  return {
    analysisMode: mode,
    documentIds: {
      quoteNumber,
      poNumber,
      poReferencesQuote: quoteRef.found,
      poReferencesQuoteDetail: quoteRef.detail,
    },
    unsigned: unsignedForAnalysis ?? unsigned,
    signed: signedForAnalysis,
    purchaseOrder: po,
    errors,
    quoteComparison: {
      unsignedPages,
      signedPages,
      checks: quoteChecks,
      summary: quoteSummary,
      overallSeverity: quoteOverall,
    },
    poAudit: {
      present: poProvided,
      pageCount: po?.pageCount ?? null,
      summary: poSummary,
      checks: poChecks,
      overallSeverity: poProvided ? poOverall : 'pending',
      tcConflict: tc.level,
      tcConflictNote: tc.note,
      tcConflictDetails: tc.details,
    },
    alignment: {
      rows: alignmentRows,
      overallAligned: mismatchCount === 0 && alignedCount > 0,
      summary: alignmentSummary,
      overallSeverity: alignmentOverall,
    },
  }
}

export function documentFlagsFromAnalysis(
  bundle: DocumentAnalysisBundle,
): AnalysisFlag[] {
  const flags: AnalysisFlag[] = []
  const mode = bundle.analysisMode

  if (mode === 'quote-signed-manual') {
    flags.push({
      id: 'pdf-diff',
      label: 'Signed vs unsigned comparison',
      detail: bundle.quoteComparison.summary,
      severity: bundle.quoteComparison.overallSeverity,
      category: 'manual',
    })
    for (const check of bundle.quoteComparison.checks) {
      flags.push({
        id: `pdf-${check.check.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        label: check.check,
        detail: check.finding,
        severity: check.severity,
        category: 'manual',
      })
    }
  } else if (mode === 'quote-signed-adobe') {
    for (const check of bundle.quoteComparison.checks) {
      flags.push({
        id: `pdf-${check.check.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        label: check.check,
        detail: check.finding,
        severity: check.severity,
        category: 'manual',
      })
    }
  } else if (usesUnsignedQuoteBaseline(mode)) {
    for (const check of bundle.quoteComparison.checks) {
      flags.push({
        id: `pdf-${check.check.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        label: check.check,
        detail: check.finding,
        severity: check.severity,
        category: 'manual',
      })
    }
  }

  if (bundle.poAudit.present) {
    const poAuditLabel =
      mode === 'po-received' ? 'PO vs unsigned quote audit' : 'PO vs signed quote audit'
    flags.push({
      id: 'po-audit',
      label: poAuditLabel,
      detail: bundle.poAudit.summary,
      severity: bundle.poAudit.overallSeverity,
      category: 'manual',
    })
    for (const check of bundle.poAudit.checks) {
      flags.push({
        id: `po-${check.check.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        label: check.check,
        detail: check.finding,
        severity: check.severity,
        category: 'manual',
      })
    }
  }

  return flags
}
