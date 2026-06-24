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

    // Collect all detail rows across all factMap keys (handles both tabular and summary reports)
    const allRows: SFRow[] = []
    for (const key of Object.keys(factMap)) {
      const entry = factMap[key]
      if (entry?.rows?.length) allRows.push(...entry.rows)
    }

    const oppNameColIdx  = headers.findIndex(h => h.toLowerCase() === 'opportunity name')
    const lastNameColIdx = headers.findIndex(h => h.toLowerCase() === 'last name')
    const emailColIdx    = headers.findIndex(h => h.toLowerCase() === 'email')

    // Resolve Opportunity URLs via SOQL (summary reports return name as plain string, no URL)
    let oppNameToUrl: Record<string, string> = {}
    if (oppNameColIdx >= 0) {
      const names = [...new Set(
        allRows.map(r => r.dataCells[oppNameColIdx]?.label).filter((n): n is string => !!n && n !== '-')
      )]
      if (names.length) {
        const escaped = names.map(n => `'${n.replace(/'/g, "\\'")}'`).join(', ')
        type OppRecord = { Id: string; Name: string }
        const oppResult = await conn.query<OppRecord>(`SELECT Id, Name FROM Opportunity WHERE Name IN (${escaped}) LIMIT 500`)
        for (const opp of oppResult.records) {
          oppNameToUrl[opp.Name] = `${instanceUrl}/lightning/r/Opportunity/${opp.Id}/view`
        }
      }
    }

    // Resolve Contact URLs via email SOQL (Last Name field is plain text, no URL in SF Analytics API)
    let emailToContactUrl: Record<string, string> = {}
    if (lastNameColIdx >= 0 && emailColIdx >= 0) {
      const emails = [...new Set(
        allRows.map(r => r.dataCells[emailColIdx]?.label).filter((e): e is string => !!e && e !== '-' && e.includes('@'))
      )]
      if (emails.length) {
        const escaped = emails.map(e => `'${e.replace(/'/g, "\\'")}'`).join(', ')
        type ContactRecord = { Id: string; Email: string }
        const contactResult = await conn.query<ContactRecord>(`SELECT Id, Email FROM Contact WHERE Email IN (${escaped}) LIMIT 500`)
        for (const c of contactResult.records) {
          emailToContactUrl[c.Email] = `${instanceUrl}/lightning/r/Contact/${c.Id}/view`
        }
      }
    }

    const rows = allRows.map((row: SFRow) => {
      const rowEmail = emailColIdx >= 0 ? row.dataCells[emailColIdx]?.label : null
      return row.dataCells.map((cell: SFCell, idx: number) => {
        if (cell.value && typeof cell.value === 'object' && 'url' in (cell.value as object)) {
          const rawUrl = (cell.value as { url: string }).url
          if (rawUrl) {
            const fullUrl = rawUrl.startsWith('http') ? rawUrl : `${instanceUrl}${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`
            return { label: cell.label, url: fullUrl }
          }
        }
        if (idx === oppNameColIdx && cell.label && oppNameToUrl[cell.label]) {
          return { label: cell.label, url: oppNameToUrl[cell.label] }
        }
        if (idx === lastNameColIdx && rowEmail && emailToContactUrl[rowEmail]) {
          return { label: cell.label, url: emailToContactUrl[rowEmail] }
        }
        return { label: cell.label ?? '', url: null }
      })
    })

    return NextResponse.json({ headers, rows, total: rows.length })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
