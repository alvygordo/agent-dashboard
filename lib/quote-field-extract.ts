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
  termHint?: string | number | null
  titleHint?: string | null
  quoteNumberHint?: string | null
  quantityHint?: string | number | null
  renewalDateHint?: string | null
  expiryDateHint?: string | null
  pageTexts?: string[]
}

const SUPPORT_PLANS = ['Platinum', 'Gold', 'Standard', 'Premium', 'Enterprise']
const KNOWN_PRODUCTS = [
  'CloudSense', 'Cloudsense', 'DevOps Platform', 'DevOpsPlatform', 'Khoros',
  'AnswerHub', 'Exceed', 'Bold360', 'ACME',
]
const KNOWN_SUPPLIERS = ['Skyvera', 'Trilogy', 'Aurea', 'GFI', 'Versata', 'IgniteTech']
const GARBAGE_VALUES = /^(item description|unit price|confidential|prepared|security|english|payment termsnet|amount|qty|quantity|description|total|subtotal|revised|quote|date|s:|n\/a|reference)$/i

const QUOTE_NUMBER_REJECT = new Set([
  'prepared', 'revised', 'confidential', 'quote', 'unsigned', 'signed', 'payment',
  'termsnet', 'english', 'security', 'baseline', 'customer',
])

const SUPPLIER_REJECT = /^(shall|have|no|reference|confidential|prepared|the|a|an|agree|supplier|vendor|services?|goods?|ion|item)\b/i

const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
]

function parseSpelledDate(value: string): string | null {
  const m = value.match(/(\w+)\s+(\d{1,2}),?\s+(\d{4})/i)
  if (!m) return null
  const monthIdx = MONTH_NAMES.indexOf(m[1].toLowerCase())
  if (monthIdx < 0) return null
  const mm = String(monthIdx + 1).padStart(2, '0')
  const dd = String(parseInt(m[2], 10)).padStart(2, '0')
  return `${mm}/${dd}/${m[3]}`
}

function isSupplierGarbage(value: string): boolean {
  const v = value.trim()
  if (v.length < 3 || v.length > 60) return true
  if (SUPPLIER_REJECT.test(v)) return true
  if (/\b(shall|govern|obligations?|acknowledge|expressly|article|section)\b/i.test(v)) return true
  if (v.split(/\s+/).length > 5) return true
  return false
}

function firstMatch(text: string, pattern: RegExp): string | null {
  const m = text.match(pattern)
  return m?.[1]?.trim() ?? null
}

function isPlausibleDate(value: string): boolean {
  const v = value.trim()
  return /^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$/.test(v)
    || /^\d{4}[/.-]\d{1,2}[/.-]\d{1,2}$/.test(v)
    || /^\d{1,2}[-/][A-Za-z]{3,9}[-/]\d{4}$/.test(v)
}

