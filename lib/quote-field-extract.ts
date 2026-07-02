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
  signerName: string | null
  signedDate: string | null
  notes: string[]
}

export type TcSnippet = {
  page: number
  excerpt: string
  clauseRef: string | null
}

export type ParsedDocument = {
  title: string | null
  pageCount: number
  textLength: number
  pageTexts: string[]
  unreadable: boolean
  unreadableReason: string | null
  hasTermsSection: boolean
  hasBuyerTermsLanguage: boolean
  tcSnippets: TcSnippet[]
  fields: ExtractedDocumentFields
}

export type ExtractOptions = {
  docKind?: 'quote' | 'po'
  productHint?: string | null
  expectedTotal?: string | null
  mirrorSupplier?: string | null
}

const SUPPORT_PLANS = ['Platinum', 'Gold', 'Standard', 'Premium', 'Enterprise']
const KNOWN_PRODUCTS = [
  'CloudSense', 'Cloudsense', 'DevOps Platform', 'DevOpsPlatform', 'Khoros',
  'AnswerHub', 'Exceed', 'Bold360', 'ACME',
]
const KNOWN_SUPPLIERS = ['Skyvera', 'Trilogy', 'Aurea', 'GFI', 'Versata', 'IgniteTech']
const GARBAGE_VALUES = /^(item description|unit price|confidential|prepared|security|english|payment termsnet|amount|qty|quantity|description|total|subtotal|revised|quote|date|s:|n\/a)$/i

function firstMatch(text: string, pattern: RegExp): string | null {
  const m = text.match(pattern)
  return m?.[1]?.trim() ?? null
}

function isPlausibleDate(value: string): boolean {
  const v = value.trim()
  return /^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$/.test(v)
    || /^\d{4}[/.-]\d{1,2}[/.-]\d{1,2}$/.test(v)
}

function cleanExtracted(value: string | null | undefined, maxLen = 80): string | null {
  if (!value) return null
  const v = value.trim().replace(/\s{2,}/g, ' ')
  if (v.length < 2 || v.length > maxLen) return null
  if (GARBAGE_VALUES.test(v)) return null
  if (/item description|unit price|payment termsnet/i.test(v)) return null
  if (/\$[\d,]+.*\$/.test(v)) return null
  if (/^[a-z]\.\s/i.test(v) && v.length < 20) return null
  return v
}

function extractAfterLabels(text: string, labels: string[]): string | null {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`${escaped}\\s*:?\\s*([^\\n]{2,100})`, 'i')
    const m = text.match(re)
    if (m?.[1]) {
      const val = cleanExtracted(m[1])
      if (val) return val
    }
  }
  return null
}

function extractLabeledDate(text: string, labels: string[]): string | null {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`${escaped}\\s*:?\\s*(\\d{1,2}[/.-]\\d{1,2}[/.-]\\d{2,4})`, 'i')
    const m = text.match(re)
    if (m?.[1] && isPlausibleDate(m[1])) return m[1]
  }
  return null
}

function extractDates(text: string): { renewal: string | null; expiry: string | null } {
  const renewal = extractLabeledDate(text, [
    'Renewal Date', 'Renewal date', 'Subscription Renewal Date', 'Renewal',
  ])
  const expiry = extractLabeledDate(text, [
    'Expiry Date', 'Expiration Date', 'Subscription End Date', 'End Date',
    'Current Term End', 'Term End', 'Contract End',
  ])
  return { renewal, expiry }
}

function extractProduct(text: string, productHint?: string | null): string | null {
  if (productHint) {
    const hint = productHint.trim()
    if (hint && new RegExp(hint.replace(/\s+/g, '\\s*'), 'i').test(text)) return hint
  }

  const fromLabel = extractAfterLabels(text, ['Product', 'Product Name', 'Software Product'])
  if (fromLabel) return fromLabel

  for (const product of KNOWN_PRODUCTS) {
    if (new RegExp(`\\b${product.replace(/\s+/g, '\\s*')}\\b`, 'i').test(text)) return product
  }

  return null
}

