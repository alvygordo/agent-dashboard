"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { getAgent } from "@/lib/agents"
import { theme } from "@/lib/theme"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ArrowRight, ArrowLeft, Bot, CheckCircle, AlertCircle } from "lucide-react"

type Step = "opp-input" | "find-contract" | "ns-agent" | "summary"

type ContractData = {
  contractUrl: string
  contractTitle: string
  baseContractUrl: string
  baseContractTitle: string
  isPackage: boolean
  msaUrl: string
  msaTitle: string
  additionalDocs: { url: string; title: string }[]
}

type NSData = {
  oppName: string
  nsData: unknown
}

export default function OppPrepAutomationWorkflow() {
  const [step, setStep]               = useState<Step>("opp-input")
  const [oppName, setOppName]         = useState("")
  const [oppNameError, setOppNameError] = useState("")
  const [contractData, setContractData] = useState<ContractData | null>(null)
  const [nsData, setNsData]           = useState<NSData | null>(null)
  const nsIframeRef                   = useRef<HTMLIFrameElement>(null)

  const contractFinder = getAgent("contract-finder")!
  const nsAgent        = getAgent("ns-agent")!

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
      }
      setContractData(data)
      setStep("ns-agent")
    }

    if (event.data?.type === "ns-agent-result") {
      setNsData({ oppName: event.data.oppName, nsData: event.data.nsData })
      setStep("summary")
    }
  }, [])

  useEffect(() => {
    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [handleMessage])

  // Send handoff to NS Agent once its iframe is ready
  useEffect(() => {
    if (step !== "ns-agent" || !contractData) return
    const iframe = nsIframeRef.current
    if (!iframe) return

    function sendHandoff() {
      iframe!.contentWindow?.postMessage({
        type:            "dashboard-handoff",
        oppName,
        contractUrl:     contractData!.contractUrl,
        contractTitle:   contractData!.contractTitle,
        isPackage:       contractData!.isPackage,
        baseContractUrl: contractData!.baseContractUrl,
        msaUrl:          contractData!.msaUrl,
        additionalDocs:  contractData!.additionalDocs,
      }, "*")
    }

    // Send on load in case iframe hasn't loaded yet
    iframe.addEventListener("load", sendHandoff)
    // Also send immediately in case iframe is already loaded (back-navigation)
    sendHandoff()
    return () => iframe.removeEventListener("load", sendHandoff)
  }, [step, contractData, oppName])

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
  }

  const contractFinderUrl = `${contractFinder.url}?source=agent-dashboard&opp=${encodeURIComponent(oppName)}`
  const stepIndex = { "opp-input": 0, "find-contract": 1, "ns-agent": 2, "summary": 3 }[step]

  const steps: { label: string; stepName: Step }[] = [
    { label: "Enter Opportunity", stepName: "opp-input" },
    { label: "Find Contract",     stepName: "find-contract" },
    { label: "NS Agent",          stepName: "ns-agent" },
    { label: "Summary",           stepName: "summary" },
  ]

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col relative">

      {!theme.isProd && (
        <div className="bg-purple-700 text-white text-center py-2 px-4 text-sm font-medium tracking-wide shrink-0">
          ⚠️ SANDBOX ENVIRONMENT — For testing purposes only
        </div>
      )}

      {/* Header */}
      <div className={`${theme.headerBg} shrink-0`}>
        <div className="max-w-full px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg ${theme.avatarBg} flex items-center justify-center`}>
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className={`text-base font-semibold ${theme.headerText}`}>Agent Dashboard</h1>
              <p className={`text-xs ${theme.headerSub}`}>Opp Prep Automation</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {theme.isProd && (
              <span className={theme.envHeaderBadge!}>{theme.envHeaderBadgeText}</span>
            )}
            <Link href="/">
              <Button variant="ghost" className={`${theme.ghostBtn} text-sm cursor-pointer`}>
                <ArrowLeft className="w-3 h-3 mr-1" /> Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="border-b border-gray-200 bg-white shrink-0">
        <div className="px-6 py-3 flex items-center gap-4">
          {steps.map((s, i) => {
            const isActive = stepIndex === i
            const isDone   = stepIndex > i
            return (
              <div key={i} className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors
                    ${isDone ? "bg-green-500 text-white" : isActive ? theme.stepActive : "bg-gray-200 text-gray-400"}`}>
                    {isDone ? "✓" : i + 1}
                  </div>
                  {isDone ? (
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

      {/* Content area */}
      <div className="relative flex-1 min-h-0 flex flex-col">

        {/* Contract Finder — always mounted */}
        <div className="absolute inset-0 flex flex-col">
          {step === "find-contract" && (
            <div className={`${theme.instructionBar} px-6 py-3 flex items-center justify-between shrink-0`}>
              <div className="flex items-center gap-2">
                <AlertCircle className={`w-4 h-4 ${theme.instructionIcon} shrink-0`} />
                <p className={`text-sm ${theme.instructionText}`}>
                  <strong>Review the results below.</strong> When you find the correct contract, click <strong>✓ Use this contract</strong>.
                </p>
              </div>
              <Button onClick={() => setStep("opp-input")} variant="ghost"
                className={`${theme.instructionBack} text-sm shrink-0 cursor-pointer ml-4`}>
                <ArrowLeft className="w-3 h-3 mr-1" /> Back
              </Button>
            </div>
          )}
          <iframe
            src={contractFinderUrl}
            className="flex-1 w-full border-0"
            title="Contract Finder"
          />
        </div>

        {/* NS Agent — always mounted, sends postMessage on activation */}
        <div className={`absolute inset-0 flex flex-col ${step === "ns-agent" ? "" : "hidden"}`}>
          {step === "ns-agent" && (
            <div className={`${theme.instructionBar} px-6 py-3 flex items-center justify-between shrink-0`}>
              <div className="flex items-center gap-2">
                <AlertCircle className={`w-4 h-4 ${theme.instructionIcon} shrink-0`} />
                <p className={`text-sm ${theme.instructionText}`}>
                  <strong>NS Agent is looking up NetSuite data.</strong> When results appear, click <strong>✓ Use this data</strong>.
                </p>
              </div>
              <Button onClick={() => setStep("find-contract")} variant="ghost"
                className={`${theme.instructionBack} text-sm shrink-0 cursor-pointer ml-4`}>
                <ArrowLeft className="w-3 h-3 mr-1" /> Back
              </Button>
            </div>
          )}
          <iframe
            ref={nsIframeRef}
            src={nsAgent.url}
            className="flex-1 w-full border-0"
            title="NS Agent"
          />
        </div>

        {/* Overlay for steps 1 and 4 */}
        {(step === "opp-input" || step === "summary") && (
          <div className="absolute inset-0 bg-gray-50 overflow-auto flex flex-col">

            {/* ── STEP 1: OPP NAME ── */}
            {step === "opp-input" && (
              <div className="flex flex-col items-center justify-center flex-1 px-6 py-12">
                <div className="w-full max-w-lg bg-white border border-gray-200 rounded-xl shadow-sm p-8 space-y-5">
                  <div>
                    <Badge className={`${theme.stepBadge} mb-3`}>Step 1 of 4</Badge>
                    <h2 className="text-xl font-bold text-gray-900">Enter the Opportunity Name</h2>
                    <p className="text-sm text-gray-500 mt-1">
                      This will be used across all agents in the workflow automatically.
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

            {/* ── STEP 4: SUMMARY ── */}
            {step === "summary" && (
              <div className="flex flex-col items-center justify-center flex-1 px-6 py-12">
                <div className="w-full max-w-lg bg-white border border-gray-200 rounded-xl shadow-sm p-8 space-y-5">
                  <div>
                    <Badge className="bg-green-100 text-green-700 border border-green-300 mb-3">Step 4 of 4</Badge>
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <h2 className="text-xl font-bold text-gray-900">Data Collected</h2>
                    </div>
                    <p className="text-sm text-gray-500">
                      Contract and NetSuite data have been gathered. Additional agents coming soon.
                    </p>
                  </div>

                  <Separator className="bg-gray-100" />

                  <div className="space-y-3">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-green-800">Contract Found</p>
                        {contractData?.contractTitle && (
                          <p className="text-xs text-green-600 truncate">{contractData.contractTitle}</p>
                        )}
                      </div>
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-green-800">NS Data Extracted</p>
                        <p className="text-xs text-green-600">{oppName}</p>
                      </div>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex items-center gap-2 opacity-50">
                      <div className="w-4 h-4 rounded-full border-2 border-gray-300 shrink-0" />
                      <p className="text-sm text-gray-500">Contract Analyzer — coming soon</p>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex items-center gap-2 opacity-50">
                      <div className="w-4 h-4 rounded-full border-2 border-gray-300 shrink-0" />
                      <p className="text-sm text-gray-500">SF Data Extractor — coming soon</p>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex items-center gap-2 opacity-50">
                      <div className="w-4 h-4 rounded-full border-2 border-gray-300 shrink-0" />
                      <p className="text-sm text-gray-500">Comparison & Summary — coming soon</p>
                    </div>
                  </div>

                  <Separator className="bg-gray-100" />

                  <Button onClick={resetWorkflow} variant="outline"
                    className={`w-full cursor-pointer ${theme.isProd ? "border-[#00b4a2] text-[#009688] hover:bg-[#e0f7f5]" : "border-purple-300 text-purple-700 hover:bg-purple-50"}`}>
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
