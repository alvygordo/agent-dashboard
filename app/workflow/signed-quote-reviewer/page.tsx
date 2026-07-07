"use client"

import { useState, useEffect, useRef, Suspense } from "react"
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
import type { DocumentAnalysisBundle } from "@/lib/quote-alignment"
import { resolveQuoteNumber } from "@/lib/quote-alignment"
import { formatQuoteDateDisplay, resolveProvisioningDates } from "@/lib/quote-field-extract"
import type { QuoteReviewMode } from "@/lib/quote-review-mode"
import { resolveQuoteReviewMode, usesUnsignedQuoteBaseline } from "@/lib/quote-review-mode"
import { findHelpCenterForProduct } from "@/lib/product-help-centers"
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
  purchaseOrderRequirement: string | null
  comparePo: boolean
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
  primaryQuoteId: string | null
  primaryQuoteStatus: string | null
  primaryQuoteNumber: string | null
  primaryQuoteUrl: string | null
  unsignedQuoteAttachmentUrl: string | null
  unsignedQuoteAttachmentTitle: string | null
  reviewMode: QuoteReviewMode
  reviewModeTitle: string
  reviewModeDescription: string
}

type DocLinks = {
  unsignedQuoteUrl: string
  signedQuoteUrl: string
  purchaseOrderUrl: string
}

function documentsBlockReason(
  plan: ReturnType<typeof resolveQuoteReviewMode>,
  docs: DocLinks,
): string | null {
  if (plan.mode === "unsupported") {
    return "Win Type must be Quote Signed, PO Received, or Auto-Renew"
  }
  if (plan.requiresUnsigned && !docs.unsignedQuoteUrl.trim()) {
    return plan.mode === "auto-renew"
      ? "AR quote link is required — open the primary quote Notes & Attachments if not auto-filled"
      : "Unsigned quote link is required — open the primary quote Notes & Attachments if not auto-filled"
  }
  if (plan.requiresSigned && !docs.signedQuoteUrl.trim()) {
    return "Signed quote link is required from the Signed Quote field"
  }
  if (plan.requiresPo && !docs.purchaseOrderUrl.trim()) {
    return "Purchase order link is required when Purchase Order is Required - Attached"
  }
  return null
}

function buildDocFetchKey(
  reviewMode: QuoteReviewMode,
  comparePo: boolean,
  docs: DocLinks,
): string {
  return [
    reviewMode,
    comparePo ? "po" : "no-po",
    docs.unsignedQuoteUrl.trim(),
    docs.signedQuoteUrl.trim(),
    comparePo ? docs.purchaseOrderUrl.trim() : "",
  ].join("|")
}

const STEPS: { stepName: Step; label: string }[] = [
  { stepName: "opp-input", label: "Opportunity" },
  { stepName: "documents", label: "Documents" },
  { stepName: "analysis", label: "Analysis & flags" },
  { stepName: "template", label: "Provisioning template" },
]

const STEP_COUNT = STEPS.length

function quoteFieldsForTemplate(docAnalysis?: DocumentAnalysisBundle | null) {
  if (!docAnalysis) return null
  if (usesUnsignedQuoteBaseline(docAnalysis.analysisMode)) {
    return docAnalysis.unsigned?.fields ?? docAnalysis.signed?.fields ?? null
  }
  return docAnalysis.signed?.fields ?? docAnalysis.unsigned?.fields ?? null
}

