import { formatUsDate } from '@/lib/sf-field-format'
import type { DocumentAnalysisBundle } from '@/lib/quote-alignment'
import { documentFlagsFromAnalysis } from '@/lib/quote-alignment'

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
  supportPlan: string | null
  userCount: number | null
  renewalDate: string | null
  expiryDate: string | null
  primaryContactEmail: string | null
  unsignedQuoteUrl: string
  signedQuoteUrl: string
  purchaseOrderUrl: string
}

export type QuoteReviewAnalysis = {
  flags: AnalysisFlag[]
  recommendation: string
  summary: AnalysisSummary
  documentAnalysis?: DocumentAnalysisBundle | null
}

const VALID_WIN_TYPES = new Set(['Quote Signed', 'PO Received'])

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

  if (!input.winType?.trim()) {
    flags.push({
      id: 'win-type-missing',
      label: 'Win Type not set',
      detail: 'Opportunity Win Type is blank. Expected Quote Signed or PO Received before accepting the signed quote.',
      severity: 'warn',
      category: 'gate',
    })
  } else if (!VALID_WIN_TYPES.has(input.winType)) {
    flags.push({
      id: 'win-type-invalid',
      label: 'Win Type gate',
      detail: `Win Type is "${input.winType}". This workflow is for Quote Signed or PO Received only.`,
      severity: 'fail',
      category: 'gate',
    })
  } else {
    flags.push({
      id: 'win-type-ok',
      label: 'Win Type',
      detail: `${input.winType} — eligible for signed quote review.`,
      severity: 'pass',
      category: 'gate',
    })
  }

  if (input.unsignedQuoteUrl.trim()) {
    flags.push({
      id: 'unsigned-doc',
      label: 'Unsigned quote',
      detail: 'Baseline document link provided.',
      severity: 'pass',
      category: 'documents',
    })
  } else {
    flags.push({
      id: 'unsigned-missing',
      label: 'Unsigned quote missing',
      detail: 'Add the unsigned baseline quote link.',
      severity: 'fail',
      category: 'documents',
    })
  }

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
      detail: 'Add the signed quote link.',
      severity: 'fail',
      category: 'documents',
    })
  }

  if (input.purchaseOrderUrl.trim()) {
    flags.push({
      id: 'po-provided',
      label: 'Purchase order',
      detail: documentAnalysis?.poAudit.summary
        ?? 'PO document link provided — analysis pending.',
      severity: documentAnalysis?.poAudit.overallSeverity ?? 'pending',
      category: 'documents',
    })
  } else {
    flags.push({
      id: 'po-missing',
      label: 'No PO link',
      detail: 'Confirm whether a PO is contractually required. Request from customer if needed.',
      severity: 'warn',
      category: 'documents',
    })
  }

  if (documentAnalysis) {
    const docFlags = documentFlagsFromAnalysis(documentAnalysis)
    flags.push(...docFlags)
  } else {
    flags.push({
      id: 'pdf-diff',
      label: 'Signed vs unsigned comparison',
      detail: 'Analyzing PDFs…',
      severity: 'pending',
      category: 'manual',
    })

    if (input.purchaseOrderUrl.trim()) {
      flags.push({
        id: 'po-audit',
        label: 'PO vs signed quote audit',
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
      ? 'Complete manual document review (signed vs unsigned, and PO if applicable) before opening a provisioning ticket.'
      : 'Review flagged items below, then proceed if documents match Salesforce and the signed quote.'
  } else {
    recommendation =
      'Preliminary checks passed. Complete a quick visual compare of signed vs unsigned PDFs, then copy the provisioning template.'
  }

  return { flags, recommendation, summary, documentAnalysis: documentAnalysis ?? null }
}

export function severityLabel(severity: AnalysisSeverity): string {
  if (severity === 'pass') return 'Pass'
  if (severity === 'warn') return 'Warn'
  if (severity === 'fail') return 'Fail'
  return 'Manual'
}

export function analysisSummaryLabel(summary: AnalysisSummary): string {
  if (summary === 'accept') return 'Ready for manual doc review'
  if (summary === 'review') return 'Review required'
  return 'Hold — resolve flags first'
}
