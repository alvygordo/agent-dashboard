import { formatUsDate } from '@/lib/sf-field-format'
import type { DocumentAnalysisBundle } from '@/lib/quote-alignment'
import { documentFlagsFromAnalysis } from '@/lib/quote-alignment'
import type { QuoteReviewMode } from '@/lib/quote-review-mode'
import { resolveQuoteReviewMode, VALID_SQ_REVIEW_WIN_TYPES, isOutForSignatureStatus } from '@/lib/quote-review-mode'

export type AnalysisSeverity = 'pass' | 'warn' | 'fail' | 'pending'

export type AnalysisCategory = 'gate' | 'documents' | 'manual' | 'salesforce'

export type AnalysisFlag = {
  id: string
  label: string
  detail: string
  severity: AnalysisSeverity
  category: AnalysisCategory
}

export type AnalysisSummary = 'accept' | 'review' | 'hold'

export type QuoteReviewInput = {
  winType: string | null
  winTypeValid: boolean
  primaryQuoteStatus: string | null
  supportPlan: string | null
  userCount: number | null
  renewalDate: string | null
  expiryDate: string | null
  primaryContactEmail: string | null
  unsignedQuoteUrl: string
  signedQuoteUrl: string
  purchaseOrderUrl: string
  purchaseOrderRequirement?: string | null
  reviewMode?: QuoteReviewMode
  comparePo?: boolean
}

export type QuoteReviewAnalysis = {
  flags: AnalysisFlag[]
  recommendation: string
  summary: AnalysisSummary
  documentAnalysis?: DocumentAnalysisBundle | null
}

const VALID_WIN_TYPES = VALID_SQ_REVIEW_WIN_TYPES

function severityRank(s: AnalysisSeverity): number {
  if (s === 'fail') return 3
  if (s === 'warn') return 2
  if (s === 'pending') return 1
  return 0
}

function worstSeverity(flags: AnalysisFlag[]): AnalysisSeverity {
  return flags.reduce<AnalysisSeverity>(
    (worst, f) => (severityRank(f.severity) > severityRank(worst) ? f.severity : worst),
    'pass',
  )
}