function extractPoProduct(text: string): string | null {
  const lineItem = text.match(/(?:Description|Product|Item)\s*:?\s*([A-Za-z][A-Za-z0-9\s-]{2,40})/i)
  const val = cleanExtracted(lineItem?.[1] ?? null, 50)
  if (val && !/date|name of the|ion date/i.test(val)) return val

  for (const product of KNOWN_PRODUCTS) {
    if (new RegExp(`\\b${product}\\b`, 'i').test(text)) return product
  }

  return null
}

function extractQuantity(text: string): string | null {
  const orgs = text.match(/(?:Orgs?|Organi[sz]ations?)\s*(?:permitted\s*)?(?:is|:)?\s*(\d+)/i)
  if (orgs) return `${orgs[1]} org${orgs[1] === '1' ? '' : 's'}`

  const fromLabel = extractAfterLabels(text, ['Quantity', 'Qty', 'Users', 'User Count', 'Seats', 'Licenses'])
  if (fromLabel && !/item description|unit price/i.test(fromLabel)) {
    const num = fromLabel.match(/\d+/)
    if (num) return num[0]
  }

  const qtyMatch = text.match(/\b(\d+)\s*(?:users?|seats?|licenses?)\b/i)
  return qtyMatch ? qtyMatch[0] : null
}

function extractSupportPlan(text: string): string | null {
  for (const plan of SUPPORT_PLANS) {
    if (new RegExp(`\\b${plan}\\b`, 'i').test(text)) {
      const supportLine = extractAfterLabels(text, ['Support Plan', 'Support Level', 'Support Tier', 'Success Plan'])
      if (supportLine && new RegExp(plan, 'i').test(supportLine)) return plan
      return plan
    }
  }
  return extractAfterLabels(text, ['Support Plan', 'Support Level', 'Support Tier'])
}

export function normalizePaymentTerms(value: string | null | undefined): string | null {
  if (!value) return null
  const t = value.trim()
  const paymentEq = t.match(/PAYMENT\s*=?\s*(\d+)/i)
  if (paymentEq) return `Net ${paymentEq[1]}`
  const net = t.match(/Net\s*(\d+)/i)
  if (net) return `Net ${net[1]}`
  const days = t.match(/\b(\d+)\s*days?\b/i)
  if (days && /payment|term/i.test(t)) return `Net ${days[1]}`
  return cleanExtracted(t, 40)
}

export function paymentTermsAlign(a: string | null, b: string | null): boolean {
  const na = normalizePaymentTerms(a)
  const nb = normalizePaymentTerms(b)
  if (!na || !nb) return false
  return valuesAlign(na, nb)
}

function extractPaymentTerms(text: string): string | null {
  const paymentEq = text.match(/PAYMENT\s*=?\s*(\d+)/i)
  if (paymentEq) return `Net ${paymentEq[1]}`
  const net = text.match(/\bNet\s*\d+\b/i)
  if (net) return net[0].replace(/\s+/g, ' ')
  return normalizePaymentTerms(
    extractAfterLabels(text, ['Payment Terms', 'Payment Term', 'Terms of Payment', 'Billing Terms', 'PAYMENT']),
  )
}

function parseAmount(raw: string): number {
  return parseFloat(raw.replace(/,/g, ''))
}

function extractTotal(text: string, expectedTotal?: string | null): string | null {
  const amounts = [...text.matchAll(/\$\s*([\d,]+(?:\.\d{2})?)/g)].map((m) => m[1])
  if (amounts.length === 0) return null

  if (expectedTotal) {
    const expectedNum = expectedTotal.replace(/[^0-9.]/g, '')
    const match = amounts.find((a) => a.replace(/,/g, '') === expectedNum)
    if (match) return `$${match}`
  }

  const numeric = amounts
    .map((raw) => ({ raw, val: parseAmount(raw) }))
    .filter((x) => !Number.isNaN(x.val))
    .sort((a, b) => b.val - a.val)

  const contractTotal = numeric.find((x) => x.val >= 1000)
  if (contractTotal) return `$${contractTotal.raw}`

  return numeric.length > 0 ? `$${numeric[0].raw}` : null
}

