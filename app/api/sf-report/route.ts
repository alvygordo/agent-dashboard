import { NextRequest, NextResponse } from 'next/server'
import jsforce from 'jsforce'

type SFCell = { label: string; value: unknown }
type SFRow  = { dataCells: SFCell[] }

export async function GET(req: NextRequest) {
  const reportId = req.nextUrl.searchParams.get('id')
  if (!reportId) return NextResponse.json({ error: 'id param required' }, { status: 400 })

  const username    = process.env.SALESFORCE_USERNAME
  const password    = process.env.SALESFORCE_PASSWORD
  const token       = process.env.SALESFORCE_TOKEN
  const instanceUrl = process.env.SALESFORCE_INSTANCE_URL ?? 'https://trilogy-sales.lightning.force.com'

  if (!username || !password || !token) {
    return NextResponse.json({ error: 'SF credentials not configured' }, { status: 500 })
  }

  try {
    const conn = new jsforce.Connection({ loginUrl: 'https://login.salesforce.com' })
    await conn.login(username, password + token)

    // SF Reports REST API — GET runs the saved report without needing metadata in body
    const result = await (conn as unknown as {
      request: (opts: { method: string; url: string }) => Promise<unknown>
    }).request({
      method: 'GET',
      url:    `/services/data/v59.0/analytics/reports/${reportId}?includeDetails=true`,
    }) as {
      reportMetadata:         { detailColumns: string[]; reportFormat: string }
      factMap:                Record<string, { rows?: SFRow[] }>
      reportExtendedMetadata: { detailColumnInfo: Record<string, { label: string; dataType: string }> }
    }

    const { reportMetadata, factMap, reportExtendedMetadata } = result
    const columnInfo = reportExtendedMetadata?.detailColumnInfo ?? {}
    const colKeys    = reportMetadata.detailColumns ?? []
    const headers    = colKeys.map(k => columnInfo[k]?.label ?? k)

    // Tabular reports: factMap["T!T"]
    const factKey  = Object.keys(factMap).find(k => factMap[k]?.rows) ?? 'T!T'
    const rows     = (factMap[factKey]?.rows ?? []).map((row: SFRow) =>
      row.dataCells.map((cell: SFCell) => {
        if (cell.value && typeof cell.value === 'object' && 'url' in (cell.value as object)) {
          return { label: cell.label, url: `${instanceUrl}/${(cell.value as { url: string }).url}` }
        }
        return { label: cell.label ?? '', url: null }
      })
    )

    return NextResponse.json({ headers, rows, total: rows.length })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
