/** Pull a plain URL from SF rich-text / hyperlink fields. */
export function extractUrlFromSfField(value: string | null | undefined): string | null {
  if (!value?.trim()) return null
  const hrefMatch = value.match(/href=["']([^"']+)["']/i)
  if (hrefMatch) return hrefMatch[1]
  const trimmed = value.trim()
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  const stripped = trimmed.replace(/<[^>]+>/g, '').trim()
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
export function formatTermLabel(term: string | null | undefined): string {
  if (!term?.trim()) return '[Insert Contract Terms - e.g., 12 Months / 3 Years]'
  const trimmed = term.trim()
  if (/month|year|quarter/i.test(trimmed)) return trimmed
  if (/^\d+$/.test(trimmed)) return `${trimmed} months`
  return trimmed
}

export function formatTermMonthsOnly(term: string | null | undefined): string {
  if (!term?.trim()) return '[Insert Number of Months]'
  const trimmed = term.trim()
  if (/month/i.test(trimmed)) return trimmed.replace(/\s*months?\s*/i, '').trim() || trimmed
  if (/year/i.test(trimmed)) return trimmed
  return trimmed
}

/** ISO date → MM/DD/YYYY for provisioning tickets. */
export function formatUsDate(iso: string | null | undefined): string {
  if (!iso?.trim()) return '[Insert MM/DD/YYYY]'
  const base = iso.includes('T') ? iso : `${iso}T12:00:00`
  const d = new Date(base)
  if (Number.isNaN(d.getTime())) return iso
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${mm}/${dd}/${d.getUTCFullYear()}`
}

/** Hide sandbox masked emails (*.data domains). */
export function formatContactLine(contact: { name: string; email: string | null } | null): string {
  if (!contact?.name) return '[Insert Primary Contact name and email]'
  const email = contact.email?.trim()
  const isSandboxMask = !email || /\.data$/i.test(email.split('@')[1] ?? '')
  if (isSandboxMask) return `${contact.name} [Insert email address]`
  return `${contact.name} (${email})`
}
