import helpCenters from '@/data/product-help-centers.json'

export type ProductHelpCenter = {
  name: string
  bu: string
  url: string
  /** Salesforce / quote product names that map to this queue */
  aliases?: string[]
}

const ENTRIES = helpCenters as ProductHelpCenter[]

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** Match SF product name to Product Help Centers sheet (case/spacing insensitive). */
export function findHelpCenterForProduct(product: string | null | undefined): ProductHelpCenter | null {
  if (!product?.trim()) return null
  const needle = normalize(product)

  const exact = ENTRIES.find((e) => normalize(e.name) === needle)
  if (exact) return exact

  const aliasMatch = ENTRIES.find((e) =>
    e.aliases?.some((alias) => normalize(alias) === needle),
  )
  if (aliasMatch) return aliasMatch

  const contains = ENTRIES.find(
    (e) => normalize(e.name).includes(needle) || needle.includes(normalize(e.name)),
  )
  if (contains) return contains

  // Lyris (AEM) on SF / quotes → List Manager queue (LM), not HQ
  if (needle.includes('lyris') && (needle.includes('aem') || needle.includes('listmanager'))) {
    return ENTRIES.find((e) => normalize(e.name) === 'aureaaemlyrislm') ?? null
  }

  return null
}

export function formatFulfillmentLine(center: ProductHelpCenter | null, product: string | null): string {
  if (!center) {
    return `Fulfillment Action Required: Please open a provisioning ticket in the correct support queue for ${product ?? 'this product'} — look up Product Help Centers.`
  }
  return `Fulfillment Action Required: Please open a provisioning ticket in the following support queue: ${center.name} — ${center.url}`
}
