import type { AnalysisFlag, AnalysisSeverity } from '@/lib/quote-review-analysis'
import {
  formatFieldValue,
  type ExtractedDocumentFields,
  type ParsedDocument,
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
  note: string | null
}

export type QuoteComparisonCheck = {
  check: string
  severity: AnalysisSeverity
  finding: string
}

export type DocumentAnalysisBundle = {
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
  }
  alignment: {
    rows: AlignmentRow[]
    overallAligned: boolean
    summary: string
    overallSeverity: AnalysisSeverity
  }
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
    note: row.salesforce !== '—'
      ? 'Salesforce value loaded — signed quote / PO columns fill in after PDF analysis.'
      : 'No Salesforce value for this field.',
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

function compareThree(
  sf: string | null,
  signed: string | null,
  po: string | null,
  poProvided: boolean,
): { status: AlignmentStatus; note: string | null } {
  const hasSf = Boolean(sf?.trim())
  const hasSigned = Boolean(signed?.trim())
  const hasPo = Boolean(po?.trim())

  if (!hasSigned && !hasPo && !hasSf) {
    return { status: 'unknown', note: 'No values found in any source.' }
  }

  const signedAlignsSf = hasSf && hasSigned ? valuesAlign(sf, signed) : null
  const poAlignsSigned = hasPo && hasSigned ? valuesAlign(po, signed) : null
  const poAlignsSf = hasSf && hasPo ? valuesAlign(sf, po) : null

  if (!poProvided) {
    if (signedAlignsSf === true) return { status: 'aligned', note: 'Signed quote matches Salesforce.' }
    if (signedAlignsSf === false) return { status: 'mismatch', note: 'Signed quote differs from Salesforce.' }
    if (hasSigned && !hasSf) return { status: 'partial', note: 'Found on signed quote only — verify in Salesforce.' }
    if (hasSf && !hasSigned) return { status: 'unknown', note: 'Could not extract from signed quote PDF.' }
    return { status: 'unknown', note: 'Insufficient data to compare.' }
  }

  if (signedAlignsSf === true && (poAlignsSigned === true || !hasPo)) {
    return { status: 'aligned', note: 'Salesforce, signed quote, and PO align.' }
  }
  if (signedAlignsSf === false || poAlignsSigned === false || poAlignsSf === false) {
    const parts: string[] = []
    if (signedAlignsSf === false) parts.push('Signed quote ≠ Salesforce')
    if (poAlignsSigned === false) parts.push('PO ≠ signed quote')
    if (poAlignsSf === false && hasPo) parts.push('PO ≠ Salesforce')
    return { status: 'mismatch', note: parts.join('; ') || 'Values differ across sources.' }
  }
  if (!hasPo) {
    return { status: 'unknown', note: 'PO link provided but field not found in PO document.' }
  }
  if (!hasSigned) {
    return { status: 'unknown', note: 'Could not extract from signed quote.' }
  }
  return { status: 'partial', note: 'Some sources missing — verify manually.' }
}

