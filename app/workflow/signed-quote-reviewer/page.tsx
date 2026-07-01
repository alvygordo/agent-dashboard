"use client"

import { useState, useEffect, Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { theme } from "@/lib/theme"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { QuoteReviewAnalysisReport } from "@/components/quote-review-analysis-report"
import {
  fieldOrPlaceholder,
  formatContactLine,
  formatTermLabel,
  formatTermMonthsOnly,
  formatUsDate,
} from "@/lib/sf-field-format"
import { buildQuoteReviewAnalysis } from "@/lib/quote-review-analysis"
import { findHelpCenterForProduct, formatFulfillmentLine } from "@/lib/product-help-centers"
import {
  ArrowRight,
  ArrowLeft,
  Bot,
  AlertCircle,
  Loader2,
  Copy,
  Check,
  ExternalLink,
} from "lucide-react"

type Step = "opp-input" | "documents" | "analysis" | "template"

type OppData = {
  id: string
  name: string
  stage: string | null
  accountName: string | null
  ownerName: string | null
  winType: string | null
  winTypeValid: boolean
  signedQuoteUrl: string | null
  purchaseOrderLink: string | null
  netSuiteSubLink: string | null
  product: string | null
  currentTerm: string | number | null
  currentArr: number | null
  renewalDate: string | null
  expiryDate: string | null
  autoRenewal: string | null
  supportPlan: string | null
  userCount: number | null
  primaryContact: { name: string; email: string | null; display?: string; isPrimary?: boolean } | null
  oppUrl: string
}

type DocLinks = {
  unsignedQuoteUrl: string
  signedQuoteUrl: string
  purchaseOrderUrl: string
}

const STEPS: { stepName: Step; label: string }[] = [
  { stepName: "opp-input", label: "Opportunity" },
  { stepName: "documents", label: "Documents" },
  { stepName: "analysis", label: "Analysis & flags" },
  { stepName: "template", label: "Provisioning template" },
]

const STEP_COUNT = STEPS.length

function buildProvisioningTemplate(opp: OppData, helpCenter: ReturnType<typeof findHelpCenterForProduct>): string {
  const endUser = opp.accountName ?? "[Insert End User Name]"
  const customer = opp.accountName ?? "[Insert Customer Name]"
  const months = formatTermMonthsOnly(opp.currentTerm)
  const termLabel = formatTermLabel(opp.currentTerm)
  const product = opp.product ?? "[Insert Product Name]"
  const contact = opp.primaryContact?.display ?? formatContactLine(opp.primaryContact)
  const nsLink = opp.netSuiteSubLink ?? "[Insert NetSuite Link]"
  const renewal = formatUsDate(opp.renewalDate)
  const expiry = formatUsDate(opp.expiryDate)
  const autoRenew = opp.autoRenewal ?? "[Insert Yes or No]"
  const supportPlan = fieldOrPlaceholder(opp.supportPlan, "[Insert Standard, Gold, or Platinum]")
  const userCount = opp.userCount != null && opp.userCount > 0
    ? String(opp.userCount)
    : "[Insert User/Seat Count]"
  const reason =
    opp.winType === "PO Received"
      ? `Customer is renewing for ${termLabel}`
      : `Customer signed the quote / is renewing for ${termLabel}`

  return [
    `${endUser} : ${months} months ${product} License Renewal`,
    "",
    `Customer Name: ${customer}`,
    `End user: ${endUser}`,
    `Netsuite subscription: ${nsLink}`,
    `Salesforce opportunity: ${opp.oppUrl}`,
    `Product: ${product}`,
    `Support plan: ${supportPlan}`,
    `Number of users: ${userCount}`,
    `Renewal Date: ${renewal}`,
    `Expiry Date: ${expiry}`,
    `Auto-Renewal: ${autoRenew}`,
    `Contact person: ${contact}`,
    "Reason for request:",
    reason,
    "",
    formatFulfillmentLine(helpCenter, product !== "[Insert Product Name]" ? product : opp.product),
  ].join("\n")
}

function SignedQuoteReviewerInner() {
  const searchParams = useSearchParams()
  const autoOpp = searchParams.get("opp")
  const autostart = searchParams.get("autostart") === "true"

  const [step, setStep] = useState<Step>("opp-input")
  const [oppQuery, setOppQuery] = useState(() => (autoOpp ? decodeURIComponent(autoOpp) : ""))
  const [oppData, setOppData] = useState<OppData | null>(null)
  const [oppMatches, setOppMatches] = useState<OppData[]>([])
  const [oppError, setOppError] = useState("")
  const [loading, setLoading] = useState(false)
  const [visitedSteps, setVisitedSteps] = useState<Set<Step>>(new Set(["opp-input"]))

  const [docs, setDocs] = useState<DocLinks>({
    unsignedQuoteUrl: "",
    signedQuoteUrl: "",
    purchaseOrderUrl: "",
  })
  const [docError, setDocError] = useState("")
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setVisitedSteps((prev) => new Set(prev).add(step))
  }, [step])

  async function fetchOpp(nameOrId?: string) {
    const query = (nameOrId ?? oppQuery).trim()
    if (!query) {
      setOppError("Enter an opportunity name or ID")
      return
    }
    setLoading(true)
    setOppError("")
    setOppMatches([])
    setOppData(null)

    const param = query.startsWith("006") ? `id=${encodeURIComponent(query)}` : `opp=${encodeURIComponent(query)}`
    try {
      const res = await fetch(`/api/sf-quote-review?${param}`)
      const data = await res.json()
      if (!res.ok) {
        setOppError(data.error ?? "Lookup failed")
        return
      }
      const opps: OppData[] = data.opportunities ?? []
      if (opps.length === 0) {
        setOppError("No matching opportunity found")
        return
      }
      if (opps.length === 1) {
        selectOpp(opps[0])
      } else {
        setOppMatches(opps)
      }
    } catch {
      setOppError("Could not reach Salesforce — try again")
    } finally {
      setLoading(false)
    }
  }

  function selectOpp(opp: OppData) {
    setOppData(opp)
    setOppMatches([])
    setDocs((prev) => ({
      unsignedQuoteUrl: prev.unsignedQuoteUrl,
      signedQuoteUrl: opp.signedQuoteUrl ?? prev.signedQuoteUrl,
      purchaseOrderUrl: opp.purchaseOrderLink ?? prev.purchaseOrderUrl,
    }))
    setStep("documents")
  }

  useEffect(() => {
    if (autoOpp && autostart) {
      fetchOpp(decodeURIComponent(autoOpp))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleDocumentsContinue() {
    if (!docs.unsignedQuoteUrl.trim() || !docs.signedQuoteUrl.trim()) {
      setDocError("Unsigned and signed quote links are required")
      return
    }
    setDocError("")
    setStep("analysis")
  }

  async function copyTemplate() {
    if (!oppData) return
    await navigator.clipboard.writeText(buildProvisioningTemplate(oppData, findHelpCenterForProduct(oppData.product)))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function startNewReview() {
    setStep("opp-input")
    setOppData(null)
    setOppQuery("")
    setDocs({ unsignedQuoteUrl: "", signedQuoteUrl: "", purchaseOrderUrl: "" })
  }

  const stepIndex = STEPS.findIndex((s) => s.stepName === step)
  const stepNumber = stepIndex + 1
  const analysis = oppData
    ? buildQuoteReviewAnalysis({
        winType: oppData.winType,
        winTypeValid: oppData.winTypeValid,
        supportPlan: oppData.supportPlan,
        userCount: oppData.userCount,
        renewalDate: oppData.renewalDate,
        expiryDate: oppData.expiryDate,
        primaryContactEmail: oppData.primaryContact?.email ?? null,
        unsignedQuoteUrl: docs.unsignedQuoteUrl,
        signedQuoteUrl: docs.signedQuoteUrl,
        purchaseOrderUrl: docs.purchaseOrderUrl,
      })
    : null
  const helpCenter = oppData ? findHelpCenterForProduct(oppData.product) : null
  const template = oppData ? buildProvisioningTemplate(oppData, helpCenter) : ""

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {theme.envBanner && (
        <div className={theme.envBanner}>{theme.envBannerText}</div>
      )}

      <div className={`${theme.headerBg} shrink-0`}>
        <div className="max-w-full px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg ${theme.avatarBg} flex items-center justify-center`}>
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className={`text-base font-semibold ${theme.headerText}`}>Agent Dashboard</h1>
              <p className={`text-xs ${theme.headerSub}`}>Signed Quote Reviewer</p>
            </div>
          </div>
          <Link href="/workflows">
            <Button variant="ghost" className={`${theme.ghostBtn} text-sm cursor-pointer`}>
              <ArrowLeft className="w-3 h-3 mr-1" /> Workflows
            </Button>
          </Link>
        </div>
      </div>

      <div className="border-b border-gray-200 bg-white shrink-0 overflow-x-auto">
        <div className="px-6 py-3 flex items-center gap-3 min-w-max">
          {STEPS.map((s, i) => {
            const isActive = step === s.stepName
            const isDone = visitedSteps.has(s.stepName) && stepIndex > i
            const isClickable = isDone && !isActive
            return (
              <div key={s.stepName} className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors shrink-0
                    ${isDone ? "bg-green-500 text-white" : isActive ? theme.stepActive : "bg-gray-200 text-gray-400"}`}
                  >
                    {isDone ? "✓" : i + 1}
                  </div>
                  {isClickable ? (
                    <button
                      onClick={() => setStep(s.stepName)}
                      className="text-sm text-green-600 hover:text-green-800 hover:underline cursor-pointer font-medium whitespace-nowrap"
                    >
                      {s.label}
                    </button>
                  ) : (
                    <span className={`text-sm whitespace-nowrap ${isActive ? "text-gray-900 font-medium" : "text-gray-400"}`}>
                      {s.label}
                    </span>
                  )}
                </div>
                {i < STEPS.length - 1 && <ArrowRight className="w-3 h-3 text-gray-300 shrink-0" />}
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {step === "opp-input" && (
          <div className="flex flex-col items-center justify-center min-h-full px-6 py-12">
            <div className="w-full max-w-lg bg-white border border-gray-200 rounded-xl shadow-sm p-8 space-y-5">
              <div>
                <Badge className={`${theme.stepBadge} mb-3`}>Step 1 of {STEP_COUNT}</Badge>
                <h2 className="text-xl font-bold text-gray-900">Enter the Opportunity</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Search by name or paste a Salesforce Opportunity ID.
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Opportunity name or ID</label>
                <input
                  type="text"
                  value={oppQuery}
                  onChange={(e) => setOppQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && fetchOpp()}
                  placeholder="e.g. Acme Corp - Renewal 2026"
                  className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 ${theme.inputFocus}`}
                />
                {oppError && (
                  <p className="text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {oppError}
                  </p>
                )}
              </div>

              {oppMatches.length > 1 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">Multiple matches — select one:</p>
                  <ul className="border border-gray-200 rounded-lg divide-y max-h-48 overflow-auto">
                    {oppMatches.map((opp) => (
                      <li key={opp.id}>
                        <button
                          type="button"
                          onClick={() => selectOpp(opp)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-purple-50 cursor-pointer"
                        >
                          <span className="font-medium">{opp.name}</span>
                          {opp.accountName && (
                            <span className="text-gray-500 ml-2">· {opp.accountName}</span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <Button
                onClick={() => fetchOpp()}
                disabled={loading}
                className={`w-full ${theme.btnPrimary} cursor-pointer`}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Looking up in Salesforce…
                  </>
                ) : (
                  <>Continue <ArrowRight className="w-4 h-4 ml-2" /></>
                )}
              </Button>
            </div>
          </div>
        )}

        {step === "documents" && oppData && (
          <div className="flex flex-col items-center justify-center min-h-full px-6 py-12">
            <div className="w-full max-w-lg bg-white border border-gray-200 rounded-xl shadow-sm p-8 space-y-5">
              <div>
                <Badge className={`${theme.stepBadge} mb-3`}>Step 2 of {STEP_COUNT}</Badge>
                <h2 className="text-xl font-bold text-gray-900">Document Links</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Paste links to the unsigned quote, signed quote, and PO (if applicable).
                </p>
              </div>

              <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-sm space-y-1">
                <p className="font-medium text-gray-900">{oppData.name}</p>
                <p className="text-gray-500">{oppData.accountName}</p>
                <a
                  href={oppData.oppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-1 text-xs ${theme.accent} hover:underline mt-1`}
                >
                  Open in Salesforce <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Unsigned quote link *</label>
                  <input
                    type="url"
                    value={docs.unsignedQuoteUrl}
                    onChange={(e) => setDocs((d) => ({ ...d, unsignedQuoteUrl: e.target.value }))}
                    placeholder="https://..."
                    className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 ${theme.inputFocus}`}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Signed quote link *</label>
                  <input
                    type="url"
                    value={docs.signedQuoteUrl}
                    onChange={(e) => setDocs((d) => ({ ...d, signedQuoteUrl: e.target.value }))}
                    placeholder="https://..."
                    className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 ${theme.inputFocus}`}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Purchase order link (optional)</label>
                  <input
                    type="url"
                    value={docs.purchaseOrderUrl}
                    onChange={(e) => setDocs((d) => ({ ...d, purchaseOrderUrl: e.target.value }))}
                    placeholder="Skip if not required"
                    className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 ${theme.inputFocus}`}
                  />
                </div>
              </div>

              {docError && (
                <p className="text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {docError}
                </p>
              )}

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep("opp-input")} className="cursor-pointer">
                  <ArrowLeft className="w-4 h-4 mr-1" /> Back
                </Button>
                <Button onClick={handleDocumentsContinue} className={`flex-1 ${theme.btnPrimary} cursor-pointer`}>
                  Run analysis <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === "analysis" && oppData && analysis && (
          <div className="max-w-5xl mx-auto px-6 py-10">
            <Badge className={`${theme.stepBadge} mb-3`}>Step 3 of {STEP_COUNT}</Badge>
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-8">
              <QuoteReviewAnalysisReport
                analysis={analysis}
                docs={docs}
                helpCenter={helpCenter}
                opp={{
                  name: oppData.name,
                  accountName: oppData.accountName,
                  product: oppData.product,
                  winType: oppData.winType,
                  supportPlan: oppData.supportPlan,
                  userCount: oppData.userCount,
                  renewalDate: oppData.renewalDate,
                  expiryDate: oppData.expiryDate,
                  primaryContactDisplay:
                    oppData.primaryContact?.display
                    ?? formatContactLine(oppData.primaryContact),
                }}
              />
            </div>
            <div className="flex gap-3 mt-6">
              <Button variant="outline" onClick={() => setStep("documents")} className="cursor-pointer">
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <Button onClick={() => setStep("template")} className={`flex-1 ${theme.btnPrimary} cursor-pointer`}>
                Continue to provisioning template <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {step === "template" && oppData && (
          <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
            <div>
              <Badge className={`${theme.stepBadge} mb-3`}>Step 4 of {STEP_COUNT}</Badge>
              <h2 className="text-2xl font-bold text-gray-900">Provisioning Template</h2>
              <p className="text-sm text-gray-500 mt-1">
                Copy and paste into your provisioning ticket.
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
              <h3 className="font-semibold text-gray-900">Support queue</h3>
              {helpCenter ? (
                <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-4 space-y-2">
                  <p className="text-sm text-gray-700">
                    Open a provisioning ticket in the <strong>{helpCenter.name}</strong> help center
                    {helpCenter.bu ? ` (${helpCenter.bu})` : ""}.
                  </p>
                  <a
                    href={helpCenter.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center gap-2 rounded-lg ${theme.btnPrimary} px-4 py-2.5 text-sm font-medium cursor-pointer`}
                  >
                    Open support queue
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              ) : (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  No help center match for product &quot;{oppData.product ?? "—"}&quot;. Check Product Help Centers in KB.
                </div>
              )}
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">{oppData.name}</p>
                <Button variant="outline" size="sm" onClick={copyTemplate} className="cursor-pointer">
                  {copied ? (
                    <><Check className="w-3 h-3 mr-1 text-green-600" /> Copied</>
                  ) : (
                    <><Copy className="w-3 h-3 mr-1" /> Copy template</>
                  )}
                </Button>
              </div>
              <Textarea readOnly value={template} rows={18} className="font-mono text-xs bg-gray-50" />
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep("analysis")} className="cursor-pointer">
                <ArrowLeft className="w-4 h-4 mr-1" /> Back to analysis
              </Button>
              <Button onClick={startNewReview} className={`${theme.btnPrimary} cursor-pointer`}>
                Start new review
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function SignedQuoteReviewerPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    }>
      <SignedQuoteReviewerInner />
    </Suspense>
  )
}
