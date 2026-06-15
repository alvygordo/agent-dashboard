"use client"

import { useState, useEffect } from "react"
import { ExternalLink, RefreshCw, Loader2, AlertCircle, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { theme } from "@/lib/theme"

type NNROpp = {
  id: string
  name: string
  nnrDeadline: string | null
  nnrRequired: string | null
  nnrSent: string | null
  renewalDate: string | null
  salesOps: string
  oppUrl: string
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return <span className="text-gray-400">—</span>
  const date = new Date(dateStr + "T00:00:00")
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const isOverdue = date < today
  const label = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  return <span className={isOverdue ? "text-red-600 font-medium" : "text-gray-700"}>{label}</span>
}

function yesNoBadge(val: string | null) {
  const v = (val ?? "").toLowerCase()
  if (v === "yes") return <Badge className="bg-green-100 text-green-700 border-green-200 font-medium">Yes</Badge>
  if (v === "no")  return <Badge className="bg-gray-100 text-gray-500 border-gray-200 font-medium">No</Badge>
  return <span className="text-gray-400 text-sm">—</span>
}

function SalesOpsSection({ owner, opps, accentText }: { owner: string; opps: NNROpp[]; accentText: string }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
      {/* Owner header */}
      <button onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-gray-50 border-b border-gray-100 hover:bg-gray-100 transition-colors">
        <div className="flex items-center gap-3">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold ${theme.isProd ? "bg-[#00b4a2]" : "bg-purple-600"}`}>
            {owner.charAt(0)}
          </div>
          <span className="font-semibold text-gray-800 text-sm">{owner}</span>
          <span className="text-xs text-gray-400 font-medium">{opps.length} opp{opps.length !== 1 ? "s" : ""}</span>
        </div>
        {collapsed ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronUp className="w-4 h-4 text-gray-400" />}
      </button>

      {!collapsed && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-[22%]">NNR Notice Deadline</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-[34%]">Opportunity Name</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-[14%]">NNR Required?</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-[14%]">NNR Sent?</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-[16%]">Renewal Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {opps.map(opp => (
                <tr key={opp.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5">{formatDate(opp.nnrDeadline)}</td>
                  <td className="px-5 py-3.5">
                    <a href={opp.oppUrl} target="_blank" rel="noopener noreferrer"
                      className={`${accentText} hover:underline flex items-center gap-1.5 group`}>
                      <span className="line-clamp-2">{opp.name}</span>
                      <ExternalLink className="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </a>
                  </td>
                  <td className="px-5 py-3.5">{yesNoBadge(opp.nnrRequired)}</td>
                  <td className="px-5 py-3.5">{yesNoBadge(opp.nnrSent)}</td>
                  <td className="px-5 py-3.5">{formatDate(opp.renewalDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function NNRTrackerPage() {
  const [grouped, setGrouped]   = useState<Record<string, NNROpp[]>>({})
  const [total, setTotal]       = useState(0)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch("/api/sf-nnr")
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to load NNR data")
      setGrouped(data.grouped ?? {})
      setTotal(data.total ?? 0)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const accentText = theme.isProd ? "text-[#00b4a2]" : "text-purple-700"
  const owners     = Object.keys(grouped).sort()

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-5 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-bold text-gray-900">NNR Tracker</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {loading ? "Loading…" : `${total} open opportunit${total !== 1 ? "ies" : "y"} · ${owners.length} rep${owners.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}
          className="gap-2 cursor-pointer border-gray-200 text-gray-600">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 px-8 py-6 space-y-4">

        {loading && (
          <div className="flex items-center justify-center py-24 gap-3 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading NNR data from Salesforce…</span>
          </div>
        )}

        {!loading && error && (
          <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {!loading && !error && owners.length === 0 && (
          <div className="flex items-center justify-center py-24 text-gray-400 text-sm">
            No open opportunities with NNR deadlines found.
          </div>
        )}

        {!loading && !error && owners.map(owner => (
          <SalesOpsSection key={owner} owner={owner} opps={grouped[owner]} accentText={accentText} />
        ))}

      </div>
    </div>
  )
}
