import helpCenters from '@/data/product-help-centers.json'

export type ProductHelpCenter = {
  name: string
  bu: string
  url: string
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

  const contains = ENTRIES.find(
    (e) => normalize(e.name).includes(needle) || needle.includes(normalize(e.name)),
  )
  return contains ?? null
}

export function formatFulfillmentLine(center: ProductHelpCenter | null, product: string | null): string {
  if (!center) {
    return `Fulfillment Action Required: Please open a provisioning ticket in the correct support queue for ${product ?? 'this product'} — look up Product Help Centers.`
  }
  return `Fulfillment Action Required: Please open a provisioning ticket in the following support queue: ${center.name} — ${center.url}`
}
