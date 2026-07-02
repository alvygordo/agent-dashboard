import { NextRequest, NextResponse } from 'next/server'
import jsforce, { type Connection } from 'jsforce'
import {
  extractUrlFromSfField,
  formatContactLine,
  parseSupportPlanFromLines,
  parseUserCountFromLines,
  toLightningBaseUrl,
} from '@/lib/sf-field-format'
import { resolveQuoteReviewMode } from '@/lib/quote-review-mode'
import { fetchPrimaryQuoteInfo } from '@/lib/sf-primary-quote'

const VALID_WIN_TYPES = new Set(['Quote Signed', 'PO Received'])

type OppRow = Record<string, unknown> & {
  Id: string
  Name: string
  StageName?: string
  CloseDate?: string
  Account?: { Name?: string } | null
  Owner?: { Name?: string } | null
}

const BASE_FIELDS = [
  'Id', 'Name', 'StageName', 'CloseDate',
  'Account.Name', 'Owner.Name',
]

const QUOTE_REVIEW_FIELDS = [
  'Win_Type__c',
  'Signed_Quote__c',
  'Purchase_Order__c',
  'Purchase_Order_Link__c',
  'NetSuite_Sub_Link__c',
  'Current_ARR__c',
  'Current_Term__c',
  'Current_Billing_Term__c',
  'Product__c',
  'Renewal_Date__c',
  'Current_Subscription_End_Date__c',
  'CurrentContractHasAutoRenewalClause__c',
  'SBQQ__PrimaryQuote__c',
]

const OPTIONAL_OPP_FIELDS = [
  'Support_Plan__c',
  'Success_Plan__c',
  'Service_Level__c',
  'Current_Support_Plan__c',
  'Entitlement__c',
  'Support_Tier__c',
  'Number_of_Users__c',
  'User_Count__c',
  'Total_Users__c',
  'Seat_Count__c',
  'Current_User_Count__c',
  'Licensed_Users__c',
]

const SUPPORT_FIELD_KEYS = [
  'Support_Plan__c',
  'Success_Plan__c',
  'Service_Level__c',
  'Current_Support_Plan__c',
  'Entitlement__c',
  'Support_Tier__c',
]

const PO_REQUIREMENT_FIELD_KEYS = [
  'Purchase_Order__c',
]

const USER_COUNT_FIELD_KEYS = [
  'Number_of_Users__c',
  'User_Count__c',
  'Total_Users__c',
  'Seat_Count__c',
  'Current_User_Count__c',
  'Licensed_Users__c',
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
  const fieldSets = [
    [...BASE_FIELDS, ...QUOTE_REVIEW_FIELDS, ...OPTIONAL_OPP_FIELDS],
    [...BASE_FIELDS, ...QUOTE_REVIEW_FIELDS],
    BASE_FIELDS,
  ]
  for (const fields of fieldSets) {
    try {
      const result = await conn.query<OppRow>(
        `SELECT ${fields.join(', ')} FROM Opportunity ${where}`,
      )
      return result.records
    } catch {
      // try fewer fields
    }
  }
  return []
}

function firstFieldValue(opp: OppRow, keys: string[]): unknown {
  for (const key of keys) {
    const val = opp[key]
    if (val != null && String(val).trim() !== '') return val
  }
  return null
}

type QuoteLineRow = {
  SBQQ__ProductName__c?: string
  SBQQ__Quantity__c?: number | null
}

