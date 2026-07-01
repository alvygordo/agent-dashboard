"use client"

import { theme } from "@/lib/theme"
import {
  analysisSummaryLabel,
  severityLabel,
  type AnalysisFlag,
  type AnalysisSeverity,
  type AnalysisSummary,
  type QuoteReviewAnalysis,
} from "@/lib/quote-review-analysis"
import { formatUsDate } from "@/lib/sf-field-format"
import { ExternalLink, FileText } from "lucide-react"

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
  href,
  status,
}: {
  title: string
  subtitle: string
  href: string
  status: AnalysisSeverity
}) {
  return (
    <div className="flex flex-col h-full rounded-lg border border-gray-200 bg-white overflow-hidden">
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</p>
        <p className="text-sm font-medium text-gray-900 mt-0.5">{subtitle}</p>
      </div>
      <div className="p-4 flex-1 flex flex-col gap-4">
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 px-4 py-8 text-sm font-medium text-gray-800 hover:border-purple-400 hover:bg-purple-50 transition-colors cursor-pointer`}
        >
          <FileText className="w-5 h-5 text-gray-400" />
          Open document
          <ExternalLink className={`w-4 h-4 ${theme.accent}`} />
        </a>
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Link status</p>
          <SeverityBadge severity={status} />
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Verify on PDF</p>
          <ul className="text-xs text-gray-600 space-y-1.5">
            {COMPARE_CHECKLIST.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="text-gray-300 mt-0.5">☐</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

function SfCompareTable({ opp }: { opp: OppSummary }) {
  const rows = [
    { field: "Win Type", value: opp.winType ?? "—", note: !opp.winType ? "Expected Quote Signed or PO Received" : undefined },
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
            <th className="text-left font-semibold text-gray-600 px-4 py-2.5 w-[24%]">Salesforce field</th>
            <th className="text-left font-semibold text-gray-600 px-4 py-2.5 w-[24%]">Value</th>
            <th className="text-left font-semibold text-gray-600 px-4 py-2.5">Notes</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {rows.map((row) => (
            <tr key={row.field}>
              <td className="px-4 py-2.5 font-medium text-gray-900">{row.field}</td>
              <td className="px-4 py-2.5 text-gray-800">{row.value}</td>
              <td className="px-4 py-2.5 text-gray-500">{row.note ?? "—"}</td>
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
      {/* Report header */}
      <div className="border-b border-gray-200 pb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Signed Quote Review Report</p>
        <h2 className="text-xl font-bold text-gray-900 mt-1">{opp.name}</h2>
        <p className="text-sm text-gray-500 mt-1">{opp.accountName ?? "—"} · {opp.product ?? "—"}</p>
      </div>

      {/* Verdict */}
      <div className={`border-l-4 rounded-r-lg px-5 py-4 ${verdictClass}`}>
        <p className="text-xs font-bold uppercase tracking-wide text-gray-600">
          {analysisSummaryLabel(analysis.summary)}
        </p>
        <p className="text-base font-medium text-gray-900 mt-1">{analysis.recommendation}</p>
      </div>

      {/* Side-by-side quote comparison */}
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Quote comparison</h3>
          <p className="text-xs text-gray-500 mt-1">Open both documents side by side and work through the checklist.</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <DocCompareColumn
            title="Baseline"
            subtitle="Unsigned quote"
            href={docs.unsignedQuoteUrl}
            status={unsignedStatus}
          />
          <DocCompareColumn
            title="Customer signed"
            subtitle="Signed quote"
            href={docs.signedQuoteUrl}
            status={signedStatus}
          />
        </div>
        <FlagTable flags={byCategory("manual").filter((f) => f.id === "pdf-diff")} />
      </section>

      {/* PO */}
      {(docs.purchaseOrderUrl || byCategory("documents").some((f) => f.id.startsWith("po"))) && (
        <section className="space-y-3">
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Purchase order</h3>
          {docs.purchaseOrderUrl ? (
            <a
              href={docs.purchaseOrderUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-medium hover:border-purple-400 hover:bg-purple-50 cursor-pointer"
            >
              <span>Open purchase order</span>
              <ExternalLink className={`w-4 h-4 ${theme.accent}`} />
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

      {/* Entry gate */}
      <section className="space-y-3">
        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Entry gate</h3>
        <FlagTable flags={byCategory("gate")} />
      </section>

      {/* Salesforce alignment */}
      <section className="space-y-3">
        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Salesforce alignment</h3>
        <SfCompareTable opp={opp} />
        <FlagTable flags={byCategory("salesforce")} />
      </section>
    </div>
  )
}