function buildAlignmentRows(
  sf: SfAlignmentInput,
  signed: ParsedDocument | null,
  po: ParsedDocument | null,
  poProvided: boolean,
): AlignmentRow[] {
  const sfFields = signedFieldsFromSf(sf)
  const sq = signed?.fields ?? null
  const poFields = po?.fields ?? null

  const specs: {
    field: string
    sf: string | null
    signed: string | null
    po: string | null
  }[] = [
    { field: 'Customer name', sf: sfFields.customerName, signed: sq?.customerName ?? null, po: poFields?.customerName ?? null },
    { field: 'End user name', sf: sfFields.endUserName, signed: sq?.endUserName ?? null, po: poFields?.endUserName ?? null },
    { field: 'Reseller name', sf: sfFields.resellerName, signed: sq?.resellerName ?? null, po: poFields?.resellerName ?? null },
    { field: 'Address', sf: sfFields.address, signed: sq?.address ?? null, po: poFields?.address ?? null },
    { field: 'Product', sf: sfFields.product, signed: sq?.product ?? null, po: poFields?.product ?? null },
    { field: 'Support plan', sf: sfFields.supportPlan, signed: sq?.supportPlan ?? null, po: poFields?.supportPlan ?? null },
    { field: 'Users / seats / qty', sf: sfFields.quantity, signed: sq?.quantity ?? null, po: poFields?.quantity ?? null },
    { field: 'Renewal date', sf: sfFields.renewalDate, signed: sq?.renewalDate ?? null, po: poFields?.renewalDate ?? null },
    { field: 'Expiry date', sf: sfFields.expiryDate, signed: sq?.expiryDate ?? null, po: poFields?.expiryDate ?? null },
    { field: 'Service provider / supplier', sf: sfFields.supplierName, signed: sq?.supplierName ?? null, po: poFields?.supplierName ?? null },
    { field: 'Payment terms', sf: sfFields.paymentTerms, signed: sq?.paymentTerms ?? null, po: poFields?.paymentTerms ?? null },
  ]

  return specs.map((spec) => {
    const { status, note } = compareThree(spec.sf, spec.signed, spec.po, poProvided)
    return {
      field: spec.field,
      salesforce: formatFieldValue(spec.sf),
      signedQuote: formatFieldValue(spec.signed),
      purchaseOrder: poProvided ? formatFieldValue(spec.po) : 'N/A',
      status,
      note,
    }
  })
}

