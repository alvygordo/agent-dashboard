"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { getAgent, GEM_URLS } from "@/lib/agents"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ArrowRight, ArrowLeft, Bot, CheckCircle, ExternalLink, Copy, Check, AlertCircle } from "lucide-react"

type Step = "opp-input" | "find-contract" | "handoff"

export default function ContractToOppWorkflow() {
  const [step, setStep]                       = useState<Step>("opp-input")
  const [oppName, setOppName]                 = useState("")
  const [oppNameError, setOppNameError]       = useState("")
  const [contractUrl, setContractUrl]         = useState("")
  const [contractTitle, setContractTitle]     = useState("")
  const [baseContractUrl, setBaseContractUrl] = useState("")
  const [baseContractTitle, setBaseContractTitle] = useState("")
  const [isPackage, setIsPackage]             = useState(false)
  const [msaUrl, setMsaUrl]                   = useState("")
  const [msaTitle, setMsaTitle]               = useState("")
  const [copiedOpp, setCopiedOpp]             = useState(false)
  const [copiedContract, setCopiedContract]   = useState(false)
  const [copiedBase, setCopiedBase]           = useState(false)
  const [iframeLoaded, setIframeLoaded]       = useState(false)

  const contractFinder = getAgent("contract-finder")!
  const oppPrep        = getAgent("opp-prep-ai")!

  // Listen for the contract result sent from the embedded Contract Finder.
  // Forwards the full payload to the next agent so swapping agents requires no changes here.
  const handleMessage = useCallback((event: MessageEvent) => {
    if (event.data?.type === "contract-finder-result") {
      setContractUrl(event.data.contractUrl ?? "")
      setContractTitle(event.data.title ?? "")
      setBaseContractUrl(event.data.baseContractUrl ?? "")
      setBaseContractTitle(event.data.baseContractTitle ?? "")
      setIsPackage(event.data.isPackage === true)
      setMsaUrl(event.data.msaUrl ?? "")
      setMsaTitle(event.data.msaTitle ?? "")
      setStep("handoff")
    }
  }, [])

  useEffect(() => {
    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [handleMessage])

  function handleOppNameSubmit() {
    if (!oppName.trim()) {
      setOppNameError("Please enter the opportunity name before continuing.")
      return
    }
    setOppNameError("")
    setIframeLoaded(false)
    setStep("find-contract")
  }

  function copyToClipboard(text: string, type: "opp" | "contract" | "base") {
    navigator.clipboard.writeText(text)
    if (type === "opp")      { setCopiedOpp(true);      setTimeout(() => setCopiedOpp(false), 2000) }
    else if (type === "base"){ setCopiedBase(true);     setTimeout(() => setCopiedBase(false), 2000) }
    else                     { setCopiedContract(true); setTimeout(() => setCopiedContract(false), 2000) }
  }

  function resetWorkflow() {
    setStep("opp-input")
    setOppName("")
    setContractUrl("")
    setContractTitle("")
    setBaseContractUrl("")
    setBaseContractTitle("")
    setIsPackage(false)
    setMsaUrl("")
    setMsaTitle("")
  }

  const contractFinderUrl = `${contractFinder.url}?source=agent-dashboard&opp=${encodeURIComponent(oppName)}`

  // Build next-agent URL — always passes contract; adds baseContract when it's a package.
  // No hardcoded Opp Prep AI logic: just forward whatever Contract Finder sent.
  const nextAgentUrl = (() => {
    if (!contractUrl) return oppPrep.url
    const params = new URLSearchParams({ opp: oppName, contract: contractUrl })
    if (isPackage && baseContractUrl) params.set("baseContract", baseContractUrl)
    return `${oppPrep.url}?${params.toString()}`
  })()

  const stepIndex = { "opp-input": 0, "find-contract": 1, "handoff": 2 }[step]

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col">

      {/* Sandbox Banner */}
      <div className="bg-purple-700 text-white text-center py-2 px-4 text-sm font-medium tracking-wide shrink-0">
        ⚠️ SANDBOX ENVIRONMENT — For testing purposes only
      </div>

      {/* Header */}
      <div className="border-b border-gray-200 bg-white shadow-sm shrink-0">
        <div className="max-w-full px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-700 flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-gray-900">Agent Dashboard</h1>
              <p className="text-xs text-gray-500">Contract → Opp Prep Workflow</p>
            </div>
          </div>
          <Link href="/">
            <Button variant="ghost" className="text-gray-500 hover:text-gray-900 text-sm cursor-pointer">
              <ArrowLeft className="w-3 h-3 mr-1" /> Dashboard
            </Button>
          </Link>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="border-b border-gray-200 bg-white shrink-0">
        <div className="px-6 py-3 flex items-center gap-4">
          {[
            { label: "Enter Opportunity" },
            { label: "Find Contract" },
            { label: "Opp Prep AI" },
          ].map((s, i) => {
            const isActive = stepIndex === i
            const isDone   = stepIndex > i
            return (
              <div key={i} className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors
                    ${isDone ? "bg-green-500 text-white" : isActive ? "bg-purple-700 text-white" : "bg-gray-200 text-gray-400"}`}>
                    {isDone ? "✓" : i + 1}
                  </div>
                  <span className={`text-sm ${isActive ? "text-gray-900 font-medium" : isDone ? "text-green-600" : "text-gray-400"}`}>
                    {s.label}
                  </span>
                </div>
                {i < 2 && <ArrowRight className="w-3 h-3 text-gray-300" />}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── STEP 1: OPP NAME ── */}
      {step === "opp-input" && (
        <div className="flex flex-col items-center justify-center flex-1 px-6 py-12">
          <div className="w-full max-w-lg bg-white border border-gray-200 rounded-xl shadow-sm p-8 space-y-5">
            <div>
              <Badge className="bg-purple-100 text-purple-700 border border-purple-300 mb-3">Step 1 of 3</Badge>
              <h2 className="text-xl font-bold text-gray-900">Enter the Opportunity Name</h2>
              <p className="text-sm text-gray-500 mt-1">
                Type the full Salesforce opportunity name. It will be pre-filled in Contract Finder automatically.
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
                className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:border-purple-500 transition-colors"
                autoFocus
              />
              {oppNameError && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {oppNameError}
                </p>
              )}
            </div>
            <Button
              onClick={handleOppNameSubmit}
              className="w-full bg-purple-700 hover:bg-purple-800 text-white cursor-pointer"
            >
              Open Contract Finder <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 2: CONTRACT FINDER EMBEDDED ── */}
      {step === "find-contract" && (
        <div className="flex flex-col flex-1 min-h-0">
          {/* Instruction bar */}
          <div className="bg-blue-50 border-b border-blue-200 px-6 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-blue-600 shrink-0" />
              <p className="text-sm text-blue-800">
                <strong>Review the results below.</strong> When you find the correct contract, click <strong>✓ Use this contract</strong> — it will be sent to the dashboard automatically.
              </p>
            </div>
            <Button
              onClick={() => setStep("opp-input")}
              variant="ghost"
              className="text-blue-600 hover:text-blue-800 text-sm shrink-0 cursor-pointer ml-4"
            >
              <ArrowLeft className="w-3 h-3 mr-1" /> Back
            </Button>
          </div>

          {/* Loading overlay */}
          {!iframeLoaded && (
            <div className="flex items-center justify-center py-16 text-gray-400 text-sm shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-purple-300 border-t-purple-700 rounded-full animate-spin" />
                Loading Contract Finder…
              </div>
            </div>
          )}

          {/* Iframe */}
          <iframe
            src={contractFinderUrl}
            onLoad={() => setIframeLoaded(true)}
            className={`flex-1 w-full border-0 transition-opacity ${iframeLoaded ? "opacity-100" : "opacity-0 h-0"}`}
            title="Contract Finder"
          />
        </div>
      )}

      {/* ── STEP 3: HANDOFF ── */}
      {step === "handoff" && (
        <div className="flex flex-col items-center justify-center flex-1 px-6 py-12">
          <div className="w-full max-w-lg bg-white border border-gray-200 rounded-xl shadow-sm p-8 space-y-5">

            <div>
              <Badge className="bg-green-100 text-green-700 border border-green-300 mb-3">Step 3 of 3</Badge>
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <h2 className="text-xl font-bold text-gray-900">
                  {isPackage ? "Contract Package Confirmed" : "Contract Confirmed"}
                </h2>
              </div>
              <p className="text-sm text-gray-500">
                {isPackage
                  ? "An amendment + base contract were found. Both will be sent to Opp Prep AI automatically."
                  : "Copy both details below, then launch Opp Prep AI. Paste each value into the matching field."}
              </p>
            </div>

            <Separator className="bg-gray-100" />

            {/* Opp name */}
            <div className="space-y-1">
              <p className="text-xs text-gray-400 uppercase tracking-widest font-medium">1 — Opportunity Name</p>
              <p className="text-xs text-gray-400">Paste into: <em>Search Salesforce Opportunity</em></p>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex items-center justify-between gap-3">
                <p className="text-sm text-gray-900 font-medium truncate">{oppName}</p>
                <button
                  onClick={() => copyToClipboard(oppName, "opp")}
                  className="shrink-0 flex items-center gap-1.5 text-xs bg-white border border-gray-300 text-gray-600 hover:bg-purple-50 hover:border-purple-400 hover:text-purple-700 rounded-md px-3 py-1.5 transition-colors cursor-pointer font-medium"
                >
                  {copiedOpp ? <><Check className="w-3 h-3 text-green-600" /> Copied!</> : <><Copy className="w-3 h-3" /> Copy</>}
                </button>
              </div>
            </div>

            {/* Amendment (primary contract) */}
            <div className="space-y-1">
              <p className="text-xs text-gray-400 uppercase tracking-widest font-medium">
                {isPackage ? "2 — Amendment (overrides)" : "2 — Contract Link"}
              </p>
              <p className="text-xs text-gray-400">Paste into: <em>Salesforce Document Links</em></p>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
                {contractTitle && (
                  <p className="text-xs text-gray-600 font-medium leading-snug">{contractTitle}</p>
                )}
                <div className="flex items-center justify-between gap-3">
                  <a href={contractUrl} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-purple-600 hover:text-purple-800 flex items-center gap-1 truncate">
                    <span className="truncate">View document ↗</span>
                  </a>
                  <button
                    onClick={() => copyToClipboard(contractUrl, "contract")}
                    className="shrink-0 flex items-center gap-1.5 text-xs bg-white border border-gray-300 text-gray-600 hover:bg-purple-50 hover:border-purple-400 hover:text-purple-700 rounded-md px-3 py-1.5 transition-colors cursor-pointer font-medium"
                  >
                    {copiedContract ? <><Check className="w-3 h-3 text-green-600" /> Copied!</> : <><Copy className="w-3 h-3" /> Copy</>}
                  </button>
                </div>
              </div>
            </div>

            {/* Base contract — only shown when it's a package */}
            {isPackage && baseContractUrl && (
              <div className="space-y-1">
                <p className="text-xs text-gray-400 uppercase tracking-widest font-medium">3 — Base Contract (full terms)</p>
                <p className="text-xs text-gray-400">Used by Opp Prep AI as the source of base terms</p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
                  {baseContractTitle && (
                    <p className="text-xs text-gray-600 font-medium leading-snug">{baseContractTitle}</p>
                  )}
                  <div className="flex items-center justify-between gap-3">
                    <a href={baseContractUrl} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 truncate">
                      <span className="truncate">View document ↗</span>
                    </a>
                    <button
                      onClick={() => copyToClipboard(baseContractUrl, "base")}
                      className="shrink-0 flex items-center gap-1.5 text-xs bg-white border border-gray-300 text-gray-600 hover:bg-blue-50 hover:border-blue-400 hover:text-blue-700 rounded-md px-3 py-1.5 transition-colors cursor-pointer font-medium"
                    >
                      {copiedBase ? <><Check className="w-3 h-3 text-green-600" /> Copied!</> : <><Copy className="w-3 h-3" /> Copy</>}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <a href={nextAgentUrl} target="_blank" rel="noopener noreferrer">
              <Button className="w-full bg-purple-700 hover:bg-purple-800 text-white py-5 text-base cursor-pointer">
                Launch Opp Prep AI <ExternalLink className="w-4 h-4 ml-2" />
              </Button>
            </a>

            <Separator className="bg-gray-100" />

            {/* Generate Contract Report section */}
            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-gray-800">Generate Contract Report</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Download the documents below, then upload them to the Contract Report Generator Gem to produce a full PDF report.
                </p>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
                {/* Amendment / contract */}
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">
                      {isPackage ? "Amendment" : "Contract"}
                    </p>
                    {contractTitle && <p className="text-xs text-gray-700 truncate">{contractTitle}</p>}
                  </div>
                  <a href={contractUrl} target="_blank" rel="noopener noreferrer"
                    className="shrink-0 text-xs text-purple-600 hover:text-purple-800 flex items-center gap-1 font-medium">
                    View ↗
                  </a>
                </div>
                {/* Base contract */}
                {isPackage && baseContractUrl && (
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-200">
                    <div className="min-w-0">
                      <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Base Contract</p>
                      {baseContractTitle && <p className="text-xs text-gray-700 truncate">{baseContractTitle}</p>}
                    </div>
                    <a href={baseContractUrl} target="_blank" rel="noopener noreferrer"
                      className="shrink-0 text-xs text-purple-600 hover:text-purple-800 flex items-center gap-1 font-medium">
                      View ↗
                    </a>
                  </div>
                )}
                {/* MSA */}
                {msaUrl && (
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-200">
                    <div className="min-w-0">
                      <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">MSA</p>
                      {msaTitle && <p className="text-xs text-gray-700 truncate">{msaTitle}</p>}
                    </div>
                    <a href={msaUrl} target="_blank" rel="noopener noreferrer"
                      className="shrink-0 text-xs text-purple-600 hover:text-purple-800 flex items-center gap-1 font-medium">
                      View ↗
                    </a>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const urls = [contractUrl, isPackage && baseContractUrl, msaUrl].filter(Boolean) as string[]
                    urls.forEach(u => window.open(u, "_blank", "noopener,noreferrer"))
                  }}
                  className="flex-1 text-xs bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg px-3 py-2 font-medium transition-colors cursor-pointer"
                >
                  Open All in Salesforce ↗
                </button>
                <a
                  href={GEM_URLS.contractReport}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-3 py-2 font-medium transition-colors text-center"
                >
                  Open Contract Report Gem ↗
                </a>
              </div>
            </div>

            <Separator className="bg-gray-100" />

            <Button
              onClick={resetWorkflow}
              variant="outline"
              className="w-full border-purple-300 text-purple-700 hover:bg-purple-50 cursor-pointer"
            >
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

    </main>
  )
}
