"use client"

import { useState, useEffect } from "react"
import { ExternalLink, RefreshCw, Play, Loader2, AlertCircle, Gem, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { theme } from "@/lib/theme"

type SFTask = {
  id: string
  subject: string
  whatId: string | null
  whatName: string | null
  priority: string
  dueDate: string | null
  taskUrl: string
  oppUrl: string | null
}

const KHOROS_GEM_URL    = "https://gemini.google.com/gem/2cc0ea7b4320"
const UNBLOCKER_URL     = "https://trilogy-core-renewals-sales-ops.vercel.app/"

type TaskAction =
  | { type: "copilot"; oppName: string }
  | { type: "gem";     url: string; label: string }
  | { type: "agent";   url: string; label: string }

function getTaskAction(subject: string, whatName: string | null): TaskAction | null {
  const sub = subject.toLowerCase()
  const rel = (whatName ?? "").toLowerCase()

  // HVO / Non-HVO Opp Prep → Co-Pilot
  if (sub.includes("hvo opp prep")) {
    return { type: "copilot", oppName: whatName ?? subject }
  }

  // Khoros + license/provisioning → Instance Extractor Gem
  if (rel.includes("khoros") && (
    sub.includes("license") || sub.includes("ticket") ||
    sub.includes("provisioning") || sub.includes("deprovisioning") || sub.includes("de-provisioning")
  )) {
    return { type: "gem", url: KHOROS_GEM_URL, label: "Instance Extractor" }
  }

  // Block / Blocked → Unblocker Agent
  if (sub.includes("block")) {
    return { type: "agent", url: UNBLOCKER_URL, label: "Unblocker Agent" }
  }

  return null
}

function priorityBadge(priority: string) {
  const p = (priority ?? "").toLowerCase()
  if (p === "high")   return <Badge className="bg-red-100 text-red-700 border-red-200 font-medium">High</Badge>
  if (p === "normal") return <Badge className="bg-amber-100 text-amber-700 border-amber-200 font-medium">Normal</Badge>
  if (p === "low")    return <Badge className="bg-gray-100 text-gray-500 border-gray-200 font-medium">Low</Badge>
  return <Badge className="bg-gray-100 text-gray-400 border-gray-200 font-medium">{priority || "—"}</Badge>
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return <span className="text-gray-400">—</span>
  const date = new Date(dateStr + "T00:00:00")
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const isOverdue = date < today
  const label = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  return <span className={isOverdue ? "text-red-600 font-medium" : "text-gray-700"}>{label}</span>
}

export default function TasksPage() {
  const [tasks, setTasks]         = useState<SFTask[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [displayName, setDisplayName] = useState("")

  function nameFromEmail(email: string) {
    return email.split("@")[0].split(".").map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(" ")
  }

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch("/api/sf-tasks")
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to load tasks")
      setTasks(data.tasks ?? [])
      if (data.userEmail) setDisplayName(nameFromEmail(data.userEmail))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function handleAction(action: TaskAction) {
    if (action.type === "copilot") {
      window.open(`/workflow/opp-prep-copilot?opp=${encodeURIComponent(action.oppName)}&autostart=true`, "_blank")
    } else {
      window.open(action.url, "_blank")
    }
  }

  const accentBg    = theme.isProd ? "bg-[#00b4a2]" : "bg-purple-700"
  const accentText  = theme.isProd ? "text-[#00b4a2]" : "text-purple-700"
  const accentBorder = theme.isProd ? "border-[#00b4a2]" : "border-purple-600"

  return (
    <div className="flex flex-col h-full min-h-screen bg-gray-50">

      {/* Page header */}
      <div className="bg-white border-b border-gray-200 px-8 py-5 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {displayName ? `${displayName}'s Open Tasks` : "My Open Tasks"}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Open Salesforce tasks assigned to you</p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}
          className={`gap-2 cursor-pointer border-gray-200 text-gray-600 hover:${accentText}`}>
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 px-8 py-6">

        {loading && (
          <div className="flex items-center justify-center py-24 gap-3 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading tasks from Salesforce…</span>
          </div>
        )}

        {!loading && error && (
          <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {!loading && !error && tasks.length === 0 && (
          <div className="flex items-center justify-center py-24 text-gray-400 text-sm">
            No open tasks found.
          </div>
        )}

        {!loading && !error && tasks.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            {/* Count */}
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 text-xs text-gray-500 font-medium">
              {tasks.length} open task{tasks.length !== 1 ? "s" : ""}
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-[28%]">Subject</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-[32%]">Related To</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-[12%]">Priority</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-[14%]">Due Date</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-[14%]"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {tasks.map(task => (
                    <tr key={task.id} className="hover:bg-gray-50 transition-colors">

                      {/* Subject */}
                      <td className="px-5 py-3.5">
                        <a href={task.taskUrl} target="_blank" rel="noopener noreferrer"
                          className={`${accentText} hover:underline font-medium flex items-center gap-1.5 group`}>
                          <span className="line-clamp-2">{task.subject}</span>
                          <ExternalLink className="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </a>
                      </td>

                      {/* Related To */}
                      <td className="px-5 py-3.5">
                        {task.whatName && task.oppUrl ? (
                          <a href={task.oppUrl} target="_blank" rel="noopener noreferrer"
                            className="text-blue-600 hover:underline flex items-center gap-1.5 group">
                            <span className="line-clamp-2">{task.whatName}</span>
                            <ExternalLink className="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </a>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>

                      {/* Priority */}
                      <td className="px-5 py-3.5">{priorityBadge(task.priority)}</td>

                      {/* Due Date */}
                      <td className="px-5 py-3.5">{formatDate(task.dueDate)}</td>

                      {/* Smart action button */}
                      <td className="px-5 py-3.5">
                        {(() => {
                          const action = getTaskAction(task.subject, task.whatName)
                          if (!action) return <span className="text-gray-300 text-xs">—</span>
                          if (action.type === "copilot") return (
                            <Button size="sm" onClick={() => handleAction(action)}
                              className={`${accentBg} text-white hover:opacity-90 cursor-pointer gap-1.5 text-xs font-medium`}>
                              <Play className="w-3 h-3" /> Co-Pilot
                            </Button>
                          )
                          if (action.type === "gem") return (
                            <Button size="sm" onClick={() => handleAction(action)}
                              className="bg-blue-600 text-white hover:bg-blue-700 cursor-pointer gap-1.5 text-xs font-medium">
                              <Gem className="w-3 h-3" /> {action.label}
                            </Button>
                          )
                          return (
                            <Button size="sm" onClick={() => handleAction(action)}
                              className="bg-orange-500 text-white hover:bg-orange-600 cursor-pointer gap-1.5 text-xs font-medium">
                              <Zap className="w-3 h-3" /> {action.label}
                            </Button>
                          )
                        })()}
                      </td>

                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
