"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { getAgent, GEM_URLS } from "@/lib/agents"
import { theme } from "@/lib/theme"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ArrowRight, ArrowLeft, Bot, CheckCircle, ExternalLink, Copy, Check, AlertCircle } from "lucide-react"

type Step = "opp-input" | "find-contract" | "handoff" | "gem"

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
  const [additionalDocs, setAdditionalDocs]   = useState<{url: string, title: string}[]>([])
  const [copiedOpp, setCopiedOpp]             = useState(false)
  const [copiedContract, setCopiedContract]   = useState(false)
  const [copiedBase, setCopiedBase]           = useState(false)
  const [embedToken, setEmbedToken]           = useState<{ email: string; token: string } | null>(null)

  const contractFinder = getAgent("contract-finder")!
  const oppPrep        = getAgent("opp-prep-ai")!

  useEffect(() => {
    fetch('/api/embed-token')
      .then(r => r.json())
      .then(d => { if (d.token) setEmbedToken(d) })
      .catch(() => {})
  }, [])

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
      setAdditionalDocs(Array.isArray(event.data.additionalDocs) ? event.data.additionalDocs : [])
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
    setAdditionalDocs([])
  }

  const contractFinderUrl = embedToken
    ? `${contractFinder.url}?source=agent-dashboard&opp=${encodeURIComponent(oppName)}&u=${encodeURIComponent(embedToken.email)}&t=${embedToken.token}`
    : `${contractFinder.url}?source=agent-dashboard&opp=${encodeURIComponent(oppName)}`

  // Build next-agent URL — always passes contract; adds baseContract when it's a package.
  // No hardcoded Opp Prep AI logic: just forward whatever Contract Finder sent.
  const nextAgentUrl = (() => {
    if (!contractUrl) return oppPrep.url
    const params = new URLSearchParams({ opp: oppName, contract: contractUrl })
    if (isPackage && baseContractUrl) params.set("baseContract", baseContractUrl)
    return `${oppPrep.url}?${params.toString()}`
  })()

  const stepIndex = { "opp-input": 0, "find-contract": 1, "handoff": 2, "gem": 3 }[step]

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col relative">

      {/* Sandbox Banner — hidden in production */}
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
              <p className={`text-xs ${theme.headerSub}`}>Opp Prep Assistant</p>
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
          {([
            { label: "Enter Opportunity", stepName: "opp-input" },
            { label: "Find Contract",     stepName: "find-contract" },
            { label: "Opp Prep AI",       stepName: "handoff" },
            { label: "Contract Report Gem", stepName: "gem" },
          ] as { label: string; stepName: Step }[]).map((s, i) => {
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
                {i < 3 && <ArrowRight className="w-3 h-3 text-gray-300" />}
              </div>
            )
          })}
        </div>
      </div>

      {/* Content area — iframe always mounted in background, other steps overlay it */}
      <div className="relative flex-1 min-h-0 flex flex-col">

      {/* ── STEP 2: CONTRACT FINDER (permanent background layer) ── */}
      <div className="absolute inset-0 flex flex-col">
        {/* Instruction bar — only shown on step 2 */}
        {step === "find-contract" && (
          <div className={`${theme.instructionBar} px-6 py-3 flex items-center justify-between shrink-0`}>
            <div className="flex items-center gap-2">
              <AlertCircle className={`w-4 h-4 ${theme.instructionIcon} shrink-0`} />
              <p className={`text-sm ${theme.instructionText}`}>
                <strong>Review the results below.</strong> When you find the correct contract, click <strong>✓ Use this contract</strong> — it will be sent to the dashboard automatically.
              </p>
            </div>
            <Button
              onClick={() => setStep("opp-input")}
              variant="ghost"
              className={`${theme.instructionBack} text-sm shrink-0 cursor-pointer ml-4`}
            >
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

      {/* Overlay for steps 1, 3, 4 — covers the iframe with a solid background */}
      {step !== "find-contract" && (
        <div className="absolute inset-0 bg-gray-50 overflow-auto flex flex-col">

      {/* ── STEP 1: OPP NAME ── */}
      {step === "opp-input" && (
        <div className="flex flex-col items-center justify-center flex-1 px-6 py-12">
          <div className="w-full max-w-lg bg-white border border-gray-200 rounded-xl shadow-sm p-8 space-y-5">
            <div>
              <Badge className={`${theme.stepBadge} mb-3`}>Step 1 of 3</Badge>
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
                className={`w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none ${theme.inputFocus} transition-colors`}
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
              className={`w-full cursor-pointer ${theme.btnPrimary}`}
            >
              Open Contract Finder <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
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
                  className="shrink-0 flex items-center gap-1.5 text-xs bg-white border border-gray-300 text-gray-600 hover:bg-[#e0f7f5] hover:border-[#00b4a2] hover:text-[#009688] rounded-md px-3 py-1.5 transition-colors cursor-pointer font-medium"
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
                    className="text-xs text-[#00b4a2] hover:text-[#009688] flex items-center gap-1 truncate">
                    <span className="truncate">View document ↗</span>
                  </a>
                  <button
                    onClick={() => copyToClipboard(contractUrl, "contract")}
                    className="shrink-0 flex items-center gap-1.5 text-xs bg-white border border-gray-300 text-gray-600 hover:bg-[#e0f7f5] hover:border-[#00b4a2] hover:text-[#009688] rounded-md px-3 py-1.5 transition-colors cursor-pointer font-medium"
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
                <div className="bg-[#e0f7f5] border border-[#b2e8e2] rounded-lg p-3 space-y-2">
                  {baseContractTitle && (
                    <p className="text-xs text-gray-600 font-medium leading-snug">{baseContractTitle}</p>
                  )}
                  <div className="flex items-center justify-between gap-3">
                    <a href={baseContractUrl} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-[#00b4a2] hover:text-[#009688] flex items-center gap-1 truncate">
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
              <Button className={`w-full py-5 text-base cursor-pointer ${theme.btnPrimary}`}>
                Launch Opp Prep AI <ExternalLink className="w-4 h-4 ml-2" />
              </Button>
            </a>

            <Button
              onClick={() => setStep("gem")}
              variant="outline"
              className={`w-full cursor-pointer ${theme.isProd ? "border-[#00b4a2] text-[#009688] hover:bg-[#e0f7f5]" : "border-purple-300 text-purple-700 hover:bg-purple-50"}`}
            >
              Continue to Step 4: Contract Report Gem <ArrowRight className="w-4 h-4 ml-2" />
            </Button>

            <Separator className="bg-gray-100" />

            <Button
              onClick={resetWorkflow}
              variant="outline"
              className={`w-full cursor-pointer ${theme.isProd ? "border-[#00b4a2] text-[#009688] hover:bg-[#e0f7f5]" : "border-purple-300 text-purple-700 hover:bg-purple-50"}`}
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

      {/* ── STEP 4: CONTRACT REPORT GEM ── */}
      {step === "gem" && (
        <div className="flex flex-col items-center justify-center flex-1 px-6 py-12">
          <div className="w-full max-w-lg bg-white border border-gray-200 rounded-xl shadow-sm p-8 space-y-5">

            <div>
              <Badge className={`${theme.stepBadge} mb-3`}>Step 4 of 4</Badge>
              <h2 className="text-xl font-bold text-gray-900">Generate Contract Report</h2>
              <p className="text-sm text-gray-500 mt-1">
                Open each document below to download it from Salesforce, then upload them to the Contract Report Generator Gem.
              </p>
            </div>

            <Separator className="bg-gray-100" />

            {/* Document links */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">
                    {isPackage ? "Amendment" : "Contract"}
                  </p>
                  {contractTitle && <p className="text-xs text-gray-700 truncate">{contractTitle}</p>}
                </div>
                <a href={contractUrl} target="_blank" rel="noopener noreferrer"
                  className="shrink-0 text-xs text-[#00b4a2] hover:text-[#009688] font-medium">
                  View ↗
                </a>
              </div>
              {isPackage && baseContractUrl && (
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-200">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Base Contract</p>
                    {baseContractTitle && <p className="text-xs text-gray-700 truncate">{baseContractTitle}</p>}
                  </div>
                  <a href={baseContractUrl} target="_blank" rel="noopener noreferrer"
                    className="shrink-0 text-xs text-[#00b4a2] hover:text-[#009688] font-medium">
                    View ↗
                  </a>
                </div>
              )}
              {msaUrl && (
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-200">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">MSA</p>
                    {msaTitle && <p className="text-xs text-gray-700 truncate">{msaTitle}</p>}
                  </div>
                  <a href={msaUrl} target="_blank" rel="noopener noreferrer"
                    className="shrink-0 text-xs text-[#00b4a2] hover:text-[#009688] font-medium">
                    View ↗
                  </a>
                </div>
              )}
              {additionalDocs.map((doc, i) => (
                <div key={i} className="flex items-center justify-between gap-2 pt-1 border-t border-gray-200">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Additional Doc {i + 1}</p>
                    {doc.title && <p className="text-xs text-gray-700 truncate">{doc.title}</p>}
                  </div>
                  <a href={doc.url} target="_blank" rel="noopener noreferrer"
                    className="shrink-0 text-xs text-[#00b4a2] hover:text-[#009688] font-medium">
                    View ↗
                  </a>
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                const urls = [contractUrl, isPackage && baseContractUrl, msaUrl, ...additionalDocs.map(d => d.url)].filter(Boolean) as string[]
                urls.forEach((u, i) => setTimeout(() => window.open(u, "_blank", "noopener,noreferrer"), i * 300))
              }}
              className="w-full text-sm bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg px-3 py-2 font-medium transition-colors cursor-pointer"
            >
              Open All to Download ↗
            </button>

            <a href={GEM_URLS.contractReport} target="_blank" rel="noopener noreferrer">
              <Button className={`w-full py-5 text-base cursor-pointer ${theme.btnPrimary}`}>
                Open Contract Report Gem <ExternalLink className="w-4 h-4 ml-2" />
              </Button>
            </a>

            <Separator className="bg-gray-100" />

            <Button
              onClick={resetWorkflow}
              variant="outline"
              className={`w-full cursor-pointer ${theme.isProd ? "border-[#00b4a2] text-[#009688] hover:bg-[#e0f7f5]" : "border-purple-300 text-purple-700 hover:bg-purple-50"}`}
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
        </div>
      )}
      </div>

    </main>
  )
}
