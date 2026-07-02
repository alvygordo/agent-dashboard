"use client"

import { theme } from "@/lib/theme"
import {
  buildSfBaselineAlignment,
  type DocumentAnalysisBundle,
  type AlignmentRow,
  type AlignmentStatus,
  type SfAlignmentInput,
} from "@/lib/quote-alignment"
import {
  analysisSummaryLabel,
  severityLabel,
  type AnalysisFlag,
  type AnalysisSeverity,
  type QuoteReviewAnalysis,
} from "@/lib/quote-review-analysis"
import { formatUsDate } from "@/lib/sf-field-format"
import { ExternalLink, Loader2 } from "lucide-react"

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

function AlignmentBadge({ status }: { status: AlignmentStatus }) {
  const styles: Record<AlignmentStatus, string> = {
    aligned: "bg-green-100 text-green-800 border-green-200",
    mismatch: "bg-amber-100 text-amber-800 border-amber-200",
    partial: "bg-blue-100 text-blue-800 border-blue-200",
    unknown: "bg-gray-100 text-gray-700 border-gray-200",
    na: "bg-gray-50 text-gray-400 border-gray-200",
  }
  const labels: Record<AlignmentStatus, string> = {
    aligned: "Aligned",
    mismatch: "Mismatch",
    partial: "Partial",
    unknown: "Unknown",
    na: "N/A",
  }
  return (
    <span className={`inline-flex text-xs font-semibold px-2 py-0.5 rounded border ${styles[status]}`}>
      {labels[status]}
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

function ComparisonCheckTable({
  checks,
}: {
  checks: { check: string; severity: AnalysisSeverity; finding: string }[]
}) {
  if (checks.length === 0) return null
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
          {checks.map((row) => (
            <tr key={row.check} className="bg-white">
              <td className="px-4 py-3 font-medium text-gray-900 align-top">{row.check}</td>
              <td className="px-4 py-3 align-top">
                <SeverityBadge severity={row.severity} />
              </td>
              <td className="px-4 py-3 text-gray-600 align-top">{row.finding}</td>
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
  pageCount,
  titleFromPdf,
}: {
  title: string
  subtitle: string
  linkLabel: string
  href: string
  status: AnalysisSeverity
  pageCount: number | null
  titleFromPdf: string | null
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</p>
        <p className="text-sm font-medium text-gray-900 mt-0.5">{subtitle}</p>
        {titleFromPdf && (
          <p className="text-xs text-gray-500 mt-0.5 truncate" title={titleFromPdf}>
            File: {titleFromPdf}
          </p>
        )}
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
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-gray-500">Link status</span>
          <SeverityBadge severity={status} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-500">Pages</span>
          <span className="font-medium text-gray-800">
            {pageCount != null ? `${pageCount} page${pageCount === 1 ? "" : "s"}` : "—"}
          </span>
        </div>
      </div>
    </div>
  )
}

function AlignmentTable({ rows }: { rows: AlignmentRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-sm min-w-[720px]">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left font-semibold text-gray-600 px-4 py-2.5 w-[18%]">Field</th>
            <th className="text-left font-semibold text-gray-600 px-4 py-2.5 w-[20%]">Salesforce</th>
            <th className="text-left font-semibold text-gray-600 px-4 py-2.5 w-[20%]">Signed quote</th>
            <th className="text-left font-semibold text-gray-600 px-4 py-2.5 w-[20%]">Purchase order</th>
            <th className="text-left font-semibold text-gray-600 px-4 py-2.5 w-[10%]">Aligned?</th>
            <th className="text-left font-semibold text-gray-600 px-4 py-2.5">Note</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {rows.map((row) => (
            <tr key={row.field}>
              <td className="px-4 py-2.5 font-medium text-gray-900 align-top">{row.field}</td>
              <td className="px-4 py-2.5 text-gray-800 align-top">{row.salesforce}</td>
              <td className="px-4 py-2.5 text-gray-800 align-top">{row.signedQuote}</td>
              <td className="px-4 py-2.5 text-gray-800 align-top">{row.purchaseOrder}</td>
              <td className="px-4 py-2.5 align-top">
                <AlignmentBadge status={row.status} />
              </td>
              <td className="px-4 py-2.5 text-gray-600 align-top text-xs">{row.note ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
  sfAlignment,
  poProvided,
  docAnalysis,
  docAnalysisLoading,
  docAnalysisError,
}: {
  analysis: QuoteReviewAnalysis
  opp: OppSummary
  docs: DocLinks
  sfAlignment: SfAlignmentInput
  poProvided: boolean
  docAnalysis?: DocumentAnalysisBundle | null
  docAnalysisLoading?: boolean
  docAnalysisError?: string | null
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

  const quoteChecks = docAnalysis?.quoteComparison.checks ?? []
  const poChecks = docAnalysis?.poAudit.checks ?? []
  const pendingLabel = docAnalysisLoading
    ? "Analyzing…"
    : docAnalysisError
      ? "Not extracted — open PDF"
      : "Pending PDF analysis"
  const alignment = docAnalysis?.alignment
    ?? buildSfBaselineAlignment(sfAlignment, poProvided, pendingLabel)

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

      {docAnalysisLoading && (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Analyzing PDFs from Salesforce… usually 10–30 seconds for 2–3 documents.
        </div>
      )}
      {docAnalysisError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Document analysis failed: {docAnalysisError}. Open the PDFs manually to complete review.
        </div>
      )}
      {docAnalysis?.errors && docAnalysis.errors.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 space-y-2">
          <p className="font-medium">PDF download / extraction issues</p>
          <ul className="list-disc pl-5 space-y-1">
            {docAnalysis.errors.map((err) => (
              <li key={err.doc}>
                <span className="font-medium capitalize">{err.doc}:</span> {err.message}
              </li>
            ))}
          </ul>
          {docAnalysis.connectedOrg && (
            <p className="text-xs text-red-800 pt-1">
              API connected to: {docAnalysis.connectedOrg.replace('.my.salesforce.com', '')}
              {' — '}
              If your links are production Lightning URLs but this is sandbox, open each file in sandbox Salesforce and paste those links instead.
            </p>
          )}
        </div>
      )}

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Quote comparison</h3>
          <p className="text-xs text-gray-500 mt-1">
            {docAnalysis?.quoteComparison.summary
              ?? "Comparing unsigned baseline to customer-signed quote."}
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <DocCompareColumn
            title="Baseline"
            subtitle="Unsigned quote"
            linkLabel="Open unsigned quote"
            href={docs.unsignedQuoteUrl}
            status={unsignedStatus}
            pageCount={docAnalysis?.quoteComparison.unsignedPages ?? null}
            titleFromPdf={docAnalysis?.unsigned?.title ?? null}
          />
          <DocCompareColumn
            title="Customer signed"
            subtitle="Signed quote"
            linkLabel="Open signed quote"
            href={docs.signedQuoteUrl}
            status={signedStatus}
            pageCount={docAnalysis?.quoteComparison.signedPages ?? null}
            titleFromPdf={docAnalysis?.signed?.title ?? null}
          />
        </div>
        {quoteChecks.length > 0 ? (
          <ComparisonCheckTable checks={quoteChecks} />
        ) : (
          <FlagTable flags={byCategory("manual").filter((f) => f.id.startsWith("pdf"))} />
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Data alignment</h3>
          <p className="text-xs text-gray-500 mt-1">{alignment.summary}</p>
        </div>
        <AlignmentTable rows={alignment.rows} />
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm space-y-2">
          <p>
            <span className="font-medium text-gray-900">Overall alignment: </span>
            <AlignmentBadge status={alignment.overallAligned ? "aligned" : alignment.overallSeverity === "warn" ? "mismatch" : "unknown"} />
            {" "}
            {docAnalysisLoading
              ? "PDF analysis in progress — alignment status will update shortly."
              : alignment.overallAligned
                ? "Core fields match across Salesforce, signed quote, and PO."
                : docAnalysis
                  ? "Review mismatched rows above before accepting."
                  : "Salesforce column populated — complete PDF analysis to compare signed quote and PO."}
          </p>
          {(poProvided || docAnalysis?.poAudit.present) && (
            <p>
              <span className="font-medium text-gray-900">PO T&amp;C conflict: </span>
              {!docAnalysis && docAnalysisLoading && (
                <span className="text-gray-500">Analyzing PO…</span>
              )}
              {!docAnalysis && !docAnalysisLoading && (
                <span className="text-gray-500">
                  {poProvided ? "Awaiting PO PDF analysis." : "No PO provided."}
                </span>
              )}
              {docAnalysis && poProvided && !docAnalysis.purchaseOrder && (
                <span className="text-amber-800">
                  {docAnalysis.poAudit.tcConflictNote}
                </span>
              )}
              {docAnalysis?.purchaseOrder && docAnalysis.poAudit.tcConflict === "none_detected" && (
                <span className="text-green-800">No conflict detected in extracted text.</span>
              )}
              {docAnalysis?.purchaseOrder && docAnalysis.poAudit.tcConflict === "possible_conflict" && (
                <span className="text-amber-800">Possible conflict — {docAnalysis.poAudit.tcConflictNote}</span>
              )}
              {docAnalysis?.purchaseOrder && docAnalysis.poAudit.tcConflict === "unknown" && (
                <span className="text-gray-700">{docAnalysis.poAudit.tcConflictNote}</span>
              )}
              {docAnalysis?.poAudit.tcConflict === "not_applicable" && (
                <span className="text-gray-500">No PO provided.</span>
              )}
            </p>
          )}
        </div>
      </section>

      {(docs.purchaseOrderUrl || byCategory("documents").some((f) => f.id.startsWith("po"))) && (
        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Purchase order</h3>
            <p className="text-xs text-gray-500 mt-1">
              {docAnalysis?.poAudit.summary
                ?? "Compare the attached PO to the signed quote on price, product scope, and terms."}
            </p>
          </div>
          {docs.purchaseOrderUrl ? (
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <a
                href={docs.purchaseOrderUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1 ${theme.accent} hover:underline cursor-pointer`}
              >
                Open purchase order
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              {docAnalysis?.poAudit.pageCount != null && (
                <span className="text-xs text-gray-500">
                  {docAnalysis.poAudit.pageCount} page{docAnalysis.poAudit.pageCount === 1 ? "" : "s"}
                  {docAnalysis.purchaseOrder?.title ? ` · ${docAnalysis.purchaseOrder.title}` : ""}
                </span>
              )}
            </div>
          ) : null}
          {poChecks.length > 0 ? (
            <ComparisonCheckTable checks={poChecks} />
          ) : (
            <FlagTable
              flags={[
                ...byCategory("documents").filter((f) => f.id.startsWith("po")),
                ...byCategory("manual").filter((f) => f.id.startsWith("po")),
              ]}
            />
          )}
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
