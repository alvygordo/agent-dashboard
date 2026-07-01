export type ExtractedDocumentFields = {
  customerName: string | null
  endUserName: string | null
  resellerName: string | null
  address: string | null
  product: string | null
  supportPlan: string | null
  quantity: string | null
  renewalDate: string | null
  expiryDate: string | null
  supplierName: string | null
  paymentTerms: string | null
  quoteNumber: string | null
  poNumber: string | null
  totalAmount: string | null
  term: string | null
  notes: string[]
}

export type ParsedDocument = {
  title: string | null
  pageCount: number
  textLength: number
  unreadable: boolean
  unreadableReason: string | null
  hasTermsSection: boolean
  hasBuyerTermsLanguage: boolean
  fields: ExtractedDocumentFields
}

const DATE_PATTERNS = [
  /\b(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})\b/g,
  /\b(\d{4}[/.-]\d{1,2}[/.-]\d{1,2})\b/g,
]

const SUPPORT_PLANS = ['Platinum', 'Gold', 'Standard', 'Premium', 'Enterprise']

function firstMatch(text: string, pattern: RegExp): string | null {
  const m = text.match(pattern)
  return m?.[1]?.trim() ?? null
}

function extractAfterLabels(text: string, labels: string[]): string | null {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`${escaped}\\s*:?\\s*([^\\n]{2,140})`, 'i')
    const m = text.match(re)
    if (m?.[1]) {
      const val = m[1].trim().replace(/\s{2,}/g, ' ')
      if (val.length >= 2) return val
    }
  }
  return null
}

function extractAddressBlock(text: string): string | null {
  const billTo = text.match(/(?:Bill(?:ing)?\s*To|Sold\s*To|Customer\s*Address)[:\s]*\n([\s\S]{10,220}?)(?:\n\s*\n|\n[A-Z][a-z]+:)/i)
  if (billTo?.[1]) {
    return billTo[1].trim().replace(/\s+\n/g, ', ').slice(0, 200)
  }
  return extractAfterLabels(text, ['Address', 'Ship To', 'Billing Address'])
}

function extractDates(text: string): { renewal: string | null; expiry: string | null } {
  const renewal = extractAfterLabels(text, [
    'Renewal Date',
    'Renewal date',
    'Subscription Renewal',
    'Renewal',
  ])
  const expiry = extractAfterLabels(text, [
    'Expiry Date',
    'Expiration Date',
    'Subscription End Date',
    'End Date',
    'Current Term End',
    'Term End',
  ])

  const allDates: string[] = []
  for (const pat of DATE_PATTERNS) {
    const matches = text.matchAll(pat)
    for (const m of matches) {
      if (m[1]) allDates.push(m[1])
    }
  }

  return {
    renewal: renewal ?? allDates[0] ?? null,
    expiry: expiry ?? allDates[1] ?? allDates[0] ?? null,
  }
}

function extractProduct(text: string): string | null {
  const fromLabel = extractAfterLabels(text, [
    'Product',
    'Product Name',
    'Software',
    'Subscription',
    'Service',
  ])
  if (fromLabel && !/^(name|description)$/i.test(fromLabel)) return fromLabel

  const productLine = text.match(/\b(CloudSense|DevOps|DevOpsPlatform|Khoros|AnswerHub|Exceed|ACME|Bold360|DevOpsPlatform|DevOps Platform)\b/i)
  return productLine?.[1] ?? null
}

function extractQuantity(text: string): string | null {
  const fromLabel = extractAfterLabels(text, [
    'Quantity',
    'Qty',
    'Users',
    'User Count',
    'Seats',
    'Seat Count',
    'Licenses',
  ])
  if (fromLabel) return fromLabel

  const qtyMatch = text.match(/\b(\d+)\s*(?:users?|seats?|licenses?)\b/i)
  return qtyMatch ? qtyMatch[0] : null
}

function extractSupportPlan(text: string): string | null {
  for (const plan of SUPPORT_PLANS) {
    if (new RegExp(`\\b${plan}\\b`, 'i').test(text)) {
      const supportLine = extractAfterLabels(text, ['Support Plan', 'Support Level', 'Support Tier', 'Success Plan'])
      if (supportLine) return supportLine
      return plan
    }
  }
  return extractAfterLabels(text, ['Support Plan', 'Support Level', 'Support Tier'])
}

function extractPaymentTerms(text: string): string | null {
  const net = text.match(/\bNet\s*\d+\b/i)
  if (net) return net[0]
  return extractAfterLabels(text, ['Payment Terms', 'Payment Term', 'Terms of Payment', 'Billing Terms'])
}