function quoteBaselineProvisioningReference(
  opp: OppData,
  docAnalysis?: DocumentAnalysisBundle | null,
): { field: string; value: string }[] {
  const quoteFields = quoteFieldsForTemplate(docAnalysis)
  const provisioned = resolveProvisioningDates({
    renewalDate: quoteFields?.renewalDate ?? null,
    extractedExpiry: quoteFields?.expiryDate,
    term: quoteFields?.term,
  })
  return [
    { field: "Win Type", value: opp.winType ?? "—" },
    { field: "Product", value: quoteFields?.product ?? opp.product ?? "—" },
    { field: "Support plan", value: quoteFields?.supportPlan ?? opp.supportPlan ?? "—" },
    {
      field: "Users / seats",
      value: quoteFields?.quantity ?? (opp.userCount != null ? String(opp.userCount) : "—"),
    },
    {
      field: "Renewal date (term start)",
      value: formatQuoteDateDisplay(provisioned.renewalDate ?? quoteFields?.renewalDate),
    },
    {
      field: "Expiry date (term end)",
      value: formatQuoteDateDisplay(provisioned.expiryDate),
    },
    {
      field: "Term duration",
      value: quoteFields?.term ? formatTermLabel(quoteFields.term) : "—",
    },
    {
      field: "Service provider",
      value: quoteFields?.supplierName ?? "—",
    },
    {
      field: "Primary contact",
      value:
        opp.primaryContact?.display
        ?? formatContactLine(opp.primaryContact),
    },
    {
      field: "Quote #",
      value:
        resolveQuoteNumber(
          docAnalysis?.documentIds.quoteNumber,
          opp.primaryQuoteNumber,
        ) ?? "—",
    },
  ]
}

