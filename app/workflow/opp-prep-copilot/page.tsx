"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { getAgent } from "@/lib/agents"
import { theme } from "@/lib/theme"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ArrowRight, ArrowLeft, Bot, CheckCircle, AlertCircle, Loader2 } from "lucide-react"

type Step = "opp-input" | "find-contract" | "ns-agent" | "sf-agent" | "opp-prep-ai" | "done"

type ContractData = {
  contractUrl: string
  contractTitle: string
  baseContractUrl: string
  baseContractTitle: string
  isPackage: boolean
  msaUrl: string
  msaTitle: string
  additionalDocs: { url: string; title: string }[]
  oppId: string
}

type NSData = {
  oppName: string
  nsData: unknown
}

export default function OppPrepCopilotWorkflow() {
  const [step, setStep]             = useState<Step>("opp-input")
  const [oppName, setOppName]       = useState("")
  const [oppNameError, setOppNameError] = useState("")
  const [contractData, setContractData] = useState<ContractData | null>(null)
  const [nsData, setNsData]         = useState<NSData | null>(null)
  const [sfData, setSfData]         = useState<unknown[] | null>(null)
  const [visitedSteps, setVisitedSteps] = useState<Set<Step>>(new Set())
  const nsIframeRef                 = useRef<HTMLIFrameElement>(null)
  const sfIframeRef                 = useRef<HTMLIFrameElement>(null)
  const nsHandoffSent               = useRef(false)
  const sfHandoffSent               = useRef(false)
  const [embedToken, setEmbedToken] = useState<{ email: string; token: string } | null>(null)

  const contractFinder = getAgent("contract-finder")!
  const nsAgent        = getAgent("ns-agent")!
  const sfAgent        = getAgent("sf-agent")!
  const oppPrepAI      = getAgent("opp-prep-ai")!

  useEffect(() => {
    fetch('/api/embed-token')
      .then(r => r.json())
      .then(d => { if (d.token) setEmbedToken(d) })
      .catch(() => {})
  }, [])

  const handleMessage = useCallback((event: MessageEvent) => {
    if (event.data?.type === "contract-finder-result") {
      const data: ContractData = {
        contractUrl:       event.data.contractUrl ?? "",
        contractTitle:     event.data.title ?? "",
        baseContractUrl:   event.data.baseContractUrl ?? "",
        baseContractTitle: event.data.baseContractTitle ?? "",
        isPackage:         event.data.isPackage === true,
        msaUrl:            event.data.msaUrl ?? "",
        msaTitle:          event.data.msaTitle ?? "",
        additionalDocs:    Array.isArray(event.data.additionalDocs) ? event.data.additionalDocs : [],
        oppId:             event.data.oppId ?? "",
      }
      setContractData(data)
      setStep("ns-agent")
    }

    if (event.data?.type === "ns-agent-result") {
      setNsData({ oppName: event.data.oppName, nsData: event.data.nsData })
      setStep("sf-agent")
    }

    if (event.data?.type === "sf-agent-result") {
      setSfData(Array.isArray(event.data.opportunities) ? event.data.opportunities : [])
      setStep("opp-prep-ai")
    }
  }, [])

  useEffect(() => {
    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [handleMessage])

  useEffect(() => {
    setVisitedSteps(prev => new Set(prev).add(step))
  }, [step])

  // NS Agent handoff — send once
  useEffect(() => {
    if (step !== "ns-agent" || !contractData) return
    if (nsHandoffSent.current) return
    const iframe = nsIframeRef.current
    if (!iframe) return
    nsHandoffSent.current = true
    function sendHandoff() {
      iframe!.contentWindow?.postMessage({
        type:            "dashboard-handoff",
        oppName,
        oppId:           contractData!.oppId,
        contractUrl:     contractData!.contractUrl,
        contractTitle:   contractData!.contractTitle,
        isPackage:       contractData!.isPackage,
        baseContractUrl: contractData!.baseContractUrl,
        msaUrl:          contractData!.msaUrl,
        additionalDocs:  contractData!.additionalDocs,
      }, "*")
    }
    iframe.addEventListener("load", sendHandoff)
    sendHandoff()
    return () => iframe.removeEventListener("load", sendHandoff)
  }, [step, contractData, oppName])

  // SF Agent handoff — send once
  useEffect(() => {
    if (step !== "sf-agent") return
    if (sfHandoffSent.current) return
    const iframe = sfIframeRef.current
    if (!iframe) return
    sfHandoffSent.current = true
    function sendHandoff() {
      iframe!.contentWindow?.postMessage({ type: "dashboard-handoff", oppName }, "*")
    }
    iframe.addEventListener("load", sendHandoff)
    sendHandoff()
    return () => iframe.removeEventListener("load", sendHandoff)
  }, [step, oppName])

  function handleOppNameSubmit() {
    if (!oppName.trim()) {
      setOppNameError("Please enter the opportunity name before continuing.")
      return
    }
    setOppNameError("")
    setStep("find-contract")
  }

  function resetWorkflow() {
    setStep("opp-input")
    setOppName("")
    setContractData(null)
    setNsData(null)
    setSfData(null)
    setVisitedSteps(new Set())
    nsHandoffSent.current = false
    sfHandoffSent.current = false
  }

  const contractFinderUrl = embedToken
    ? `${contractFinder.url}?source=agent-dashboard&opp=${encodeURIComponent(oppName)}&u=${encodeURIComponent(embedToken.email)}&t=${embedToken.token}`
    : `${contractFinder.url}?source=agent-dashboard&opp=${encodeURIComponent(oppName)}`

  const sfAgentUrl = embedToken
    ? `${sfAgent.url}?source=agent-dashboard&u=${encodeURIComponent(embedToken.email)}&t=${embedToken.token}`
    : `${sfAgent.url}?source=agent-dashboard`

  const oppPrepAIUrl = (() => {
    const params = new URLSearchParams({ source: "agent-dashboard" })
    if (oppName) params.set("opp", oppName)
    if (contractData?.contractUrl) params.set("contract", contractData.contractUrl)
    if (contractData?.baseContractUrl) params.set("baseContract", contractData.baseContractUrl)
    if (embedToken) {
      params.set("u", embedToken.email)
      params.set("t", embedToken.token)
    }
    return `${oppPrepAI.url}?${params.toString()}`
  })()

  const stepIndex = { "opp-input": 0, "find-contract": 1, "ns-agent": 2, "sf-agent": 3, "opp-prep-ai": 4, "done": 5 }[step]

  const steps: { label: string; stepName: Step }[] = [
    { label: "Enter Opportunity", stepName: "opp-input" },
    { label: "Find Contract",     stepName: "find-contract" },
    { label: "NS Agent",          stepName: "ns-agent" },
    { label: "SF Agent",          stepName: "sf-agent" },
    { label: "Opp Prep AI",       stepName: "opp-prep-ai" },
    { label: "Done",              stepName: "done" },
  ]

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col relative">

      {/* Sandbox banner */}
      <div className="bg-purple-700 text-white text-center py-2 px-4 text-sm font-medium tracking-wide shrink-0">
        ⚠️ SANDBOX ENVIRONMENT — For testing purposes only
      </div>

      {/* Header */}
      <div className={`${theme.headerBg} shrink-0`}>
        <div className="max-w-full px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg ${theme.avatarBg} flex items-center justify-center`}>
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className={`text-base font-semibold ${theme.headerText}`}>Agent Dashboard</h1>
              <p className={`text-xs ${theme.headerSub}`}>Opp Prep Co-Pilot</p>
            </div>
          </div>
          <Link href="/">
            <Button variant="ghost" className={`${theme.ghostBtn} text-sm cursor-pointer`}>
              <ArrowLeft className="w-3 h-3 mr-1" /> Dashboard
            </Button>
          </Link>
        </div>
      </div>

      {/* Progress bar */}
      <div className="border-b border-gray-200 bg-white shrink-0">
        <div className="px-6 py-3 flex items-center gap-4">
          {steps.map((s, i) => {
            const isActive    = step === s.stepName
            const isDone      = visitedSteps.has(s.stepName) || stepIndex > i
            const isClickable = isDone && !isActive
            return (
              <div key={i} className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors
                    ${isDone ? "bg-green-500 text-white" : isActive ? theme.stepActive : "bg-gray-200 text-gray-400"}`}>
                    {isDone ? "✓" : i + 1}
                  </div>
                  {isClickable ? (
                    <button
                      onClick={() => setStep(s.stepName)}
                      className="text-sm text-green-600 hover:text-green-800 hover:underline cursor-pointer font-medium transition-colors"
                    >
                      {s.label}
                    </button>
                  ) : (
                    <span className={`text-sm ${isActive ? "text-gray-900 font-medium" : "text-gray-400"}`}>
                      {s.label}
                    </span>
                  )}
                </div>
                {i < steps.length - 1 && <ArrowRight className="w-3 h-3 text-gray-300" />}
              </div>
            )
          })}
        </div>
      </div>

      {/* Content */}
      <div className="relative flex-1 min-h-0 flex flex-col">

        {/* Contract Finder iframe */}
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", zIndex: step === "find-contract" ? 20 : 10 }}>
          {step === "find-contract" && (
            <div className={`${theme.instructionBar} px-6 py-3 flex items-center justify-between shrink-0`}>
              <div className="flex items-center gap-2">
                <AlertCircle className={`w-4 h-4 ${theme.instructionIcon} shrink-0`} />
                <p className={`text-sm ${theme.instructionText}`}>
                  <strong>Find the correct contract below.</strong> Click <strong>✓ Use this contract</strong> to continue — the rest of the pipeline will run automatically.
                </p>
              </div>
              <Button onClick={() => setStep("opp-input")} variant="ghost"
                className={`${theme.instructionBack} text-sm shrink-0 cursor-pointer ml-4`}>
                <ArrowLeft className="w-3 h-3 mr-1" /> Back
              </Button>
            </div>
          )}
          <iframe src={contractFinderUrl} className="flex-1 w-full border-0" title="Contract Finder" />
        </div>

        {/* NS Agent iframe */}
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", zIndex: step === "ns-agent" ? 20 : 10 }}>
          {step === "ns-agent" && (
            <div className={`${theme.instructionBar} px-6 py-3 flex items-center justify-between shrink-0`}>
              <div className="flex items-center gap-2">
                <Loader2 className={`w-4 h-4 ${theme.instructionIcon} shrink-0 animate-spin`} />
                <p className={`text-sm ${theme.instructionText}`}>
                  <strong>NS Agent is fetching NetSuite data.</strong> This will advance automatically when complete.
                </p>
              </div>
            </div>
          )}
          <iframe ref={nsIframeRef} src={nsAgent.url} className="flex-1 w-full border-0" title="NS Agent" />
        </div>

        {/* SF Agent iframe */}
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", zIndex: step === "sf-agent" ? 20 : 10 }}>
          {step === "sf-agent" && (
            <div className={`${theme.instructionBar} px-6 py-3 flex items-center justify-between shrink-0`}>
              <div className="flex items-center gap-2">
                <Loader2 className={`w-4 h-4 ${theme.instructionIcon} shrink-0 animate-spin`} />
                <p className={`text-sm ${theme.instructionText}`}>
                  <strong>SF Agent is fetching Salesforce data.</strong> This will advance automatically when complete.
                </p>
              </div>
            </div>
          )}
          <iframe ref={sfIframeRef} src={sfAgentUrl} className="flex-1 w-full border-0" title="SF Agent" />
        </div>

        {/* Opp Prep AI iframe */}
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", zIndex: step === "opp-prep-ai" ? 20 : 10 }}>
          {step === "opp-prep-ai" && (
            <div className={`${theme.instructionBar} px-6 py-3 flex items-center justify-between shrink-0`}>
              <div className="flex items-center gap-2">
                <AlertCircle className={`w-4 h-4 ${theme.instructionIcon} shrink-0`} />
                <p className={`text-sm ${theme.instructionText}`}>
                  <strong>Review the analysis below.</strong> When all data is verified and ready, click <strong>Confirm & Done</strong>.
                </p>
              </div>
              <Button onClick={() => setStep("done")} variant="ghost"
                className={`${theme.instructionBack} text-sm shrink-0 cursor-pointer ml-4`}>
                Confirm & Done <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
          )}
          <iframe src={oppPrepAIUrl} className="flex-1 w-full border-0" title="Opp Prep AI" />
        </div>

        {/* Overlay for non-iframe steps */}
        {(step === "opp-input" || step === "done") && (
          <div className="absolute inset-0 bg-gray-50 overflow-auto flex flex-col" style={{ zIndex: 30 }}>

            {/* Step 1: Opp Name */}
            {step === "opp-input" && (
              <div className="flex flex-col items-center justify-center flex-1 px-6 py-12">
                <div className="w-full max-w-lg bg-white border border-gray-200 rounded-xl shadow-sm p-8 space-y-5">
                  <div>
                    <Badge className={`${theme.stepBadge} mb-3`}>Step 1 of 6</Badge>
                    <h2 className="text-xl font-bold text-gray-900">Enter the Opportunity Name</h2>
                    <p className="text-sm text-gray-500 mt-1">
                      After selecting the contract, the pipeline will run automatically through NS Agent, SF Agent, and Opp Prep AI.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Opportunity Name</label>
                    <input
                      type="text"
                      value={oppName}
                      onChange={(e) => { setOppName(e.target.value); setOppNameError("") }}
                      onKeyDown={(e) => e.key === "Enter" && handleOppNameSubmit()}
                      placeholder="e.g. OpGroen Verzekeringen B.V. - ACRM - Renewal - 1655497 - 1_2027"
                      className={`w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none ${theme.inputFocus} transition-colors`}
                      autoFocus
                    />
                    {oppNameError && (
                      <p className="text-sm text-red-500 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> {oppNameError}
                      </p>
                    )}
                  </div>
                  <Button onClick={handleOppNameSubmit} className={`w-full cursor-pointer ${theme.btnPrimary}`}>
                    Find Contract <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {/* Done */}
            {step === "done" && (
              <div className="flex flex-col items-center justify-center flex-1 px-6 py-12">
                <div className="w-full max-w-lg bg-white border border-gray-200 rounded-xl shadow-sm p-8 space-y-5">
                  <div>
                    <Badge className="bg-green-100 text-green-700 border border-green-300 mb-3">Complete</Badge>
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <h2 className="text-xl font-bold text-gray-900">Workflow Complete</h2>
                    </div>
                    <p className="text-sm text-gray-500">
                      All agents have run and data has been reviewed. Salesforce has been updated by the user.
                    </p>
                  </div>

                  <Separator className="bg-gray-100" />

                  <div className="space-y-2">
                    {[
                      { label: "Contract Finder", sub: contractData?.contractTitle },
                      { label: "NS Agent",        sub: oppName },
                      { label: "SF Agent",        sub: oppName },
                      { label: "Opp Prep AI",     sub: "Analysis complete — data posted to SF" },
                    ].map((item, i) => (
                      <div key={i} className="rounded-lg p-3 flex items-center gap-2 border bg-green-50 border-green-200">
                        <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-green-800">{item.label}</p>
                          {item.sub && <p className="text-xs text-green-600 truncate">{item.sub}</p>}
                        </div>
                      </div>
                    ))}
                  </div>

                  <Separator className="bg-gray-100" />

                  <Button onClick={resetWorkflow} variant="outline"
                    className="w-full cursor-pointer border-purple-300 text-purple-700 hover:bg-purple-50">
                    Run Another Opportunity
                  </Button>
                  <Link href="/">
                    <Button variant="ghost" className="w-full text-gray-400 hover:text-gray-700 cursor-pointer">
                      <ArrowLeft className="w-3 h-3 mr-2" /> Back to Dashboard
                    </Button>
                  </Link>
                </div>
              </div>
            )}

          </div>
        )}

      </div>
    </main>
  )
}