function extractTerm(text: string): string | null {
  const months = text.match(/\b(\d+)\s*(?:month|months|mo)\b/i)
  if (months) return `${months[1]} months`
  return cleanExtracted(extractAfterLabels(text, ['Term', 'Subscription Term', 'Contract Term']), 30)
}

function extractSupplier(text: string, mirrorSupplier?: string | null): string | null {
  const labeled = extractAfterLabels(text, [
    'Service Provider', 'Service Provider Name', 'Supplier', 'Supplier Name', 'Vendor', 'Sold By',
  ])
  if (labeled) {
    const company = labeled.split(/[,(\n]/)[0]?.trim()
    if (company && !GARBAGE_VALUES.test(company) && company.length >= 3) return company
  }

  if (mirrorSupplier) {
    const escaped = mirrorSupplier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (new RegExp(escaped, 'i').test(text)) return mirrorSupplier
  }

  for (const name of KNOWN_SUPPLIERS) {
    if (new RegExp(`\\b${name}\\b`, 'i').test(text)) return name
  }

  return null
}

function extractQuoteNumber(text: string): string | null {
  const q = firstMatch(text, /\b(?:Quote|Q)[#:\s-]*([A-Z0-9][\w-]{3,25})/i)
  if (q && !GARBAGE_VALUES.test(q)) return q
  return null
}

function extractSignature(text: string): { signerName: string | null; signedDate: string | null } {
  const signer =
    firstMatch(text, /(?:Signed\s*by|Signatory|Authorized\s*Signatory)\s*:?\s*([A-Za-z][A-Za-z\s.'-]{2,50})/i)
    ?? firstMatch(text, /(?:DocuSign|Adobe\s*Sign)/i)

  const signedDate =
    extractLabeledDate(text, ['Date Signed', 'Signed Date', 'Execution Date', 'Signature Date'])
    ?? firstMatch(text, /(?:Signed|Executed)\s*(?:on|:)?\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})/i)

  return {
    signerName: signer ? cleanExtracted(signer, 50) : null,
    signedDate: signedDate && isPlausibleDate(signedDate) ? signedDate : null,
  }
}

function detectTermsSection(text: string): boolean {
  return /\b(terms and conditions|terms & conditions|governing law|limitation of liability|master subscription agreement|msa)\b/i.test(text)
}

function detectBuyerTermsLanguage(text: string): boolean {
  return /\b(purchaser'?s terms|buyer'?s terms|customer'?s terms|supersedes|shall govern|conflict with|prevail over)\b/i.test(text)
}

function detectPoNumberOnly(text: string, poNumber: string | null): boolean {
  if (text.length > 400) return false
  const hasProduct = /\b(product|subscription|software|license|cloudsense|support)\b/i.test(text)
  const hasAmount = /\$\s*[\d,]+/.test(text)
  return Boolean(poNumber) && !hasProduct && !hasAmount && text.length < 350
}

export function findTcSnippets(pageTexts: string[]): TcSnippet[] {
  const patterns = [
    /purchaser'?s terms/i,
    /buyer'?s terms/i,
    /customer'?s terms/i,
    /shall govern/i,
    /supersedes/i,
    /prevail over/i,
    /conflict with/i,
    /limitation of liability/i,
    /governing law/i,
  ]
  const clauseRef = /(?:section|clause|article|item)\s+[\d]+(?:\.[\d]+)*/i
  const snippets: TcSnippet[] = []

  pageTexts.forEach((pageText, idx) => {
    for (const pat of patterns) {
      const m = pageText.match(pat)
      if (!m || m.index == null) continue
      const start = Math.max(0, m.index - 60)
      const end = Math.min(pageText.length, m.index + 120)
      const excerpt = pageText.slice(start, end).replace(/\s+/g, ' ').trim()
      const before = pageText.slice(Math.max(0, m.index - 200), m.index)
      const refMatch = before.match(clauseRef)
      snippets.push({
        page: idx + 1,
        excerpt,
        clauseRef: refMatch?.[0] ?? null,
      })
    }
  })

  return snippets.slice(0, 5)
}

export function extractFieldsFromText(
  text: string,
  options?: ExtractOptions,
): ExtractedDocumentFields {
  const dates = extractDates(text)
  const poNumber = firstMatch(text, /\bPO\s*(?:#|Number|No\.?)?\s*:?\s*([A-Z0-9][\w-]{2,30})/i)
    ?? firstMatch(text, /\bPurchase\s*Order\s*(?:#|Number|No\.?)?\s*:?\s*([A-Z0-9][\w-]{2,30})/i)

  const quoteNumber = extractQuoteNumber(text)
  const signature = options?.docKind === 'quote' ? extractSignature(text) : { signerName: null, signedDate: null }

  const product = options?.docKind === 'po'
    ? extractPoProduct(text)
    : extractProduct(text, options?.productHint)

  const notes: string[] = []
  if (options?.docKind === 'po' && detectPoNumberOnly(text, poNumber)) {
    notes.push('Document appears to contain only a PO number — no pricing, product, or terms visible in extracted text.')
  }
  if (options?.docKind === 'po' && !product) {
    notes.push('No product name found on PO — line items may be generic or missing.')
  }
  if (text.length < 80) {
    notes.push('Very little text extracted — document may be scanned/image-only.')
  }

  return {
    customerName: extractAfterLabels(text, ['Customer', 'Customer Name', 'Bill To', 'Sold To', 'Account Name']),
    endUserName: extractAfterLabels(text, ['End User', 'End-User', 'End Customer', 'End User Name']),
    resellerName: extractAfterLabels(text, ['Reseller', 'Partner', 'Channel Partner']),
    address: null,
    product,
    supportPlan: extractSupportPlan(text),
    quantity: extractQuantity(text),
    renewalDate: dates.renewal,
    expiryDate: dates.expiry,
    supplierName: extractSupplier(text, options?.mirrorSupplier),
    paymentTerms: extractPaymentTerms(text),
    quoteNumber,
    poNumber,
    totalAmount: extractTotal(text, options?.expectedTotal),
    term: extractTerm(text),
    signerName: signature.signerName,
    signedDate: signature.signedDate,
    notes,
  }
}

export function parseDocumentText(
  text: string,
  meta: {
    title?: string | null
    pageCount: number
    pageTexts?: string[]
    docKind?: 'quote' | 'po'
    productHint?: string | null
    expectedTotal?: string | null
    mirrorSupplier?: string | null
  },
): ParsedDocument {
  const pageTexts = meta.pageTexts ?? []
  const fields = extractFieldsFromText(text, {
    docKind: meta.docKind,
    productHint: meta.productHint,
    expectedTotal: meta.expectedTotal,
    mirrorSupplier: meta.mirrorSupplier,
  })
  const unreadable = text.length < 40
  return {
    title: meta.title ?? null,
    pageCount: meta.pageCount,
    textLength: text.length,
    pageTexts,
    unreadable,
    unreadableReason: unreadable
      ? 'Could not extract enough text — open the PDF manually to verify.'
      : null,
    hasTermsSection: detectTermsSection(text),
    hasBuyerTermsLanguage: detectBuyerTermsLanguage(text),
    tcSnippets: meta.docKind === 'po' ? findTcSnippets(pageTexts) : [],
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