function buildProvisioningTemplate(
  opp: OppData,
  docAnalysis?: DocumentAnalysisBundle | null,
): string {
  const quoteFields = quoteFieldsForTemplate(docAnalysis)
  const termSource = quoteFields?.term ?? null
  const months = formatTermMonthsOnly(termSource)
  const termLabel = formatTermLabel(termSource)
  const product = opp.product ?? "[Insert Product Name]"
  const contact = opp.primaryContact?.display ?? formatContactLine(opp.primaryContact)
  const nsLink = opp.netSuiteSubLink ?? "[Insert NetSuite Link]"
  const renewalRaw = quoteFields?.renewalDate ?? null
  const provisioned = resolveProvisioningDates({
    renewalDate: renewalRaw,
    extractedExpiry: quoteFields?.expiryDate,
    term: termSource,
  })
  const renewal = formatQuoteDateDisplay(provisioned.renewalDate ?? renewalRaw)
  const expiry = formatQuoteDateDisplay(provisioned.expiryDate)
  const autoRenew = opp.autoRenewal ?? "[Insert Yes or No]"
  const endUser = opp.accountName ?? "[Insert End User Name]"
  const customer = opp.accountName ?? "[Insert Customer Name]"
  const supportPlan = fieldOrPlaceholder(opp.supportPlan, "[Insert Standard, Gold, or Platinum]")
  const userCount = opp.userCount != null && opp.userCount > 0
    ? String(opp.userCount)
    : "[Insert User/Seat Count]"
  const poNumber = docAnalysis?.documentIds.poNumber ?? null
  const reason =
    opp.winType === "PO Received"
      ? `Customer is renewing for ${termLabel}`
      : opp.winType === "Auto-Renew"
        ? "Customer is being Auto-renewed"
        : `Customer signed the quote / is renewing for ${termLabel}`

  const lines = [
    `${endUser} : ${months} months ${product} License Renewal`,
    "",
    `Customer Name: ${customer}`,
    `End user: ${endUser}`,
    ...(poNumber ? [`PO #: ${poNumber}`] : []),
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
  ]
  return lines.join("\n")
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
  const [docAnalysis, setDocAnalysis] = useState<DocumentAnalysisBundle | null>(null)
  const [docAnalysisLoading, setDocAnalysisLoading] = useState(false)
  const [docAnalysisError, setDocAnalysisError] = useState<string | null>(null)
  const docFetchKeyRef = useRef<string | null>(null)

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
    const plan = resolveQuoteReviewMode({
      winType: opp.winType,
      primaryQuoteStatus: opp.primaryQuoteStatus,
      signedQuoteUrl: opp.signedQuoteUrl,
      purchaseOrderLink: opp.purchaseOrderLink,
      purchaseOrderRequirement: opp.purchaseOrderRequirement,
    })
    setOppData({
      ...opp,
      reviewMode: plan.mode,
      reviewModeTitle: plan.title,
      reviewModeDescription: plan.description,
      comparePo: plan.comparePo,
    })
    setOppMatches([])
    const newDocs: DocLinks = {
      unsignedQuoteUrl:
        plan.requiresUnsigned
          ? (opp.unsignedQuoteAttachmentUrl ?? "")
          : "",
      signedQuoteUrl: plan.requiresSigned ? (opp.signedQuoteUrl ?? "") : "",
      purchaseOrderUrl: plan.comparePo ? (opp.purchaseOrderLink ?? "") : "",
    }
    setDocs(newDocs)

    const blockReason = documentsBlockReason(plan, newDocs)
    if (!blockReason) {
      setDocError("")
      setDocAnalysis(null)
      setDocAnalysisError(null)
      docFetchKeyRef.current = null
      setVisitedSteps((prev) => new Set(prev).add("documents"))
      setStep("analysis")
    } else {
      setDocError("")
      setStep("documents")
    }
  }

  useEffect(() => {
    if (autoOpp && autostart) {
      fetchOpp(decodeURIComponent(autoOpp))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleDocumentsContinue() {
    if (!oppData) return
    const plan = resolveQuoteReviewMode({
      winType: oppData.winType,
      primaryQuoteStatus: oppData.primaryQuoteStatus,
      signedQuoteUrl: docs.signedQuoteUrl,
      purchaseOrderLink: docs.purchaseOrderUrl,
      purchaseOrderRequirement: oppData.purchaseOrderRequirement,
    })
    const blockReason = documentsBlockReason(plan, docs)
    if (blockReason) {
      setDocError(blockReason)
      return
    }
    setDocError("")
    setStep("analysis")
  }

  useEffect(() => {
    if (step !== "analysis" || !oppData) return

    const fetchKey = buildDocFetchKey(oppData.reviewMode, oppData.comparePo, docs)

    if (docAnalysis && docFetchKeyRef.current === fetchKey) return

    let cancelled = false
    const previousKey = docFetchKeyRef.current
    docFetchKeyRef.current = fetchKey
    if (previousKey !== null && previousKey !== fetchKey) {
      setDocAnalysis(null)
    }
    setDocAnalysisLoading(true)
    setDocAnalysisError(null)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 90_000)

    fetch("/api/sf-quote-documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        analysisMode: oppData.reviewMode,
        comparePo: oppData.comparePo,
        unsignedQuoteUrl: docs.unsignedQuoteUrl,
        signedQuoteUrl: docs.signedQuoteUrl,
        purchaseOrderUrl: oppData.comparePo ? docs.purchaseOrderUrl : "",
        salesforce: {
          accountName: oppData.accountName,
          product: oppData.product,
          supportPlan: oppData.supportPlan,
          userCount: oppData.userCount,
          renewalDate: oppData.renewalDate,
          expiryDate: oppData.expiryDate,
          currentTerm: oppData.currentTerm,
          currentArr: oppData.currentArr,
          paymentTerms: oppData.currentTerm != null ? String(oppData.currentTerm) : null,
          primaryQuoteNumber: oppData.primaryQuoteNumber,
          winType: oppData.winType,
        },
      }),
    })
      .then(async (res) => {
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) {
          setDocAnalysisError(data.error ?? "Document analysis failed")
          return
        }
        setDocAnalysis(data as DocumentAnalysisBundle)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        if (err instanceof Error && err.name === "AbortError") {
          setDocAnalysisError("PDF analysis timed out after 90 seconds — try again or open PDFs manually.")
          return
        }
        setDocAnalysisError("Could not reach document analysis service")
      })
      .finally(() => {
        clearTimeout(timeoutId)
        if (!cancelled) setDocAnalysisLoading(false)
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [
    step,
    oppData,
    docs.unsignedQuoteUrl,
    docs.signedQuoteUrl,
    docs.purchaseOrderUrl,
    docAnalysis,
    oppData?.reviewMode,
    oppData?.comparePo,
  ])

  const reviewPlan = oppData
    ? resolveQuoteReviewMode({
        winType: oppData.winType,
        primaryQuoteStatus: oppData.primaryQuoteStatus,
        signedQuoteUrl: docs.signedQuoteUrl,
        purchaseOrderLink: docs.purchaseOrderUrl,
        purchaseOrderRequirement: oppData.purchaseOrderRequirement,
      })
    : null
  const comparePo = reviewPlan?.comparePo ?? false

  async function copyTemplate() {
    if (!oppData) return
    await navigator.clipboard.writeText(buildProvisioningTemplate(oppData, docAnalysis))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function startNewReview() {
    setStep("opp-input")
    setOppData(null)
    setOppQuery("")
    setDocs({ unsignedQuoteUrl: "", signedQuoteUrl: "", purchaseOrderUrl: "" })
    setDocAnalysis(null)
    setDocAnalysisError(null)
    setDocAnalysisLoading(false)
    docFetchKeyRef.current = null
    setVisitedSteps(new Set(["opp-input"]))
  }

  const stepIndex = STEPS.findIndex((s) => s.stepName === step)
  const stepNumber = stepIndex + 1
  const analysis = oppData
    ? buildQuoteReviewAnalysis({
        winType: oppData.winType,
        winTypeValid: oppData.winTypeValid,
        primaryQuoteStatus: oppData.primaryQuoteStatus,
        supportPlan: oppData.supportPlan,
        userCount: oppData.userCount,
        renewalDate: oppData.renewalDate,
        expiryDate: oppData.expiryDate,
        primaryContactEmail: oppData.primaryContact?.email ?? null,
        unsignedQuoteUrl: docs.unsignedQuoteUrl,
        signedQuoteUrl: docs.signedQuoteUrl,
        purchaseOrderUrl: docs.purchaseOrderUrl,
        purchaseOrderRequirement: oppData.purchaseOrderRequirement,
        reviewMode: oppData.reviewMode,
        comparePo: oppData.comparePo,
      }, docAnalysis)
    : null
  const helpCenter = oppData ? findHelpCenterForProduct(oppData.product) : null
  const template = oppData ? buildProvisioningTemplate(oppData, docAnalysis) : ""
  const provisioningReferenceRows = oppData && docAnalysis
    ? quoteBaselineProvisioningReference(oppData, docAnalysis)
    : null
  const provisioningSourceLabel = docAnalysis?.analysisMode && usesUnsignedQuoteBaseline(docAnalysis.analysisMode)
    ? (docAnalysis.analysisMode === "auto-renew" ? "AR quote" : "unsigned quote")
    : "signed quote"

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
            const isDone = visitedSteps.has(s.stepName) || stepIndex > i
            const isClickable = visitedSteps.has(s.stepName) && !isActive
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

        {step === "documents" && oppData && reviewPlan && (
          <div className="flex flex-col items-center justify-center min-h-full px-6 py-12">
            <div className="w-full max-w-lg bg-white border border-gray-200 rounded-xl shadow-sm p-8 space-y-5">
              <div>
                <Badge className={`${theme.stepBadge} mb-3`}>Step 2 of {STEP_COUNT}</Badge>
                <h2 className="text-xl font-bold text-gray-900">Document Links</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Win Type drives which documents are analyzed. Links are pre-filled from Salesforce when available.
                </p>
              </div>

              <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-sm space-y-2">
                <p className="font-medium text-gray-900">{oppData.name}</p>
                <p className="text-gray-500">{oppData.accountName}</p>
                <p className="text-gray-700">
                  <span className="font-medium">Win Type:</span> {oppData.winType ?? "—"}
                </p>
                {oppData.primaryQuoteId && (
                  <p className="text-gray-700">
                    <span className="font-medium">Primary quote status:</span>{" "}
                    {oppData.primaryQuoteStatus ?? "—"}
                    {oppData.primaryQuoteNumber ? ` (${oppData.primaryQuoteNumber})` : ""}
                  </p>
                )}
                {oppData.purchaseOrderRequirement && (
                  <p className="text-gray-700">
                    <span className="font-medium">Purchase Order:</span> {oppData.purchaseOrderRequirement}
                  </p>
                )}
                <div className="rounded-md border border-purple-200 bg-purple-50 px-3 py-2 text-purple-950">
                  <p className="font-medium">{reviewPlan.title}</p>
                  <p className="text-xs mt-1">{reviewPlan.description}</p>
                </div>
                <a
                  href={oppData.oppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-1 text-xs ${theme.accent} hover:underline mt-1`}
                >
                  Open in Salesforce <ExternalLink className="w-3 h-3" />
                </a>
                {oppData.primaryQuoteUrl && (
                  <a
                    href={oppData.primaryQuoteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center gap-1 text-xs ${theme.accent} hover:underline ml-3`}
                  >
                    Open primary quote <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              <div className="space-y-4">
                {reviewPlan.requiresUnsigned && (
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">
                      {reviewPlan.mode === "auto-renew" ? "AR quote link *" : "Unsigned quote link *"}
                    </label>
                    <input
                      type="url"
                      value={docs.unsignedQuoteUrl}
                      onChange={(e) => setDocs((d) => ({ ...d, unsignedQuoteUrl: e.target.value }))}
                      placeholder={
                        reviewPlan.mode === "auto-renew"
                          ? "From primary quote → Related → Notes & Attachments (unsigned AR quote PDF)"
                          : "From primary quote → Notes & Attachments"
                      }
                      className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 ${theme.inputFocus}`}
                    />
                    {oppData.unsignedQuoteAttachmentTitle && (
                      <p className="text-xs text-gray-500">
                        Auto-detected: {oppData.unsignedQuoteAttachmentTitle}
                      </p>
                    )}
                  </div>
                )}
                {reviewPlan.requiresSigned && (
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">Signed quote link *</label>
                    <input
                      type="url"
                      value={docs.signedQuoteUrl}
                      onChange={(e) => setDocs((d) => ({ ...d, signedQuoteUrl: e.target.value }))}
                      placeholder="From Signed Quote field on opportunity"
                      className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 ${theme.inputFocus}`}
                    />
                  </div>
                )}
                {reviewPlan.comparePo && (
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">Purchase order link *</label>
                    <input
                      type="url"
                      value={docs.purchaseOrderUrl}
                      onChange={(e) => setDocs((d) => ({ ...d, purchaseOrderUrl: e.target.value }))}
                      placeholder="From Purchase Order Link field — Required - Attached"
                      className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 ${theme.inputFocus}`}
                    />
                  </div>
                )}
                {reviewPlan.mode === "auto-renew" && (
                  <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                    Auto-Renew — no signed quote or PO. Primary quote should be <strong>Out for Signature</strong>. Create the provisioning ticket from the unsigned AR quote PDF.
                  </div>
                )}
                {!reviewPlan.comparePo && reviewPlan.poRequirement === "required-pending" && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    PO is <strong>Required - Pending</strong> — no PO comparison until the customer attaches one. Review the signed quote only.
                  </div>
                )}
                {!reviewPlan.comparePo && reviewPlan.poRequirement === "not-required" && (
                  <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                    PO is <strong>Not Required</strong> — signed quote review only, no PO comparison.
                  </div>
                )}
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
                poProvided={comparePo && Boolean(docs.purchaseOrderUrl.trim())}
                comparePo={comparePo}
                purchaseOrderRequirement={oppData.purchaseOrderRequirement}
                reviewMode={oppData.reviewMode}
                reviewModeDescription={oppData.reviewModeDescription}
                primaryQuoteStatus={oppData.primaryQuoteStatus}
                primaryQuoteNumber={oppData.primaryQuoteNumber}
                sfAlignment={{
                  accountName: oppData.accountName,
                  product: oppData.product,
                  supportPlan: oppData.supportPlan,
                  userCount: oppData.userCount,
                  renewalDate: oppData.renewalDate,
                  expiryDate: oppData.expiryDate,
                  currentTerm: oppData.currentTerm,
                  currentArr: oppData.currentArr,
                  paymentTerms: oppData.currentTerm != null ? String(oppData.currentTerm) : null,
                }}
                docAnalysis={docAnalysis}
                docAnalysisLoading={docAnalysisLoading}
                docAnalysisError={docAnalysisError}
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
                {provisioningReferenceRows
                  ? `Copy the template below for provisioning. ${provisioningSourceLabel === "signed quote" ? "Quote Signed" : provisioningSourceLabel === "AR quote" ? "Auto-Renew" : "PO Received"} renewals use the ${provisioningSourceLabel} PDF as the source of truth for term dates, duration, and service provider.`
                  : "Copy the template below for provisioning. For PO-only or Auto-Renew renewals, values come from the unsigned / AR quote and Salesforce opportunity."}
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                  {provisioningReferenceRows
                    ? `${provisioningSourceLabel.charAt(0).toUpperCase()}${provisioningSourceLabel.slice(1)} (provisioning source)`
                    : "Salesforce reference"}
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  {provisioningReferenceRows
                    ? `Values extracted from the ${provisioningSourceLabel} PDF — these drive the provisioning template below.`
                    : "Values pulled from the opportunity for the provisioning template. When you review the PDFs, confirm these match the signed quote — this is not an automated check yet."}
                </p>
              </div>
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left font-semibold text-gray-600 px-4 py-2.5 w-[40%]">
                        {provisioningReferenceRows ? "Field" : "Opportunity field"}
                      </th>
                      <th className="text-left font-semibold text-gray-600 px-4 py-2.5">
                        {provisioningReferenceRows
                          ? `Value from ${provisioningSourceLabel}`
                          : "Value from Salesforce"}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {(provisioningReferenceRows ?? [
                      { field: "Win Type", value: oppData.winType ?? "—" },
                      { field: "Product", value: oppData.product ?? "—" },
                      { field: "Support plan", value: oppData.supportPlan ?? "—" },
                      {
                        field: "Users / seats",
                        value: oppData.userCount != null ? String(oppData.userCount) : "—",
                      },
                      {
                        field: "Renewal date",
                        value: oppData.renewalDate ? formatUsDate(oppData.renewalDate) : "—",
                      },
                      {
                        field: "Expiry date",
                        value: oppData.expiryDate ? formatUsDate(oppData.expiryDate) : "—",
                      },
                      {
                        field: "Primary contact",
                        value:
                          oppData.primaryContact?.display
                          ?? formatContactLine(oppData.primaryContact),
                      },
                      {
                        field: "Quote #",
                        value:
                          resolveQuoteNumber(
                            docAnalysis?.documentIds.quoteNumber,
                            oppData.primaryQuoteNumber,
                          ) ?? "—",
                      },
                      ...(docAnalysis?.documentIds.poNumber
                        ? [{ field: "PO #", value: docAnalysis.documentIds.poNumber }]
                        : []),
                    ]).map((row) => (
                      <tr key={row.field}>
                        <td className="px-4 py-2.5 font-medium text-gray-900">{row.field}</td>
                        <td className="px-4 py-2.5 text-gray-800">{row.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Step 1</p>
                <h3 className="font-semibold text-gray-900 mt-1">Copy the provisioning template</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Click <strong>Copy template</strong> and keep it on your clipboard — you will paste it into the support ticket in the next step.
                </p>
              </div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-gray-500 truncate">{oppData.name}</p>
                <Button variant="outline" size="sm" onClick={copyTemplate} className="cursor-pointer shrink-0">
                  {copied ? (
                    <><Check className="w-3 h-3 mr-1 text-green-600" /> Copied</>
                  ) : (
                    <><Copy className="w-3 h-3 mr-1" /> Copy template</>
                  )}
                </Button>
              </div>
              <Textarea readOnly value={template} rows={18} className="font-mono text-xs bg-gray-50" />
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Step 2</p>
                <h3 className="font-semibold text-gray-900 mt-1">Open the support queue and raise a ticket</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Open the product help center below, follow their instructions to create a provisioning ticket, and paste the template you copied above into the ticket.
                </p>
              </div>
              {helpCenter ? (
                <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-4 space-y-3">
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
                  No help center match for product &quot;{oppData.product ?? "—"}&quot;. Check Product Help Centers in KB, then paste the template into the correct queue.
                </div>
              )}
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
