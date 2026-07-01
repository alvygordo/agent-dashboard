/** Coerce SF field values (sometimes numbers) to a trimmed string. */
function asText(value: unknown): string {
  if (value == null) return ''
  return String(value).trim()
}

/** Pull a plain URL from SF rich-text / hyperlink fields. */
export function extractUrlFromSfField(value: unknown): string | null {
  const raw = asText(value)
  if (!raw) return null
  const hrefMatch = raw.match(/href=["']([^"']+)["']/i)
  if (hrefMatch) return hrefMatch[1]
  if (/^https?:\/\//i.test(raw)) return raw
  const stripped = raw.replace(/<[^>]+>/g, '').trim()
  return stripped || null
}

/** my.salesforce.com → lightning.force.com for deep links. */
export function toLightningBaseUrl(instanceUrl: string): string {
  return instanceUrl
    .replace('.sandbox.my.salesforce.com', '.sandbox.lightning.force.com')
    .replace('.my.salesforce.com', '.lightning.force.com')
    .replace(/\/$/, '')
}

/** e.g. "12" → "12 months"; leaves "12 Months" / "3 Years" unchanged. */
export function formatTermLabel(term: unknown): string {
  const trimmed = asText(term)
  if (!trimmed) return '[Insert Contract Terms - e.g., 12 Months / 3 Years]'
  if (/month|year|quarter/i.test(trimmed)) return trimmed
  if (/^\d+$/.test(trimmed)) return `${trimmed} months`
  return trimmed
}

export function formatTermMonthsOnly(term: unknown): string {
  const trimmed = asText(term)
  if (!trimmed) return '[Insert Number of Months]'
  if (/month/i.test(trimmed)) return trimmed.replace(/\s*months?\s*/i, '').trim() || trimmed
  if (/year/i.test(trimmed)) return trimmed
  return trimmed
}

/** ISO date → MM/DD/YYYY for provisioning tickets. */
export function formatUsDate(iso: unknown): string {
  const raw = asText(iso)
  if (!raw) return '[Insert MM/DD/YYYY]'
  const base = raw.includes('T') ? raw : `${raw}T12:00:00`
  const d = new Date(base)
  if (Number.isNaN(d.getTime())) return raw
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${mm}/${dd}/${d.getUTCFullYear()}`
}

/** Hide sandbox masked emails (*.data domains). */
export function formatContactLine(contact: { name: string; email: string | null } | null): string {
  if (!contact?.name) return '[Insert Primary Contact name and email]'
  const email = asText(contact.email)
  const isSandboxMask = !email || /\.data$/i.test(email.split('@')[1] ?? '')
  if (isSandboxMask) return `${contact.name} [Insert email address]`
  return `${contact.name} (${email})`
}
