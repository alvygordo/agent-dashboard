"use client"

import { useState, useEffect, useCallback } from "react"
import { BarChart2, ExternalLink, Loader2, AlertCircle, RefreshCw } from "lucide-react"
import { theme } from "@/lib/theme"

const tabs = [
  { label: "Opps w/o Contact First Name", reportId: "00OIh000000m0heMAA" },
  { label: "Opps Missing Critical AR Info", reportId: "00O2x0000047MXiEAM" },
  { label: "Opps Stuck in Finalizing",      reportId: "00O2x0000046wN7EAI" },
  { label: "My Open Cases",                 reportId: null },
] as const

type ReportRow   = { label: string; url: string | null }[]
type ReportData  = { headers: string[]; rows: ReportRow[]; total: number }
type CaseRow     = {
  id: string; caseNumber: string; subject: string
  status: string; priority: string; accountName: string | null
  createdDate: string; url: string
}
type CasesData = { cases: CaseRow[]; total: number }

const PRIORITY_COLORS: Record<string, string> = {
  High:   "bg-red-100 text-red-700 border-red-200",
  Medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  Low:    "bg-gray-100 text-gray-600 border-gray-200",
}

function StatusBadge({ value, type }: { value: string; type?: "priority" | "status" }) {
  const cls = type === "priority" ? (PRIORITY_COLORS[value] ?? PRIORITY_COLORS.Low) : "bg-blue-50 text-blue-700 border-blue-200"
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${cls}`}>{value}</span>
  )
}

function ReportTable({ data }: { data: ReportData }) {
  if (!data.rows.length) return (
    <div className="text-center py-16 text-sm text-gray-400">No records found.</div>
  )
  return (
    <div className="overflow-x-auto">
      <div className="text-xs text-gray-400 mb-2">{data.total} record{data.total !== 1 ? "s" : ""}</div>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            {data.headers.map((h, i) => (
              <th key={i} className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, ri) => (
            <tr key={ri} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
              {row.map((cell, ci) => (
                <td key={ci} className="px-3 py-2.5 text-gray-700 max-w-xs">
                  {cell.url ? (
                    <a href={cell.url} target="_blank" rel="noopener noreferrer"
                      className={`inline-flex items-center gap-1 hover:underline font-medium ${theme.isProd ? "text-[#00b4a2]" : "text-purple-700"}`}>
                      {cell.label} <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  ) : (
                    <span className="truncate block">{cell.label || "—"}</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CasesTable({ data }: { data: CasesData }) {
  if (!data.cases.length) return (
    <div className="text-center py-16 text-sm text-gray-400">No open cases found.</div>
  )
  const accent = theme.isProd ? "text-[#00b4a2]" : "text-purple-700"
  return (
    <div className="overflow-x-auto">
      <div className="text-xs text-gray-400 mb-2">{data.total} record{data.total !== 1 ? "s" : ""}</div>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            {["Case #", "Subject", "Account", "Status", "Priority", "Created"].map(h => (
              <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.cases.map(c => (
            <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
              <td className="px-3 py-2.5">
                <a href={c.url} target="_blank" rel="noopener noreferrer"
                  className={`inline-flex items-center gap-1 font-medium hover:underline ${accent}`}>
                  {c.caseNumber} <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              </td>
              <td className="px-3 py-2.5 text-gray-700 max-w-xs truncate">{c.subject || "—"}</td>
              <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{c.accountName || "—"}</td>
              <td className="px-3 py-2.5"><StatusBadge value={c.status} type="status" /></td>
              <td className="px-3 py-2.5"><StatusBadge value={c.priority} type="priority" /></td>
              <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">
                {new Date(c.createdDate).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function SFReportsPage() {
  const [activeTab, setActiveTab] = useState(0)
  const [reportCache, setReportCache] = useState<Record<number, ReportData | CasesData | { error: string }>>({})
  const [loading, setLoading] = useState(false)

  const activeBorder = theme.isProd ? "border-[#00b4a2] text-[#00b4a2]" : "border-purple-600 text-purple-700"
  const inactiveTab  = "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"

  const fetchTab = useCallback(async (idx: number, force = false) => {
    if (!force && reportCache[idx]) return
    setLoading(true)
    try {
      const tab = tabs[idx]
      let data: ReportData | CasesData | { error: string }
      if (tab.reportId) {
        const res = await fetch(`/api/sf-report?id=${tab.reportId}`)
        data = await res.json()
      } else {
        const res = await fetch('/api/sf-cases')
        data = await res.json()
      }
      setReportCache(prev => ({ ...prev, [idx]: data }))
    } catch {
      setReportCache(prev => ({ ...prev, [idx]: { error: 'Network error — please try again.' } }))
    } finally {
      setLoading(false)
    }
  }, [reportCache])

  useEffect(() => { fetchTab(activeTab) }, [activeTab])

  const current = reportCache[activeTab]
  const tab     = tabs[activeTab]

  return (
    <div className="p-8 max-w-full">

      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className={`w-9 h-9 rounded-lg ${theme.avatarBg} flex items-center justify-center`}>
              <BarChart2 className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">SF Reports</h1>
          </div>
          <p className="text-sm text-gray-500 ml-12">Live Salesforce data — refreshes on tab switch.</p>
        </div>
        <button
          onClick={() => fetchTab(activeTab, true)}
          className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
            theme.isProd
              ? "border-[#b2e8e2] text-[#009688] hover:bg-[#e0f7f5]"
              : "border-purple-200 text-purple-700 hover:bg-purple-50"
          }`}
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-6 overflow-x-auto">
          {tabs.map((t, i) => (
            <button
              key={i}
              onClick={() => setActiveTab(i)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === i ? activeBorder : inactiveTab
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 min-h-64">
        {loading && (
          <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading {tab.label}…</span>
          </div>
        )}

        {!loading && !current && (
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
            <span>Loading…</span>
          </div>
        )}

        {!loading && current && 'error' in current && (
          <div className="flex items-center gap-2 text-red-600 py-8 justify-center">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="text-sm">{(current as { error: string }).error}</span>
          </div>
        )}

        {!loading && current && !('error' in current) && tab.reportId && (
          <ReportTable data={current as ReportData} />
        )}

        {!loading && current && !('error' in current) && !tab.reportId && (
          <CasesTable data={current as CasesData} />
        )}
      </div>

    </div>
  )
}