function extractTotal(text: string): string | null {
  const total = text.match(/(?:Total|Grand Total|Amount Due|Order Total|Annual|ARR)[:\s]*\$?\s*([\d,]+(?:\.\d{2})?)/i)
  if (total) return `$${total[1]}`
  const amounts = [...text.matchAll(/\$\s*([\d,]+(?:\.\d{2})?)/g)].map((m) => m[1])
  return amounts.length > 0 ? `$${amounts[amounts.length - 1]}` : null
}

function extractTerm(text: string): string | null {
  const months = text.match(/\b(\d+)\s*(?:month|months|mo)\b/i)
  if (months) return `${months[1]} months`
  return extractAfterLabels(text, ['Term', 'Subscription Term', 'Contract Term', 'Billing Term'])
}

function extractSupplier(text: string): string | null {
  return extractAfterLabels(text, [
    'Service Provider',
    'Supplier',
    'Vendor',
    'Provider',
    'Sold By',
  ]) ?? (/\bTrilogy\b/i.test(text) ? 'Trilogy' : null)
}

function detectTermsSection(text: string): boolean {
  return /\b(terms and conditions|terms & conditions|governing law|limitation of liability|master subscription agreement|msa)\b/i.test(text)
}

function detectBuyerTermsLanguage(text: string): boolean {
  return /\b(purchaser'?s terms|buyer'?s terms|customer'?s terms|supersedes|shall govern|conflict with)\b/i.test(text)
}

function detectPoNumberOnly(text: string, poNumber: string | null): boolean {
  if (text.length > 400) return false
  const hasProduct = /\b(product|subscription|software|license|cloudsense|support)\b/i.test(text)
  const hasAmount = /\$\s*[\d,]+/.test(text)
  const hasPoNumber = Boolean(poNumber)
  return hasPoNumber && !hasProduct && !hasAmount && text.length < 350
}

export function extractFieldsFromText(
  text: string,
  options?: { docKind?: 'quote' | 'po' },
): ExtractedDocumentFields {
  const dates = extractDates(text)
  const poNumber = firstMatch(text, /\bPO\s*(?:#|Number|No\.?)?\s*:?\s*([A-Z0-9][\w-]{2,30})/i)
    ?? firstMatch(text, /\bPurchase\s*Order\s*(?:#|Number|No\.?)?\s*:?\s*([A-Z0-9][\w-]{2,30})/i)

  const quoteNumber = firstMatch(text, /\bQuote\s*(?:#|Number|No\.?)?\s*:?\s*([A-Z0-9][\w-]{2,30})/i)

  const notes: string[] = []
  if (options?.docKind === 'po' && detectPoNumberOnly(text, poNumber)) {
    notes.push('Document appears to contain only a PO number — no pricing, product, or terms visible in extracted text.')
  }
  if (text.length < 80) {
    notes.push('Very little text extracted — document may be scanned/image-only.')
  }

  return {
    customerName: extractAfterLabels(text, ['Customer', 'Customer Name', 'Bill To', 'Sold To', 'Account Name']),
    endUserName: extractAfterLabels(text, ['End User', 'End-User', 'End Customer', 'End User Name']),
    resellerName: extractAfterLabels(text, ['Reseller', 'Partner', 'Channel Partner', 'Distributor']),
    address: extractAddressBlock(text),
    product: extractProduct(text),
    supportPlan: extractSupportPlan(text),
    quantity: extractQuantity(text),
    renewalDate: dates.renewal,
    expiryDate: dates.expiry,
    supplierName: extractSupplier(text),
    paymentTerms: extractPaymentTerms(text),
    quoteNumber,
    poNumber,
    totalAmount: extractTotal(text),
    term: extractTerm(text),
    notes,
  }
}

export function parseDocumentText(
  text: string,
  meta: { title?: string | null; pageCount: number; docKind?: 'quote' | 'po' },
): ParsedDocument {
  const fields = extractFieldsFromText(text, { docKind: meta.docKind })
  const unreadable = text.length < 40
  return {
    title: meta.title ?? null,
    pageCount: meta.pageCount,
    textLength: text.length,
    unreadable,
    unreadableReason: unreadable
      ? 'Could not extract enough text — open the PDF manually to verify.'
      : null,
    hasTermsSection: detectTermsSection(text),
    hasBuyerTermsLanguage: detectBuyerTermsLanguage(text),
    fields,
  }
}

export function normalizeForCompare(value: string | null | undefined): string {
  if (!value) return ''
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function valuesAlign(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizeForCompare(a)
  const nb = normalizeForCompare(b)
  if (!na || !nb) return false
  if (na === nb) return true
  return na.includes(nb) || nb.includes(na)
}

export function formatFieldValue(value: string | null | undefined): string {
  return value?.trim() ? value.trim() : '—'
}