async function fetchQuoteLines(conn: Connection, quoteId: string) {
  try {
    const safeId = quoteId.replace(/'/g, "\\'")
    const result = await conn.query<QuoteLineRow>(
      `SELECT SBQQ__ProductName__c, SBQQ__Quantity__c
       FROM SBQQ__QuoteLine__c
       WHERE SBQQ__Quote__c = '${safeId}'
       AND (SBQQ__Bundled__c = false OR SBQQ__Bundled__c = null)
       ORDER BY SBQQ__Number__c ASC`,
    )
    return result.records.map((r) => ({
      productName: r.SBQQ__ProductName__c ?? '',
      quantity: r.SBQQ__Quantity__c ?? null,
    })).filter((l) => l.productName)
  } catch {
    return []
  }
}

async function bestContact(conn: Connection, oppId: string) {
  type RoleRow = {
    Contact?: { Name?: string; Email?: string } | null
    IsPrimary?: boolean
  }
  try {
    const result = await conn.query<RoleRow>(
      `SELECT Contact.Name, Contact.Email, IsPrimary
       FROM OpportunityContactRole
       WHERE OpportunityId = '${oppId.replace(/'/g, "\\'")}'
       ORDER BY IsPrimary DESC, CreatedDate ASC
       LIMIT 10`,
    )
    const roles = result.records.filter((r) => r.Contact?.Name)
    if (roles.length === 0) return null

    const withEmail = roles.find((r) => r.Contact?.Email?.trim())
    const pick = withEmail ?? roles[0]
    return {
      name: pick.Contact!.Name!,
      email: pick.Contact?.Email?.trim() ?? null,
      isPrimary: pick.IsPrimary === true,
    }
  } catch {
    return null
  }
}

async function mapOpp(
  conn: Connection,
  opp: OppRow,
  lightningBase: string,
) {
  const winType = (opp.Win_Type__c as string | null) ?? null
  const product = (opp.Product__c as string | null) ?? null
  const primaryQuoteId = (opp.SBQQ__PrimaryQuote__c as string | null) ?? null

  const quoteLines = primaryQuoteId ? await fetchQuoteLines(conn, primaryQuoteId) : []
  const supportFromQuote = parseSupportPlanFromLines(quoteLines)
  const usersFromQuote = parseUserCountFromLines(quoteLines, product)

  const supportFromOpp = firstFieldValue(opp, SUPPORT_FIELD_KEYS)
  const usersFromOpp = firstFieldValue(opp, USER_COUNT_FIELD_KEYS)

  const contact = await bestContact(conn, opp.Id)

  const primaryQuote = primaryQuoteId
    ? await fetchPrimaryQuoteInfo(conn, primaryQuoteId, lightningBase)
    : null

  const signedQuoteUrl = extractUrlFromSfField(opp.Signed_Quote__c)
  const purchaseOrderLink = extractUrlFromSfField(opp.Purchase_Order_Link__c)
  const purchaseOrderRequirement = firstFieldValue(opp, PO_REQUIREMENT_FIELD_KEYS)

  const reviewPlan = resolveQuoteReviewMode({
    winType,
    primaryQuoteStatus: primaryQuote?.status ?? null,
    signedQuoteUrl,
    purchaseOrderLink,
    purchaseOrderRequirement:
      purchaseOrderRequirement != null ? String(purchaseOrderRequirement) : null,
  })

  return {
    id: opp.Id,
    name: opp.Name,
    stage: (opp.StageName as string | null) ?? null,
    closeDate: (opp.CloseDate as string | null) ?? null,
    accountName: opp.Account?.Name ?? null,
    ownerName: opp.Owner?.Name ?? null,
    winType,
    winTypeValid: winType ? VALID_WIN_TYPES.has(winType) : false,
    signedQuoteUrl,
    purchaseOrderLink,
    purchaseOrderRequirement:
      purchaseOrderRequirement != null ? String(purchaseOrderRequirement) : null,
    comparePo: reviewPlan.comparePo,
    primaryQuoteId,
    primaryQuoteStatus: primaryQuote?.status ?? null,
    primaryQuoteNumber: primaryQuote?.quoteNumber ?? null,
    primaryQuoteUrl: primaryQuote?.quoteUrl ?? null,
    unsignedQuoteAttachmentUrl: primaryQuote?.unsignedAttachmentUrl ?? null,
    unsignedQuoteAttachmentTitle: primaryQuote?.unsignedAttachmentTitle ?? null,
    reviewMode: reviewPlan.mode,
    reviewModeTitle: reviewPlan.title,
    reviewModeDescription: reviewPlan.description,
    netSuiteSubLink: extractUrlFromSfField(opp.NetSuite_Sub_Link__c),
    product,
    currentTerm: (opp.Current_Term__c ?? opp.Current_Billing_Term__c) ?? null,
    currentArr: (opp.Current_ARR__c as number | null) ?? null,
    renewalDate: (opp.Renewal_Date__c as string | null) ?? null,
    expiryDate: (opp.Current_Subscription_End_Date__c as string | null) ?? null,
    autoRenewal: (opp.CurrentContractHasAutoRenewalClause__c as string | null) ?? null,
    supportPlan: supportFromQuote ?? (supportFromOpp != null ? String(supportFromOpp) : null),
    userCount: usersFromQuote ?? (usersFromOpp != null ? Number(usersFromOpp) : null),
    primaryContact: contact
      ? {
          name: contact.name,
          email: contact.email,
          isPrimary: contact.isPrimary,
          display: formatContactLine({ name: contact.name, email: contact.email }),
        }
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
      records.map((opp) => mapOpp(conn, opp, lightningBase)),
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
