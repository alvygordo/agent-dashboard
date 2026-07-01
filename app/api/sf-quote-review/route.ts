import { NextRequest, NextResponse } from 'next/server'
import jsforce, { type Connection } from 'jsforce'
import {
  extractUrlFromSfField,
  formatContactLine,
  toLightningBaseUrl,
} from '@/lib/sf-field-format'

const VALID_WIN_TYPES = new Set(['Quote Signed', 'PO Received'])

type OppRow = {
  Id: string
  Name: string
  StageName?: string
  CloseDate?: string
  Win_Type__c?: string | null
  Signed_Quote__c?: string | null
  Purchase_Order_Link__c?: string | null
  NetSuite_Sub_Link__c?: string | null
  Current_ARR__c?: number | null
  Current_Term__c?: string | null
  Current_Billing_Term__c?: string | null
  Product__c?: string | null
  Renewal_Date__c?: string | null
  Current_Subscription_End_Date__c?: string | null
  CurrentContractHasAutoRenewalClause__c?: string | null
  Account?: { Name?: string } | null
  Owner?: { Name?: string } | null
}

const BASE_FIELDS = [
  'Id', 'Name', 'StageName', 'CloseDate',
  'Account.Name', 'Owner.Name',
].join(', ')

const QUOTE_REVIEW_FIELDS = [
  'Win_Type__c',
  'Signed_Quote__c',
  'Purchase_Order_Link__c',
  'NetSuite_Sub_Link__c',
  'Current_ARR__c',
  'Current_Term__c',
  'Current_Billing_Term__c',
  'Product__c',
  'Renewal_Date__c',
  'Current_Subscription_End_Date__c',
  'CurrentContractHasAutoRenewalClause__c',
]

function sfLoginUrl() {
  return process.env.NEXT_PUBLIC_ENV === 'production'
    ? 'https://login.salesforce.com'
    : 'https://test.salesforce.com'
}

function instanceUrlFallback() {
  return process.env.SALESFORCE_INSTANCE_URL
    ?? (process.env.NEXT_PUBLIC_ENV === 'production'
      ? 'https://trilogy-sales.lightning.force.com'
      : 'https://trilogy-sales--full.sandbox.lightning.force.com')
}

async function connect() {
  const username = process.env.SALESFORCE_USERNAME
  const password = process.env.SALESFORCE_PASSWORD
  const token = process.env.SALESFORCE_TOKEN
  if (!username || !password || !token) {
    throw new Error('SF credentials not configured')
  }
  const conn = new jsforce.Connection({ loginUrl: sfLoginUrl() })
  await conn.login(username, password + token)
  return conn
}

function lightningBaseFromConn(conn: Connection): string {
  if (conn.instanceUrl) {
    return toLightningBaseUrl(conn.instanceUrl)
  }
  return instanceUrlFallback().replace(/\/lightning.*$/, '')
}

async function queryOpp(conn: Connection, where: string): Promise<OppRow[]> {
  const fullSelect = `SELECT ${BASE_FIELDS}, ${QUOTE_REVIEW_FIELDS.join(', ')} FROM Opportunity ${where}`
  try {
    const result = await conn.query<OppRow>(fullSelect)
    return result.records
  } catch {
    const result = await conn.query<OppRow>(`SELECT ${BASE_FIELDS} FROM Opportunity ${where}`)
    return result.records
  }
}

async function primaryContact(conn: Connection, oppId: string) {
  type RoleRow = { Contact?: { Name?: string; Email?: string } | null }
  try {
    const result = await conn.query<RoleRow>(
      `SELECT Contact.Name, Contact.Email FROM OpportunityContactRole
       WHERE OpportunityId = '${oppId.replace(/'/g, "\\'")}' AND IsPrimary = true
       LIMIT 1`,
    )
    const contact = result.records[0]?.Contact
    if (!contact?.Name) return null
    return {
      name: contact.Name,
      email: contact.Email ?? null,
    }
  } catch {
    return null
  }
}

function mapOpp(
  opp: OppRow,
  primary: { name: string; email: string | null } | null,
  lightningBase: string,
) {
  const winType = opp.Win_Type__c ?? null
  return {
    id: opp.Id,
    name: opp.Name,
    stage: opp.StageName ?? null,
    closeDate: opp.CloseDate ?? null,
    accountName: opp.Account?.Name ?? null,
    ownerName: opp.Owner?.Name ?? null,
    winType,
    winTypeValid: winType ? VALID_WIN_TYPES.has(winType) : false,
    signedQuoteUrl: extractUrlFromSfField(opp.Signed_Quote__c),
    purchaseOrderLink: extractUrlFromSfField(opp.Purchase_Order_Link__c),
    netSuiteSubLink: extractUrlFromSfField(opp.NetSuite_Sub_Link__c),
    product: opp.Product__c ?? null,
    currentTerm: opp.Current_Term__c ?? opp.Current_Billing_Term__c ?? null,
    currentArr: opp.Current_ARR__c ?? null,
    renewalDate: opp.Renewal_Date__c ?? null,
    expiryDate: opp.Current_Subscription_End_Date__c ?? null,
    autoRenewal: opp.CurrentContractHasAutoRenewalClause__c ?? null,
    primaryContact: primary
      ? { name: primary.name, email: primary.email, display: formatContactLine(primary) }
      : null,
    oppUrl: `${lightningBase}/lightning/r/Opportunity/${opp.Id}/view`,
  }
}

export async function GET(req: NextRequest) {
  const email = req.cookies.get('agent_dashboard_user')?.value
  if (!email) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const oppId = req.nextUrl.searchParams.get('id')?.trim()
  const oppName = req.nextUrl.searchParams.get('opp')?.trim()
  if (!oppId && !oppName) {
    return NextResponse.json({ error: 'Provide opp (name) or id' }, { status: 400 })
  }

  try {
    const conn = await connect()
    const lightningBase = lightningBaseFromConn(conn)

    let records: OppRow[]
    if (oppId) {
      const safeId = oppId.replace(/'/g, "\\'")
      records = await queryOpp(conn, `WHERE Id = '${safeId}' LIMIT 1`)
    } else {
      const safeName = oppName!.replace(/'/g, "\\'")
      records = await queryOpp(
        conn,
        `WHERE Name LIKE '%${safeName}%' ORDER BY LastModifiedDate DESC LIMIT 10`,
      )
    }

    if (records.length === 0) {
      return NextResponse.json({ error: 'No matching opportunity found' }, { status: 404 })
    }

    const mapped = await Promise.all(
      records.map(async (opp) => mapOpp(opp, await primaryContact(conn, opp.Id), lightningBase)),
    )

    return NextResponse.json({
      opportunities: mapped,
      single: mapped.length === 1 ? mapped[0] : null,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
