export type QuoteReviewMode =
  | 'quote-signed-adobe'
  | 'quote-signed-manual'
  | 'po-received'
  | 'auto-renew'
  | 'unsupported'

export const VALID_SQ_REVIEW_WIN_TYPES = new Set([
  'Quote Signed',
  'PO Received',
  'Auto-Renew',
])

export type PoRequirementStatus =
  | 'not-required'
  | 'required-attached'
  | 'required-pending'
  | 'unknown'

export type ReviewModePlan = {
  mode: QuoteReviewMode
  title: string
  description: string
  requiresUnsigned: boolean
  requiresSigned: boolean
  requiresPo: boolean
  comparePo: boolean
  poRequirement: PoRequirementStatus | null
  poRequirementRaw: string | null
  showUnsignedSignedComparison: boolean
  showSignedPoComparison: boolean
  showUnsignedPoComparison: boolean
  provisioningUsesUnsigned: boolean
}

const VALID_WIN = VALID_SQ_REVIEW_WIN_TYPES

export function parsePoRequirement(
  raw: string | null | undefined,
): { status: PoRequirementStatus; raw: string | null } {
  const value = raw?.trim() ?? null
  if (!value) return { status: 'unknown', raw: null }

  const lower = value.toLowerCase()
  if (lower === 'not required') return { status: 'not-required', raw: value }
  if (lower.includes('required') && lower.includes('attached')) {
    return { status: 'required-attached', raw: value }
  }
  if (lower.includes('required') && lower.includes('pending')) {
    return { status: 'required-pending', raw: value }
  }
  return { status: 'unknown', raw: value }
}

export function isPrimaryQuoteAdobeSigned(status: string | null | undefined): boolean {
  if (!status?.trim()) return false
  return status.trim().toLowerCase() === 'signed'
}

export function isOutForSignatureStatus(status: string | null | undefined): boolean {
  if (!status?.trim()) return false
  return status.trim().toLowerCase() === 'out for signature'
}

export function usesUnsignedQuoteBaseline(mode: QuoteReviewMode): boolean {
  return mode === 'po-received' || mode === 'auto-renew'
}

/** PDF source of truth for term start/end dates and service provider. */
export function quoteTermBaselineDoc(mode: QuoteReviewMode): 'unsigned' | 'signed' {
  return usesUnsignedQuoteBaseline(mode) ? 'unsigned' : 'signed'
}

