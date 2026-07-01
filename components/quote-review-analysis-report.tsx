"use client"

import { theme } from "@/lib/theme"
import {
  analysisSummaryLabel,
  severityLabel,
  type AnalysisFlag,
  type AnalysisSeverity,
  type QuoteReviewAnalysis,
} from "@/lib/quote-review-analysis"
import { formatUsDate } from "@/lib/sf-field-format"
import { ExternalLink } from "lucide-react"

type OppSummary = {
  name: string
  accountName: string | null
  product: string | null
  winType: string | null
  supportPlan: string | null
  userCount: number | null
  renewalDate: string | null
  expiryDate: string | null
  primaryContactDisplay: string
}

type DocLinks = {
  unsignedQuoteUrl: string
  signedQuoteUrl: string
  purchaseOrderUrl: string
}

const COMPARE_CHECKLIST = [
  "Quote number matches",
  "Pricing / ARR matches",
  "Term length matches",
  "Product & quantity match",
  "No altered clauses",
]

function SeverityBadge({ severity }: { severity: AnalysisSeverity }) {
  const styles: Record<AnalysisSeverity, string> = {
    pass: "bg-green-100 text-green-800 border-green-200",
    warn: "bg-amber-100 text-amber-800 border-amber-200",
    fail: "bg-red-100 text-red-800 border-red-200",
    pending: "bg-gray-100 text-gray-700 border-gray-200",
  }
  return (
    <span className={`inline-flex text-xs font-semibold px-2 py-0.5 rounded border ${styles[severity]}`}>
      {severityLabel(severity)}
    </span>
  )
}

function FlagTable({ flags }: { flags: AnalysisFlag[] }) {
  if (flags.length === 0) return null
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left font-semibold text-gray-600 px-4 py-2.5 w-[28%]">Check</th>
            <th className="text-left font-semibold text-gray-600 px-4 py-2.5 w-[12%]">Status</th>
            <th className="text-left font-semibold text-gray-600 px-4 py-2.5">Finding</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {flags.map((flag) => (
            <tr key={flag.id} className="bg-white">
              <td className="px-4 py-3 font-medium text-gray-900 align-top">{flag.label}</td>
              <td className="px-4 py-3 align-top">
                <SeverityBadge severity={flag.severity} />
              </td>
              <td className="px-4 py-3 text-gray-600 align-top">{flag.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DocCompareColumn({
  title,
  subtitle,
  linkLabel,
  href,
  status,
}: {
  title: string
  subtitle: string
  linkLabel: string
  href: string
  status: AnalysisSeverity
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</p>
        <p className="text-sm font-medium text-gray-900 mt-0.5">{subtitle}</p>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-1 text-sm mt-1.5 ${theme.accent} hover:underline cursor-pointer`}
        >
          {linkLabel}
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <span className="text-gray-500">Link status</span>
        <SeverityBadge severity={status} />
      </div>
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Verify on PDF</p>
        <ul className="text-xs text-gray-600 space-y-1">
          {COMPARE_CHECKLIST.map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span className="text-gray-300">☐</span>
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function SfReferenceTable({ opp }: { opp: OppSummary }) {
  const rows = [
    { field: "Win Type", value: opp.winType ?? "—" },
    { field: "Product", value: opp.product ?? "—" },
    { field: "Support plan", value: opp.supportPlan ?? "—" },
    { field: "Users / seats", value: opp.userCount != null ? String(opp.userCount) : "—" },
    { field: "Renewal date", value: opp.renewalDate ? formatUsDate(opp.renewalDate) : "—" },
    { field: "Expiry date", value: opp.expiryDate ? formatUsDate(opp.expiryDate) : "—" },
    { field: "Primary contact", value: opp.primaryContactDisplay },
  ]
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left font-semibold text-gray-600 px-4 py-2.5 w-[40%]">Opportunity field</th>
            <th className="text-left font-semibold text-gray-600 px-4 py-2.5">Value from Salesforce</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {rows.map((row) => (
            <tr key={row.field}>
              <td className="px-4 py-2.5 font-medium text-gray-900">{row.field}</td>
              <td className="px-4 py-2.5 text-gray-800">{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function QuoteReviewAnalysisReport({
  analysis,
  opp,
  docs,
}: {
  analysis: QuoteReviewAnalysis
  opp: OppSummary
  docs: DocLinks
}) {
  const byCategory = (cat: AnalysisFlag["category"]) =>
    analysis.flags.filter((f) => f.category === cat)

  const unsignedStatus = byCategory("documents").find((f) => f.id.startsWith("unsigned"))?.severity ?? "pending"
  const signedStatus = byCategory("documents").find((f) => f.id.startsWith("signed"))?.severity ?? "pending"

  const verdictClass =
    analysis.summary === "accept"
      ? "border-l-green-500 bg-green-50"
      : analysis.summary === "review"
        ? "border-l-amber-500 bg-amber-50"
        : "border-l-red-500 bg-red-50"

  return (
    <div className="space-y-8">
      <div className="border-b border-gray-200 pb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Signed Quote Review Report</p>
        <h2 className="text-xl font-bold text-gray-900 mt-1">{opp.name}</h2>
        <p className="text-sm text-gray-500 mt-1">{opp.accountName ?? "—"} · {opp.product ?? "—"}</p>
      </div>

      <div className={`border-l-4 rounded-r-lg px-5 py-4 ${verdictClass}`}>
        <p className="text-xs font-bold uppercase tracking-wide text-gray-600">
          {analysisSummaryLabel(analysis.summary)}
        </p>
        <p className="text-base font-medium text-gray-900 mt-1">{analysis.recommendation}</p>
      </div>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Quote comparison</h3>
          <p className="text-xs text-gray-500 mt-1">Open both PDFs and confirm the signed quote matches the unsigned baseline.</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <DocCompareColumn
            title="Baseline"
            subtitle="Unsigned quote"
            linkLabel="Open unsigned quote"
            href={docs.unsignedQuoteUrl}
            status={unsignedStatus}
          />
          <DocCompareColumn
            title="Customer signed"
            subtitle="Signed quote"
            linkLabel="Open signed quote"
            href={docs.signedQuoteUrl}
            status={signedStatus}
          />
        </div>
        <FlagTable flags={byCategory("manual").filter((f) => f.id === "pdf-diff")} />
      </section>

      {(docs.purchaseOrderUrl || byCategory("documents").some((f) => f.id.startsWith("po"))) && (
        <section className="space-y-3">
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Purchase order</h3>
          {docs.purchaseOrderUrl ? (
            <a
              href={docs.purchaseOrderUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1 text-sm ${theme.accent} hover:underline cursor-pointer`}
            >
              Open purchase order
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          ) : null}
          <FlagTable
            flags={[
              ...byCategory("documents").filter((f) => f.id.startsWith("po")),
              ...byCategory("manual").filter((f) => f.id === "po-audit"),
            ]}
          />
        </section>
      )}

      <section className="space-y-3">
        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Entry gate</h3>
        <FlagTable flags={byCategory("gate")} />
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Salesforce reference</h3>
          <p className="text-xs text-gray-500 mt-1">
            Values pulled from the opportunity for the provisioning template. When you review the PDFs, confirm these match the signed quote — this is not an automated check yet.
          </p>
        </div>
        <SfReferenceTable opp={opp} />
        <FlagTable flags={byCategory("salesforce")} />
      </section>
    </div>
  )
}
