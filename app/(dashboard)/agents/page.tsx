"use client"

import { agents } from "@/lib/agents"
import { theme } from "@/lib/theme"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowRight, Bot, Play, Loader2, CheckCircle2, XCircle } from "lucide-react"
import { useState } from "react"

function ContractAnalyzerCard({ agent }: { agent: typeof agents[0] }) {
  const [oppId, setOppId] = useState("")
  const [status, setStatus] = useState<"idle" | "running" | "success" | "error">("idle")
  const [message, setMessage] = useState("")

  const handleRun = async () => {
    if (!oppId.trim()) {
      setMessage("Please enter a Salesforce Opportunity ID.")
      setStatus("error")
      return
    }
    setStatus("running")
    setMessage("")
    try {
      const res = await fetch("/api/run-contract-analyzer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oppId: oppId.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setStatus("success")
        setMessage("Analysis started. Check GitHub Actions for progress and Salesforce for results in ~5 minutes.")
        setOppId("")
      } else {
        setStatus("error")
        setMessage(data.error ?? "Failed to trigger analysis.")
      }
    } catch {
      setStatus("error")
      setMessage("Network error — please try again.")
    }
  }

  return (
    <Card className={`bg-white border-gray-200 transition-all ${theme.cardHover}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <CardTitle className="text-sm text-gray-900">{agent.name}</CardTitle>
          <Badge className="bg-green-100 text-green-700 border border-green-300 text-xs">
            Active
          </Badge>
        </div>
        <CardDescription className="text-gray-500 text-xs">{agent.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <input
          type="text"
          value={oppId}
          onChange={(e) => {
            setOppId(e.target.value)
            setStatus("idle")
            setMessage("")
          }}
          placeholder="Salesforce Opportunity ID"
          className="w-full text-xs border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-teal-500 text-gray-800 placeholder-gray-400"
        />
        <Button
          onClick={handleRun}
          disabled={status === "running"}
          className="w-full text-sm bg-teal-600 hover:bg-teal-700 text-white"
        >
          {status === "running" ? (
            <><Loader2 className="w-3 h-3 mr-2 animate-spin" /> Running...</>
          ) : (
            <><Play className="w-3 h-3 mr-2" /> Run Analysis</>
          )}
        </Button>
        {status === "success" && (
          <div className="flex items-start gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
            <CheckCircle2 className="w-3 h-3 mt-0.5 shrink-0" />
            <span>{message}</span>
          </div>
        )}
        {status === "error" && (
          <div className="flex items-start gap-1.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            <XCircle className="w-3 h-3 mt-0.5 shrink-0" />
            <span>{message}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function AgentsPage() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Bot className={`w-5 h-5 ${theme.accent}`} />
          <h1 className="text-xl font-bold text-gray-900">Individual Agents</h1>
        </div>
        <p className="text-sm text-gray-500">Standalone AI agents you can open and use directly.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {agents.map((agent) =>
          agent.id === "contract-analyzer" ? (
            <ContractAnalyzerCard key={agent.id} agent={agent} />
          ) : (
            <Card key={agent.id} className={`bg-white border-gray-200 transition-all ${theme.cardHover}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-sm text-gray-900">{agent.name}</CardTitle>
                  <Badge className={agent.status === "active" ? "bg-green-100 text-green-700 border border-green-300 text-xs" : "bg-gray-100 text-gray-500 text-xs"}>
                    {agent.status === "active" ? "Active" : "Coming Soon"}
                  </Badge>
                </div>
                <CardDescription className="text-gray-500 text-xs">{agent.description}</CardDescription>
              </CardHeader>
              <CardContent>
                {agent.status === "active" ? (
                  <a href={agent.url} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" className={`w-full text-sm cursor-pointer ${theme.agentBtn}`}>
                      Open Agent <ArrowRight className="w-3 h-3 ml-2" />
                    </Button>
                  </a>
                ) : (
                  <Button disabled className="w-full text-sm" variant="secondary">Coming Soon</Button>
                )}
              </CardContent>
            </Card>
          )
        )}
      </div>
    </div>
  )
}