function signedFieldsFromSf(sf: SfAlignmentInput) {
  const paymentTerms = sf.paymentTerms
    ?? (sf.currentTerm != null ? String(sf.currentTerm) : null)

  return {
    customerName: sf.accountName,
    endUserName: sf.accountName,
    resellerName: null as string | null,
    address: null as string | null,
    product: sf.product,
    supportPlan: sf.supportPlan,
    quantity: sf.userCount != null ? String(sf.userCount) : null,
    renewalDate: sf.renewalDate ? formatUsDate(sf.renewalDate) : null,
    expiryDate: sf.expiryDate ? formatUsDate(sf.expiryDate) : null,
    supplierName: 'Trilogy',
    paymentTerms,
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
): { level: DocumentAnalysisBundle['poAudit']['tcConflict']; note: string } {
  if (!po) {
    return { level: 'not_applicable', note: 'No PO document provided.' }
  }
  if (po.fields.notes.some((n) => n.includes('only a PO number'))) {
    return {
      level: 'unknown',
      note: 'PO text is too minimal to assess T&C conflict — request a full PO or confirm terms separately.',
    }
  }
  const buyerTerms = po.hasBuyerTermsLanguage
  if (!po.hasTermsSection && !buyerTerms) {
    return {
      level: 'none_detected',
      note: 'No purchaser-specific T&C language detected in PO extracted text. Standard quote T&Cs likely apply — spot-check the PO PDF.',
    }
  }
  if (buyerTerms || (po.hasTermsSection && signed?.hasTermsSection)) {
    return {
      level: 'possible_conflict',
      note: 'PO may include purchaser T&Cs that could conflict with the signed quote or Trilogy standard terms — legal review recommended.',
    }
  }
  return {
    level: 'unknown',
    note: 'T&C sections present but automated conflict check is inconclusive — compare PO and signed quote T&Cs manually.',
  }
}

export function buildDocumentAnalysis(
  sf: SfAlignmentInput,
  unsigned: ParsedDocument | null,
  signed: ParsedDocument | null,
  po: ParsedDocument | null,
  errors: { doc: string; message: string }[],
  poProvided: boolean,
): DocumentAnalysisBundle {
  const u = unsigned?.fields ?? null
  const s = signed?.fields ?? null
  const p = po?.fields ?? null

  const quoteChecks: QuoteComparisonCheck[] = []

  const unsignedPages = unsigned?.pageCount ?? null
  const signedPages = signed?.pageCount ?? null

  if (unsignedPages != null && signedPages != null) {
    if (unsignedPages === signedPages) {
      quoteChecks.push({
        check: 'Page count',
        severity: 'pass',
        finding: `Both PDFs are ${unsignedPages} page${unsignedPages === 1 ? '' : 's'}.`,
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
    compareQuotePair('Quote number', u?.quoteNumber ?? null, s?.quoteNumber ?? null),
    compareQuotePair('Pricing / total', u?.totalAmount ?? null, s?.totalAmount ?? null),
    compareQuotePair('Term length', u?.term ?? null, s?.term ?? null),
    compareQuotePair('Product', u?.product ?? null, s?.product ?? null),
    compareQuotePair('Quantity / users', u?.quantity ?? null, s?.quantity ?? null),
  )

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

  const quoteMismatch = quoteChecks.some((c) => c.severity === 'warn' || c.severity === 'fail')
  const quotePending = quoteChecks.some((c) => c.severity === 'pending')
  const quoteOverall: AnalysisSeverity = quoteMismatch ? 'warn' : quotePending ? 'pending' : 'pass'
  const quoteSummary = quoteMismatch
    ? 'One or more fields differ between unsigned and signed quotes — review flagged items before accepting.'
    : quotePending
      ? 'Some comparisons could not be automated — complete manual PDF review.'
      : 'Unsigned and signed quotes appear aligned on extracted fields and page count.'

  const poChecks: QuoteComparisonCheck[] = []
  let poSummary = 'No purchase order provided.'
  let poOverall: AnalysisSeverity = 'pending'

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
        check: 'Price vs signed quote',
        severity: 'pending',
        finding: 'Cannot compare pricing — PO has no extractable amount.',
      })
      poChecks.push({
        check: 'Product scope vs signed quote',
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
        p?.product ? `Product: ${p.product}` : null,
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
        compareFieldPair('Price / total', s?.totalAmount ?? null, p?.totalAmount ?? null, 'signed quote', 'PO'),
        compareFieldPair('Product scope', s?.product ?? null, p?.product ?? null, 'signed quote', 'PO'),
        compareFieldPair('Term', s?.term ?? null, p?.term ?? null, 'signed quote', 'PO'),
        compareFieldPair('Quantity', s?.quantity ?? null, p?.quantity ?? null, 'signed quote', 'PO'),
      )

      const poMismatch = poChecks.some((c) => c.severity === 'warn')
      const poPending = poChecks.some((c) => c.severity === 'pending')
      poOverall = poMismatch ? 'warn' : poPending ? 'pending' : 'pass'
      poSummary = poMismatch
        ? 'PO details differ from signed quote on one or more fields — review before provisioning.'
        : poPending
          ? 'PO partially extracted — confirm price, scope, and terms on the PDF.'
          : 'PO appears aligned with signed quote on extracted fields.'
    }
  }

  const tc = detectTcConflict(signed, po)
  if (poProvided && po) {
    poChecks.push({
      check: 'T&C conflict check',
      severity: tc.level === 'possible_conflict' ? 'warn' : tc.level === 'none_detected' ? 'pass' : 'pending',
      finding: tc.note,
    })
    if (tc.level === 'possible_conflict' && poOverall === 'pass') poOverall = 'warn'
  }

  const alignmentRows = buildAlignmentRows(sf, signed, po, poProvided)
  const dataStatuses = alignmentRows.map((r) => r.status)
  const alignmentOverall = severityFromStatuses(dataStatuses)
  const alignedCount = alignmentRows.filter((r) => r.status === 'aligned').length
  const mismatchCount = alignmentRows.filter((r) => r.status === 'mismatch').length
  const alignmentSummary = mismatchCount > 0
    ? `${mismatchCount} field${mismatchCount === 1 ? '' : 's'} mismatch across Salesforce, signed quote, and PO — review the alignment table.`
    : alignedCount >= 5
      ? `Core fields align across sources (${alignedCount} matched).`
      : 'Limited extraction — use the alignment table and open PDFs to confirm all fields.'

  return {
    unsigned,
    signed,
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

  if (bundle.poAudit.present) {
    flags.push({
      id: 'po-audit',
      label: 'PO vs signed quote audit',
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