/** Normalize any extracted date to YYYY-MM-DD for comparison. */
export function normalizeDateForCompare(value: string | null | undefined): string | null {
  if (!value?.trim()) return null
  const v = value.trim()

  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`

  const us = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/)
  if (us) {
    const y = us[3].length === 2 ? `20${us[3]}` : us[3]
    return `${y}-${String(parseInt(us[1], 10)).padStart(2, '0')}-${String(parseInt(us[2], 10)).padStart(2, '0')}`
  }

  const dmy = v.match(/^(\d{1,2})[-/]([A-Za-z]{3,9})[-/](\d{4})$/i)
  if (dmy) {
    const monthIdx = MONTH_NAMES.indexOf(dmy[2].toLowerCase())
    if (monthIdx >= 0) {
      return `${dmy[3]}-${String(monthIdx + 1).padStart(2, '0')}-${String(parseInt(dmy[1], 10)).padStart(2, '0')}`
    }
  }

  const spelled = parseSpelledDate(v)
  if (spelled) {
    const p = spelled.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (p) return `${p[3]}-${p[1]}-${p[2]}`
  }

  return null
}

export function datesAlign(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizeDateForCompare(a)
  const nb = normalizeDateForCompare(b)
  if (!na || !nb) return false
  return na === nb
}

function parseFlexibleDate(value: string): string | null {
  const v = value.trim()
  if (isPlausibleDate(v)) return v

  const dmy = v.match(/^(\d{1,2})[-/]([A-Za-z]{3,9})[-/](\d{4})$/i)
  if (dmy) {
    const monthIdx = MONTH_NAMES.indexOf(dmy[2].toLowerCase())
    if (monthIdx >= 0) {
      const mm = String(monthIdx + 1).padStart(2, '0')
      const dd = String(parseInt(dmy[1], 10)).padStart(2, '0')
      return `${mm}/${dd}/${dmy[3]}`
    }
  }

  return parseSpelledDate(v)
}

function extractLabeledFlexibleDate(text: string, labels: string[]): string | null {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(
      `${escaped}\\s*:?\\s*(\\d{1,2}[-/][A-Za-z]{3,9}[-/]\\d{4}|\\d{1,2}[/.-]\\d{1,2}[/.-]\\d{2,4})`,
      'i',
    )
    const m = text.match(re)
    if (m?.[1]) {
      const parsed = parseFlexibleDate(m[1])
      if (parsed) return parsed
    }
  }
  return null
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

function extractDates(text: string, pageTexts?: string[]): { renewal: string | null; expiry: string | null } {
  const headerScope = pageTexts?.slice(0, 2).join('\n') ?? text.slice(0, 4000)

  let renewal = extractLabeledFlexibleDate(headerScope, [
    'Term Start Date', 'Term start date', 'Renewal Date', 'Renewal date',
    'Subscription Start Date', 'Start Date', 'Service Start Date', 'Effective Date',
  ])
  let expiry = extractLabeledFlexibleDate(headerScope, [
    'Term End Date', 'Term end date', 'Expiry Date', 'Expiration Date',
    'Subscription End Date', 'End Date', 'Current Term End', 'Term End', 'Contract End',
  ])

  if (!renewal || !expiry) {
    const fallback = extractDatesFromFullText(text)
    if (!renewal) renewal = fallback.renewal
    if (!expiry) expiry = fallback.expiry
  }

  return { renewal, expiry }
}

function extractDatesFromFullText(text: string): { renewal: string | null; expiry: string | null } {
  let renewal = extractLabeledFlexibleDate(text, [
    'Term Start Date', 'Renewal Date', 'Subscription Start Date', 'Start Date', 'Effective Date',
  ])
  let expiry = extractLabeledFlexibleDate(text, [
    'Term End Date', 'Expiry Date', 'Expiration Date', 'Subscription End Date', 'End Date', 'Term End',
  ])

  const periodRange = text.match(
    /(?:subscription|service|contract|license)\s+period\s*:?\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})\s*(?:to|through|until|-|–)\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})/i,
  )
  if (periodRange) {
    if (!renewal) renewal = periodRange[1]
    if (!expiry) expiry = periodRange[2]
  }

  const fromTo = text.match(
    /(?:from|between)\s+(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})\s+(?:to|and|through|-)\s+(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})/i,
  )
  if (fromTo) {
    if (!renewal) renewal = fromTo[1]
    if (!expiry) expiry = fromTo[2]
  }

  const spelledRange = text.match(
    /((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})\s*(?:to|through|-|–)\s*((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})/i,
  )
  if (spelledRange) {
    if (!renewal) renewal = parseSpelledDate(spelledRange[1])
    if (!expiry) expiry = parseSpelledDate(spelledRange[2])
  }

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

function extractPoProduct(text: string, productHint?: string | null, pageTexts?: string[]): string | null {
  const scope = (pageTexts?.slice(0, 4).join('\n') ?? text.slice(0, 10_000))

  if (productHint) {
    const hint = productHint.trim()
    if (hint && new RegExp(hint.replace(/\s+/g, '\\s*'), 'i').test(scope)) return hint
  }

  const linePatterns = [
    /(?:Description|Product|Item|Material|Software|License)\s*:?\s*([A-Za-z][A-Za-z0-9\s-]{2,45})/gi,
  ]
  for (const pat of linePatterns) {
    for (const m of scope.matchAll(pat)) {
      const val = cleanExtracted(m[1], 50)
      if (val && !/date|name of the|unit price|qty|amount/i.test(val)) {
        for (const product of KNOWN_PRODUCTS) {
          if (new RegExp(product, 'i').test(val)) return product
        }
        if (productHint && valuesAlign(val, productHint)) return productHint
      }
    }
  }

  const found: string[] = []
  for (const product of KNOWN_PRODUCTS) {
    if (new RegExp(`\\b${product.replace(/\s+/g, '\\s*')}\\b`, 'i').test(scope)) {
      found.push(product)
    }
  }

  if (productHint) {
    const match = found.find((p) => valuesAlign(p, productHint))
    if (match) return match
    if (found.length === 0) return null
  }

  const deprioritized = found.filter((p) => {
    if (p.toLowerCase() === 'exceed' && productHint && !valuesAlign(p, productHint)) {
      return /(?:description|product|item|license|subscription|qty|quantity)\s*:?[^\n]{0,80}\bexceed\b/i.test(scope)
    }
    return true
  })

  if (productHint && deprioritized.length === 0) return null

  return deprioritized[0] ?? null
}

function digitsOnly(value: string | null | undefined): string {
  return value?.replace(/[^\d]/g, '') ?? ''
}

function looksLikeStrayAmount(
  value: string,
  expectedTotal?: string | null,
  quantityHint?: string | number | null,
): boolean {
  const digits = digitsOnly(value)
  if (!digits) return true
  const n = parseInt(digits, 10)
  if (Number.isNaN(n) || n <= 0) return true

  const totalDigits = digitsOnly(expectedTotal)
  if (totalDigits && digits === totalDigits) return true

  const hint = quantityHint != null ? Number(quantityHint) : null
  if (hint != null && !Number.isNaN(hint) && hint > 0 && n !== hint) {
    if (n >= 1000 && n > hint * 50) return true
  }

  return false
}

function extractLineItemQuantities(
  text: string,
  pageTexts?: string[],
  expectedTotal?: string | null,
  quantityHint?: string | number | null,
): { qty: string | null; note: string | null } {
  const scope = pageTexts?.slice(0, 4).join('\n') ?? text.slice(0, 20_000)

  if (!/item\s*code|item\s*description|qty/i.test(scope)) {
    return { qty: null, note: null }
  }

  const qtys: number[] = []

  // Item Code … Qty … Description … Amount  (e.g. Cls-SA-Pla-STA 1 CloudSense Platform … $308,776.42)
  const rowPatterns = [
    /\b([A-Z]{2,3}[-][A-Za-z0-9-]{4,})\s+(\d{1,6})\s+(?:CloudSense|Cloudsense|[A-Z][A-Za-z])/gi,
    /\b([A-Za-z0-9][\w-]{5,})\s+(\d{1,6})\s+[A-Za-z][^\n$]{8,90}\$\s*[\d,]+/g,
  ]

  for (const pat of rowPatterns) {
    for (const m of scope.matchAll(pat)) {
      const n = parseInt(m[2], 10)
      if (!Number.isNaN(n) && n > 0 && n <= 100_000 && !looksLikeStrayAmount(String(n), expectedTotal, quantityHint)) {
        qtys.push(n)
      }
    }
    if (qtys.length > 0) break
  }

  if (qtys.length === 0) return { qty: null, note: null }

  const unique = [...new Set(qtys)]
  if (unique.length === 1) {
    const note = qtys.length > 1 ? `Line item table: ${qtys.length} rows × qty ${unique[0]}` : null
    return { qty: String(unique[0]), note }
  }

  const sum = qtys.reduce((a, b) => a + b, 0)
  return {
    qty: String(sum),
    note: `Line item table qtys: ${qtys.join(' + ')} = ${sum}`,
  }
}

function extractQuantity(
  text: string,
  pageTexts?: string[],
  notes?: string[],
  quantityHint?: string | number | null,
  expectedTotal?: string | null,
): string | null {
  const table = extractLineItemQuantities(text, pageTexts, expectedTotal, quantityHint)
  if (table.qty) {
    if (table.note && notes) notes.push(table.note)
    return table.qty
  }

  const footerOrgs = text.match(/(?:Orgs?|Organi[sz]ations?)\s*(?:permitted\s*)?(?:is|:)?\s*(\d+)/i)
    ?? text.match(/\b(\d{1,6})\s+organi[sz]ations?\b/i)

  if (footerOrgs && notes) {
    notes.push(`Footer mentions ${footerOrgs[1]} orgs — no line-item qty table found; verify manually.`)
  }

  const fromLabel = extractAfterLabels(text, ['Quantity', 'Qty', 'Users', 'User Count', 'Seats', 'Licenses'])
  if (fromLabel && !/item description|unit price/i.test(fromLabel)) {
    const num = fromLabel.match(/\d+/)
    if (num && !looksLikeStrayAmount(num[0], expectedTotal, quantityHint)) return num[0]
  }

  const qtyMatch = text.match(/\b(\d+)\s*(?:users?|seats?|licenses?)\b/i)
  if (qtyMatch && !looksLikeStrayAmount(qtyMatch[1], expectedTotal, quantityHint)) return qtyMatch[1]

  if (quantityHint != null && Number(quantityHint) > 0) {
    return String(quantityHint)
  }

  return null
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

function extractPaymentTerms(text: string, pageTexts?: string[], docKind?: 'quote' | 'po'): string | null {
  const headerScope = pageTexts?.slice(0, 3).join('\n') ?? text.slice(0, 6000)
  const scopes = docKind === 'po' ? [headerScope] : [headerScope, text]

  for (const scope of scopes) {
    const paymentPatterns = [
      /PAYMENT\s*(?:=|:)\s*(\d{1,3})\b/i,
      /\bPAYMENT\b[\s:=\-]*(\d{1,3})\b/i,
      /PAYMENT\s*\n\s*(\d{1,3})\b/i,
    ]
    for (const pat of paymentPatterns) {
      const m = scope.match(pat)
      if (m?.[1]) return `Net ${m[1]}`
    }

    const termsNetConcat = scope.match(/Payment\s*Terms\s*Net\s*(\d+)/i)
      ?? scope.match(/PaymentTermsNet\s*(\d+)/i)
    if (termsNetConcat) return `Net ${termsNetConcat[1]}`

    const paymentTermsLine = scope.match(/Payment\s*Terms\s*:?\s*([^\n]{3,50})/i)
    if (paymentTermsLine) {
      const normalized = normalizePaymentTerms(paymentTermsLine[1])
      if (normalized) return normalized
    }
  }

  if (docKind === 'po') return null

  const netMatches = [...text.matchAll(/\bNet\s*(\d+)\b/gi)].map((m) => parseInt(m[1], 10))
  const standardNets = netMatches.filter((n) => [10, 15, 30, 45, 60, 90].includes(n))
  if (standardNets.length > 0) return `Net ${standardNets[0]}`

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

  const numeric = amounts
    .map((raw) => ({ raw, val: parseAmount(raw) }))
    .filter((x) => !Number.isNaN(x.val))
    .sort((a, b) => b.val - a.val)

  if (expectedTotal) {
    const expectedNum = parseAmount(expectedTotal.replace(/[^0-9.]/g, ''))
    if (!Number.isNaN(expectedNum) && expectedNum > 0) {
      let best: { raw: string; diff: number } | null = null
      for (const x of numeric) {
        const diff = Math.abs(x.val - expectedNum)
        if (!best || diff < best.diff) best = { raw: x.raw, diff }
      }
      if (best && best.diff / expectedNum <= 0.05) return `$${best.raw}`
      // PO with expected total — do not fall back to unrelated large amounts
      if (best && best.diff / expectedNum <= 0.25) return `$${best.raw}`
      return null
    }
  }

  const contractTotal = numeric.find((x) => x.val >= 1000 && x.val <= 50_000_000)
  if (contractTotal) return `$${contractTotal.raw}`

  return numeric.length > 0 ? `$${numeric[0].raw}` : null
}

function extractTerm(text: string, termHint?: string | number | null, pageTexts?: string[]): string | null {
  const scopes = [...(pageTexts?.slice(0, 4) ?? []), text]

  for (const scope of scopes) {
    const found = extractTermFromScope(scope, termHint)
    if (found) return found
  }

  return null
}

function extractTermFromScope(text: string, termHint?: string | number | null): string | null {
  const duration = text.match(/Term\s*Duration\s*:?\s*(\d+)\s*(month|months|mo|year|years|yr)\b/i)
  if (duration) {
    const n = parseInt(duration[1], 10)
    const unit = duration[2].toLowerCase()
    if (/year|yr/.test(unit)) return `${n * 12} months`
    return `${n} months`
  }

  const hintMonths = termHint != null ? String(termHint).match(/(\d+)/)?.[1] : null

  if (/twelve\s*\(\s*12\s*\)\s*months?\b/i.test(text)) return '12 months'

  const monthPatterns = [
    /\b(\d{1,3})\s*[-]?\s*(?:month|months|mo)(?:\s+(?:subscription|term|license|renewal))?\b/i,
    /\b(?:subscription|contract|initial|license)\s+term\s*:?\s*(\d{1,3})\s*(?:month|months|mo)\b/i,
    /\brenew(?:al|ing)?\s+for\s+(\d{1,3})\s*(?:month|months|mo)\b/i,
  ]

  for (const pat of monthPatterns) {
    const m = text.match(pat)
    if (!m?.[1]) continue
    const context = m[0]
    if (/payment|termsnet|net\s*\d/i.test(context)) continue
    return `${m[1]} months`
  }

  const years = text.match(/\b(\d{1,2})\s*-?\s*years?\b/i)
  if (years && !/payment|termsnet/i.test(years[0])) {
    return `${parseInt(years[1], 10) * 12} months`
  }

  if (hintMonths && new RegExp(`\\b${hintMonths}\\s*(?:month|months|mo)\\b`, 'i').test(text)) {
    return `${hintMonths} months`
  }

  const labeled = extractAfterLabels(text, ['Term', 'Subscription Term', 'Contract Term', 'License Term'])
  if (labeled && !/payment|termsnet|net\s*\d/i.test(labeled)) {
    const mo = labeled.match(/(\d+)\s*(?:month|months|mo)/i)
    if (mo) return `${mo[1]} months`
    return cleanExtracted(labeled, 30)
  }

  return null
}

function extractSupplier(
  text: string,
  mirrorSupplier?: string | null,
  pageTexts?: string[],
): string | null {
  const headerScope = pageTexts?.slice(0, 2).join('\n') ?? text.slice(0, 4000)

  const providerBlock = headerScope.match(
    /Service\s*Provider\s*:?\s*\n?\s*([A-Z][A-Za-z0-9\s&.,'-]{2,50})/i,
  )
  if (providerBlock?.[1]) {
    const company = providerBlock[1].split(/[,(\n]/)[0]?.trim()
    if (company && !isSupplierGarbage(company)) return company
  }

  for (const name of KNOWN_SUPPLIERS) {
    if (new RegExp(`\\b${name}\\b`, 'i').test(headerScope)) return name
  }

  const labeled = extractAfterLabels(headerScope, [
    'Service Provider', 'Service Provider Name', 'Supplier', 'Supplier Name', 'Vendor', 'Sold By',
  ])
  if (labeled) {
    const company = labeled.split(/[,(\n]/)[0]?.trim()
    if (company && !GARBAGE_VALUES.test(company) && !isSupplierGarbage(company)) return company
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

function extractQuoteNumber(
  text: string,
  titleHint?: string | null,
  quoteNumberHint?: string | null,
  pageTexts?: string[],
): string | null {
  if (titleHint) {
    const fromTitle = titleHint.match(/\bQ[-_]?\d{4,8}\b/i)
    if (fromTitle) return fromTitle[0].replace('_', '-')
  }

  const scopes = [
    ...(pageTexts?.slice(0, 4) ?? []),
    text,
  ]

  for (const scope of scopes) {
    const found = extractQuoteNumberFromScope(scope, quoteNumberHint)
    if (found) return found
  }

  return null
}

function extractQuoteNumberFromScope(
  text: string,
  quoteNumberHint?: string | null,
): string | null {
  if (quoteNumberHint && new RegExp(quoteNumberHint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(text)) {
    return quoteNumberHint
  }

  const patterns: RegExp[] = [
    /\b(Q-\d{4,8})\b/i,
    /\bQuote\s*(?:#|No\.?|Number)\s*:?\s*([A-Z]{0,3}[-]?\d{4,10})/i,
    /\bOF[-\s](\d{4,8})\b/i,
    /\b(?:Quote|Q)[#:\s-]+([A-Z0-9][\w-]{3,25})/i,
  ]

  for (const re of patterns) {
    const m = text.match(re)
    if (!m) continue
    const val = (m[1] ?? m[0]).trim()
    if (QUOTE_NUMBER_REJECT.has(val.toLowerCase()) || GARBAGE_VALUES.test(val)) continue
    if (/^\d{4,8}$/.test(val) && !quoteNumberHint) continue
    return val.startsWith('Q') || val.startsWith('q') ? val.replace(/^q/i, 'Q') : val
  }

  return null
}

function extractSignature(
  text: string,
  pageTexts?: string[],
): { signerName: string | null; signedDate: string | null; customerBlockFound: boolean } {
  const chunks = pageTexts?.length
    ? [...pageTexts.slice(-4), text.slice(Math.max(0, text.length - 6000))]
    : [text]

  let signer: string | null = null
  let signedDate: string | null = null
  let customerBlockFound = false

  for (const chunk of chunks) {
    const customerBlock = chunk.match(
      /For\s+Customer\s*:?\s*([\s\S]{0,900}?)(?=For\s+Service\s+Provider|For\s+Supplier|$)/i,
    )
    if (customerBlock) {
      customerBlockFound = true
      const block = customerBlock[1]
      signer =
        firstMatch(block, /(?:Name|Signed\s*by|Signatory|Authorized\s*(?:Signatory|Representative))\s*:?\s*([A-Za-z][A-Za-z\s.'-]{2,50})/i)
        ?? firstMatch(block, /\/s\/\s*([A-Za-z][A-Za-z\s.'-]{2,50})/i)
        ?? firstMatch(block, /(?:By)\s*:?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z.'-]+){1,3})/)
      signedDate =
        extractLabeledFlexibleDate(block, ['Date', 'Date Signed', 'Signed Date', 'Signature Date'])
        ?? firstMatch(block, /Date\s*:?\s*(\d{1,2}[-/][A-Za-z]{3,9}[-/]\d{4}|\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})/i)
    }

    if (!signer) {
      signer =
        firstMatch(chunk, /(?:Signed\s*by|Signatory|Authorized\s*(?:Signatory|Representative|Signature)|Accepted\s+(?:and\s+)?Agreed)\s*:?\s*([A-Za-z][A-Za-z\s.'-]{2,50})/i)
        ?? firstMatch(chunk, /\/s\/\s*([A-Za-z][A-Za-z\s.'-]{2,50})/i)
        ?? (/(?:DocuSign|Adobe\s*Sign|Docusigned)/i.test(chunk) ? 'DocuSign' : null)
    }

    if (!signedDate) {
      signedDate =
        extractLabeledFlexibleDate(chunk, ['Date Signed', 'Signed Date', 'Execution Date', 'Signature Date', 'Date'])
        ?? firstMatch(chunk, /(?:Signed|Executed)\s*(?:on|:)?\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})/i)
    }
  }

  if (customerBlockFound && !signer) {
    signer = 'Customer signature block present'
  }

  return {
    signerName: signer ? cleanExtracted(signer, 50) : null,
    signedDate: signedDate ? (parseFlexibleDate(signedDate) ?? signedDate) : null,
    customerBlockFound,
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
  const pageTexts = options?.pageTexts
  const dates = extractDates(text, pageTexts)
  const poNumber = firstMatch(text, /\bPO\s*(?:#|Number|No\.?)?\s*:?\s*([A-Z0-9][\w-]{2,30})/i)
    ?? firstMatch(text, /\bPurchase\s*Order\s*(?:#|Number|No\.?)?\s*:?\s*([A-Z0-9][\w-]{2,30})/i)

  const quoteNumber = extractQuoteNumber(text, options?.titleHint, options?.quoteNumberHint, pageTexts)
  const signature = options?.docKind === 'quote'
    ? extractSignature(text, pageTexts)
    : { signerName: null, signedDate: null, customerBlockFound: false }

  const product = options?.docKind === 'po'
    ? extractPoProduct(text, options?.productHint, pageTexts)
    : extractProduct(text, options?.productHint)

  const notes: string[] = []
  if (options?.docKind === 'po' && detectPoNumberOnly(text, poNumber)) {
    notes.push('Document appears to contain only a PO number — no pricing, product, or terms visible in extracted text.')
  }
  if (options?.docKind === 'po' && !product) {
    notes.push('No product name found on PO — line items may be generic or missing.')
  }
  if (signature.customerBlockFound) {
    notes.push('Customer signature block detected (For Customer).')
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
    quantity: extractQuantity(text, pageTexts, notes, options?.quantityHint, options?.expectedTotal),
    renewalDate: dates.renewal,
    expiryDate: dates.expiry,
    supplierName: extractSupplier(text, options?.mirrorSupplier, pageTexts),
    paymentTerms: extractPaymentTerms(text, pageTexts, options?.docKind),
    quoteNumber,
    poNumber,
    totalAmount: extractTotal(text, options?.expectedTotal),
    term: extractTerm(text, options?.termHint, pageTexts),
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
    termHint?: string | number | null
    quoteNumberHint?: string | null
    quantityHint?: string | number | null
    renewalDateHint?: string | null
    expiryDateHint?: string | null
  },
): ParsedDocument {
  const pageTexts = meta.pageTexts ?? []
  const fields = extractFieldsFromText(text, {
    docKind: meta.docKind,
    productHint: meta.productHint,
    expectedTotal: meta.expectedTotal,
    mirrorSupplier: meta.mirrorSupplier,
    termHint: meta.termHint,
    titleHint: meta.title,
    quoteNumberHint: meta.quoteNumberHint,
    quantityHint: meta.quantityHint,
    renewalDateHint: meta.renewalDateHint,
    expiryDateHint: meta.expiryDateHint,
    pageTexts,
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
  // Pure numbers must match exactly — avoid "1" matching inside "74136".
  if (/^\d+$/.test(na) && /^\d+$/.test(nb)) return false
  return na.includes(nb) || nb.includes(na)
}

export function termDurationMonths(value: string | null | undefined): number | null {
  if (!value?.trim()) return null
  const v = value.trim()
  const months = v.match(/(\d+)\s*(?:month|months|mo)\b/i)
  if (months) return parseInt(months[1], 10)
  const years = v.match(/(\d+(?:\.\d+)?)\s*(?:year|years|yr)\b/i)
  if (years) return Math.round(parseFloat(years[1]) * 12)
  const bare = v.match(/^(\d+)$/)
  if (bare) return parseInt(bare[1], 10)
  return null
}

export function termsAlign(a: string | null | undefined, b: string | null | undefined): boolean {
  const ma = termDurationMonths(a)
  const mb = termDurationMonths(b)
  if (ma != null && mb != null) return ma === mb
  return valuesAlign(a, b)
}

export function formatFieldValue(value: string | null | undefined): string {
  return value?.trim() ? value.trim() : '—'
}