export function buildQuoteReviewAnalysis(
  input: QuoteReviewInput,
  documentAnalysis?: DocumentAnalysisBundle | null,
): QuoteReviewAnalysis {
  const flags: AnalysisFlag[] = []

  const reviewPlan = resolveQuoteReviewMode({
    winType: input.winType,
    primaryQuoteStatus: input.primaryQuoteStatus,
    signedQuoteUrl: input.signedQuoteUrl,
    purchaseOrderLink: input.purchaseOrderUrl,
    purchaseOrderRequirement: input.purchaseOrderRequirement,
  })
  const mode = input.reviewMode ?? reviewPlan.mode
  const comparePo = input.comparePo ?? reviewPlan.comparePo

  if (!input.winType?.trim()) {
    flags.push({
      id: 'win-type-missing',
      label: 'Win Type not set',
      detail: 'Opportunity Win Type is blank. Expected Quote Signed, PO Received, or Auto-Renew before provisioning.',
      severity: 'warn',
      category: 'gate',
    })
  } else if (!VALID_WIN_TYPES.has(input.winType)) {
    flags.push({
      id: 'win-type-invalid',
      label: 'Win Type gate',
      detail: `Win Type is "${input.winType}". This workflow is for Quote Signed, PO Received, or Auto-Renew only.`,
      severity: 'fail',
      category: 'gate',
    })
  } else {
    flags.push({
      id: 'win-type-ok',
      label: 'Win Type',
      detail: `${input.winType} — ${reviewPlan.title}.`,
      severity: 'pass',
      category: 'gate',
    })
    if (mode === 'auto-renew') {
      if (input.primaryQuoteStatus) {
        const ok = isOutForSignatureStatus(input.primaryQuoteStatus)
        flags.push({
          id: 'ar-quote-status',
          label: 'AR quote status',
          detail: ok
            ? `${input.primaryQuoteStatus} — expected for Auto-Renew.`
            : `Primary quote status is "${input.primaryQuoteStatus}" — expected Out for Signature for Auto-Renew AR quote.`,
          severity: ok ? 'pass' : 'fail',
          category: 'gate',
        })
      } else {
        flags.push({
          id: 'ar-quote-status-missing',
          label: 'AR quote status',
          detail: 'Primary quote status not found — confirm the AR quote is Out for Signature.',
          severity: 'warn',
          category: 'gate',
        })
      }
    } else if (input.primaryQuoteStatus) {
      flags.push({
        id: 'primary-quote-status',
        label: 'Primary quote status',
        detail: input.primaryQuoteStatus,
        severity: input.primaryQuoteStatus.toLowerCase() === 'signed' ? 'pass' : 'pending',
        category: 'gate',
      })
    }
    if (reviewPlan.poRequirementRaw) {
      flags.push({
        id: 'po-requirement',
        label: 'Purchase Order field',
        detail: reviewPlan.poRequirementRaw,
        severity:
          reviewPlan.poRequirement === 'not-required'
            ? 'pass'
            : reviewPlan.poRequirement === 'required-pending'
              ? 'warn'
              : reviewPlan.poRequirement === 'required-attached'
                ? 'pass'
                : 'pending',
        category: 'gate',
      })
    }
  }

  const needsUnsigned = mode === 'quote-signed-manual' || mode === 'po-received' || mode === 'auto-renew'
  const needsSigned = mode === 'quote-signed-adobe' || mode === 'quote-signed-manual'
  const needsPo = mode === 'po-received' || reviewPlan.requiresPo

  const unsignedDocLabel = mode === 'auto-renew' ? 'AR quote' : 'Unsigned quote'

  if (needsUnsigned) {
    if (input.unsignedQuoteUrl.trim()) {
      flags.push({
        id: 'unsigned-doc',
        label: unsignedDocLabel,
        detail: mode === 'auto-renew'
          ? 'AR quote PDF link provided from primary quote attachments.'
          : 'Baseline document link provided.',
        severity: 'pass',
        category: 'documents',
      })
    } else {
      flags.push({
        id: 'unsigned-missing',
        label: `${unsignedDocLabel} missing`,
        detail: mode === 'auto-renew'
          ? 'Add the AR quote PDF link from the primary quote Notes & Attachments.'
          : 'Add the unsigned baseline quote link from the primary quote attachments.',
        severity: 'fail',
        category: 'documents',
      })
    }
  }

  if (needsSigned) {
    if (input.signedQuoteUrl.trim()) {
      flags.push({
        id: 'signed-doc',
        label: 'Signed quote',
        detail: 'Customer signed document link provided.',
        severity: 'pass',
        category: 'documents',
      })
    } else {
      flags.push({
        id: 'signed-missing',
        label: 'Signed quote missing',
        detail: 'Add the signed quote link from the Signed Quote field.',
        severity: 'fail',
        category: 'documents',
      })
    }
  }

  if (comparePo) {
    if (input.purchaseOrderUrl.trim()) {
      flags.push({
        id: 'po-provided',
        label: 'Purchase order',
        detail: documentAnalysis?.poAudit.summary
          ?? 'PO document link provided — analysis pending.',
        severity: documentAnalysis?.poAudit.overallSeverity ?? 'pending',
        category: 'documents',
      })
    } else if (needsPo) {
      flags.push({
        id: 'po-missing',
        label: 'Purchase order missing',
        detail: 'Purchase Order is Required - Attached but no PO link was found on the opportunity.',
        severity: 'fail',
        category: 'documents',
      })
    }
  } else if (reviewPlan.poRequirement === 'required-pending') {
    flags.push({
      id: 'po-pending',
      label: 'PO required — pending',
      detail: 'PO is required but not yet attached. Proceed with signed quote review only.',
      severity: 'warn',
      category: 'documents',
    })
  } else if (reviewPlan.poRequirement === 'not-required') {
    flags.push({
      id: 'po-not-required',
      label: 'PO not required',
      detail: 'Purchase Order field is Not Required — no PO comparison needed.',
      severity: 'pass',
      category: 'documents',
    })
  } else if (mode === 'po-received') {
    flags.push({
      id: 'po-missing',
      label: 'Purchase order missing',
      detail: 'PO Received requires a purchase order link on the opportunity.',
      severity: 'fail',
      category: 'documents',
    })
  }

  if (documentAnalysis) {
    const docFlags = documentFlagsFromAnalysis(documentAnalysis)
    flags.push(...docFlags)
  } else {
    const pendingDetail =
      mode === 'quote-signed-adobe'
        ? 'Analyzing signed quote and PO…'
        : mode === 'po-received'
          ? 'Analyzing unsigned quote and PO…'
          : mode === 'auto-renew'
            ? 'Analyzing AR quote PDF…'
            : 'Analyzing PDFs…'
    flags.push({
      id: 'pdf-diff',
      label: 'Document comparison',
      detail: pendingDetail,
      severity: 'pending',
      category: 'manual',
    })

    if (comparePo && input.purchaseOrderUrl.trim()) {
      flags.push({
        id: 'po-audit',
        label: mode === 'po-received' ? 'PO vs unsigned quote audit' : 'PO vs signed quote audit',
        detail: 'Analyzing PO…',
        severity: 'pending',
        category: 'manual',
      })
    }
  }

  if (input.supportPlan) {
    flags.push({
      id: 'support-plan',
      label: 'Support plan',
      detail: `${input.supportPlan} — from primary quote / opportunity.`,
      severity: 'pass',
      category: 'salesforce',
    })
  } else {
    flags.push({
      id: 'support-plan-missing',
      label: 'Support plan not found',
      detail: 'Verify Standard, Gold, or Platinum on the signed quote.',
      severity: 'warn',
      category: 'salesforce',
    })
  }

  if (input.userCount != null && input.userCount > 0) {
    flags.push({
      id: 'user-count',
      label: 'User / seat count',
      detail: `${input.userCount} — from primary quote / opportunity.`,
      severity: 'pass',
      category: 'salesforce',
    })
  } else {
    flags.push({
      id: 'user-count-missing',
      label: 'User count not found',
      detail: 'Verify seat count on the signed quote before provisioning.',
      severity: 'warn',
      category: 'salesforce',
    })
  }

  if (input.primaryContactEmail?.includes('.data')) {
    flags.push({
      id: 'contact-sandbox',
      label: 'Contact email (sandbox)',
      detail: 'Sandbox masks real emails — confirm on prod or enter manually.',
      severity: 'warn',
      category: 'salesforce',
    })
  }

  const renewal = input.renewalDate ? new Date(`${input.renewalDate}T12:00:00`) : null
  const expiry = input.expiryDate ? new Date(`${input.expiryDate}T12:00:00`) : null
  if (
    renewal && expiry
    && !Number.isNaN(renewal.getTime())
    && !Number.isNaN(expiry.getTime())
  ) {
    const dayGap = Math.round((renewal.getTime() - expiry.getTime()) / 86_400_000)
    if (dayGap === 1) {
      flags.push({
        id: 'date-order',
        label: 'Renewal vs expiry dates',
        detail: `Renewal (${formatUsDate(input.renewalDate)}) is the day after expiry (${formatUsDate(input.expiryDate)}) — expected pattern.`,
        severity: 'pass',
        category: 'salesforce',
      })
    } else {
      flags.push({
        id: 'date-order',
        label: 'Renewal vs expiry dates',
        detail: `Renewal (${formatUsDate(input.renewalDate)}) and expiry (${formatUsDate(input.expiryDate)}) are ${dayGap} days apart — expected renewal = expiry + 1 day.`,
        severity: 'warn',
        category: 'salesforce',
      })
    }
  }

  const worst = worstSeverity(flags)
  const hasFail = flags.some((f) => f.severity === 'fail')
  const hasWarn = flags.some((f) => f.severity === 'warn')
  const hasPending = flags.some((f) => f.severity === 'pending')

  let summary: AnalysisSummary = 'accept'
  let recommendation: string

  if (hasFail) {
    summary = 'hold'
    recommendation =
      'Do not accept the signed quote yet — resolve blocking flags below before provisioning.'
  } else if (hasWarn || hasPending) {
    summary = 'review'
    recommendation = hasPending
      ? mode === 'quote-signed-adobe'
        ? 'Complete manual review of the signed quote and PO before opening a provisioning ticket.'
        : mode === 'po-received'
          ? 'Complete manual review of the unsigned quote and PO before opening a provisioning ticket.'
          : mode === 'auto-renew'
            ? 'Complete manual review of the AR quote PDF before opening a provisioning ticket.'
            : 'Complete manual document review (unsigned vs signed, and PO if applicable) before opening a provisioning ticket.'
      : 'Review flagged items below, then proceed if documents match Salesforce and the quote.'
  } else {
    recommendation =
      mode === 'auto-renew'
        ? 'Preliminary checks passed. Confirm AR quote PDF matches Salesforce, then copy the provisioning template.'
        : mode === 'po-received'
        ? 'Preliminary checks passed. Confirm unsigned quote vs PO alignment, then copy the provisioning template.'
        : mode === 'quote-signed-adobe'
          ? 'Preliminary checks passed. Confirm signed quote vs PO alignment, then copy the provisioning template.'
          : 'Preliminary checks passed. Complete a quick visual compare of signed vs unsigned PDFs, then copy the provisioning template.'
  }

  return { flags, recommendation, summary, documentAnalysis: documentAnalysis ?? null }
}

export function severityLabel(severity: AnalysisSeverity): string {
  if (severity === 'pass') return 'Pass'
  if (severity === 'warn') return 'Warning'
  if (severity === 'fail') return 'Fail'
  return 'Manual'
}

export function analysisSummaryLabel(summary: AnalysisSummary): string {
  if (summary === 'accept') return 'Ready for manual doc review'
  if (summary === 'review') return 'Review required'
  return 'Hold — resolve flags first'
}