export function resolveQuoteReviewMode(input: {
  winType: string | null | undefined
  primaryQuoteStatus: string | null | undefined
  signedQuoteUrl: string | null | undefined
  purchaseOrderLink: string | null | undefined
  purchaseOrderRequirement?: string | null | undefined
}): ReviewModePlan {
  const winType = input.winType?.trim() ?? null
  const purchaseOrderLink = input.purchaseOrderLink?.trim() ?? null
  const adobeSigned = isPrimaryQuoteAdobeSigned(input.primaryQuoteStatus)
  const poReq = parsePoRequirement(input.purchaseOrderRequirement)

  if (!winType || !VALID_WIN.has(winType)) {
    return {
      mode: 'unsupported',
      title: 'Unsupported Win Type',
      description:
        'Win Type must be Quote Signed, PO Received, or Auto-Renew before running this workflow.',
      requiresUnsigned: false,
      requiresSigned: false,
      requiresPo: false,
      comparePo: false,
      poRequirement: poReq.status === 'unknown' ? null : poReq.status,
      poRequirementRaw: poReq.raw,
      showUnsignedSignedComparison: false,
      showSignedPoComparison: false,
      showUnsignedPoComparison: false,
      provisioningUsesUnsigned: true,
    }
  }

  if (winType === 'Auto-Renew') {
    return {
      mode: 'auto-renew',
      title: 'Auto-Renew — provisioning from AR quote',
      description:
        'Customer is auto-renewing — no signed quote or PO. AR quote should be Out for Signature. Read the unsigned quote PDF from the AR quote Notes & Attachments and create a provisioning ticket from that document.',
      requiresUnsigned: true,
      requiresSigned: false,
      requiresPo: false,
      comparePo: false,
      poRequirement: poReq.status === 'unknown' ? null : poReq.status,
      poRequirementRaw: poReq.raw,
      showUnsignedSignedComparison: false,
      showSignedPoComparison: false,
      showUnsignedPoComparison: false,
      provisioningUsesUnsigned: true,
    }
  }

  if (winType === 'PO Received') {
    return {
      mode: 'po-received',
      title: 'PO Received — renew on PO only',
      description:
        'Customer sent a PO without signing the quote. Compare the unsigned primary quote to the PO. Confirm the PO references the quote number.',
      requiresUnsigned: true,
      requiresSigned: false,
      requiresPo: true,
      comparePo: true,
      poRequirement: poReq.status === 'unknown' ? 'required-attached' : poReq.status,
      poRequirementRaw: poReq.raw,
      showUnsignedSignedComparison: false,
      showSignedPoComparison: false,
      showUnsignedPoComparison: true,
      provisioningUsesUnsigned: true,
    }
  }

  const comparePo = poReq.status === 'required-attached'
  const requiresPoLink = comparePo

  // Quote Signed
  if (adobeSigned) {
    const description = comparePo
      ? 'Primary quote is Adobe-signed. Analyze the signed quote and compare it to the attached PO.'
      : poReq.status === 'required-pending'
        ? 'Primary quote is Adobe-signed. PO is required but pending — analyze the signed quote only until the PO is attached.'
        : 'Primary quote is Adobe-signed. PO not required — analyze the signed quote only.'

    return {
      mode: 'quote-signed-adobe',
      title: comparePo
        ? 'Quote Signed — Adobe-signed, PO attached'
        : 'Quote Signed — Adobe-signed, no PO comparison',
      description,
      requiresUnsigned: false,
      requiresSigned: true,
      requiresPo: requiresPoLink,
      comparePo,
      poRequirement: poReq.status === 'unknown' ? null : poReq.status,
      poRequirementRaw: poReq.raw,
      showUnsignedSignedComparison: false,
      showSignedPoComparison: comparePo,
      showUnsignedPoComparison: false,
      provisioningUsesUnsigned: false,
    }
  }

  const manualDescription = comparePo
    ? 'Signed outside Adobe. Compare unsigned to signed quote, then compare signed quote to the attached PO.'
    : poReq.status === 'required-pending'
      ? 'Signed outside Adobe. PO is required but pending — compare unsigned to signed quote only until the PO is attached.'
      : poReq.status === 'not-required'
        ? 'Signed outside Adobe. PO not required — compare unsigned to signed quote only.'
        : 'Signed outside Adobe. Compare the unsigned primary quote to the Signed Quote document.'

  return {
    mode: 'quote-signed-manual',
    title: comparePo
      ? 'Quote Signed — manual signature, PO attached'
      : 'Quote Signed — manual signature, no PO comparison',
    description: manualDescription,
    requiresUnsigned: true,
    requiresSigned: true,
    requiresPo: requiresPoLink,
    comparePo,
    poRequirement: poReq.status === 'unknown' ? null : poReq.status,
    poRequirementRaw: poReq.raw,
    showUnsignedSignedComparison: true,
    showSignedPoComparison: comparePo,
    showUnsignedPoComparison: false,
    provisioningUsesUnsigned: false,
  }
}

export function modeLabel(mode: QuoteReviewMode, comparePo = true): string {
  if (mode === 'quote-signed-adobe') {
    return comparePo ? 'Adobe-signed — signed quote vs PO' : 'Adobe-signed — signed quote only'
  }
  if (mode === 'quote-signed-manual') {
    return comparePo
      ? 'Manual signature — unsigned vs signed vs PO'
      : 'Manual signature — unsigned vs signed'
  }
  if (mode === 'po-received') return 'PO Received — unsigned quote vs PO'
  if (mode === 'auto-renew') return 'Auto-Renew — AR quote vs Salesforce'
  return 'Unsupported Win Type'
}
