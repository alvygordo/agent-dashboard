"use client"

import { useState, useEffect, Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { theme } from "@/lib/theme"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  ArrowRight,
  ArrowLeft,
  Bot,
  CheckCircle,
  AlertCircle,
  Loader2,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react"

type Step = "opp-input" | "documents" | "review"

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
  currentTerm: string | null
  currentArr: number | null
  renewalDate: string | null
  expiryDate: string | null
  autoRenewal: string | null
  primaryContact: { name: string; email: string | null } | null
  oppUrl: string
}

type DocLinks = {
  unsignedQuoteUrl: string
  signedQuoteUrl: string
  purchaseOrderUrl: string
}

const STEPS: { stepName: Step; label: string }[] = [
  { stepName: "opp-input", label: "Opportunity" },
  { stepName: "documents", label: "Document Links" },
  { stepName: "review", label: "Review" },
]

const VALID_WIN_TYPES = new Set(["Quote Signed", "PO Received"])

function buildProvisioningTemplate(opp: OppData, docs: DocLinks): string {
  const endUser = opp.accountName ?? "[Insert End User Name]"
  const customer = opp.accountName ?? "[Insert Customer Name]"
  const months = opp.currentTerm ?? "[Insert Number of Months]"
  const product = opp.product ?? "[Insert Product Name]"
  const contact = opp.primaryContact
    ? `${opp.primaryContact.name}${opp.primaryContact.email ? ` (${opp.primaryContact.email})` : ""}`
    : "[Insert Primary Contact name and email]"
  const nsLink = opp.netSuiteSubLink ?? "[Insert NetSuite Link]"
  const renewal = opp.renewalDate ?? "[Insert MM/DD/YYYY]"
  const expiry = opp.expiryDate ?? "[Insert MM/DD/YYYY]"
  const autoRenew = opp.autoRenewal ?? "[Insert Yes or No]"
  const contractTerms = opp.currentTerm ?? "[Insert Contract Terms - e.g., 12 Months / 3 Years]"
  const reason =
    opp.winType === "PO Received"
      ? `Customer is renewing for ${contractTerms}`
      : `Customer signed the quote / is renewing for ${contractTerms}`

  return [
    `${endUser} : ${months} months ${product} License Renewal`,
    "",
    `Customer Name: ${customer}`,
    `End user: ${endUser}`,
    `Netsuite subscription: ${nsLink}`,
    `Salesforce opportunity: ${opp.oppUrl}`,
    `Product: ${product}`,
    "Support plan: [Insert Standard, Gold, or Platinum]",
    "Number of users: [Insert User/Seat Count]",
    `Renewal Date: ${renewal}`,
    `Expiry Date: ${expiry}`,
    `Auto-Renewal: ${autoRenew}`,
    `Contact person: ${contact}`,
    "Reason for request:",
    reason,
    "",
    "--- Document links (for your reference) ---",
    `Unsigned quote: ${docs.unsignedQuoteUrl}`,
    `Signed quote: ${docs.signedQuoteUrl}`,
    docs.purchaseOrderUrl ? `Purchase order: ${docs.purchaseOrderUrl}` : "Purchase order: (none provided)",
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
    setStep("review")
  }

  async function copyTemplate() {
    if (!oppData) return
    await navigator.clipboard.writeText(buildProvisioningTemplate(oppData, docs))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const stepIndex = STEPS.findIndex((s) => s.stepName === step)
  const template = oppData ? buildProvisioningTemplate(oppData, docs) : ""
  const winTypeBlocked = oppData?.winType != null && !VALID_WIN_TYPES.has(oppData.winType)

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

      <div className="border-b border-gray-200 bg-white shrink-0">
        <div className="px-6 py-3 flex items-center gap-4">
          {STEPS.map((s, i) => {
            const isActive = step === s.stepName
            const isDone = visitedSteps.has(s.stepName) && stepIndex > i
            const isClickable = isDone && !isActive
            return (
              <div key={s.stepName} className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors
                    ${isDone ? "bg-green-500 text-white" : isActive ? theme.stepActive : "bg-gray-200 text-gray-400"}`}
                  >
                    {isDone ? "✓" : i + 1}
                  </div>
                  {isClickable ? (
                    <button
                      onClick={() => setStep(s.stepName)}
                      className="text-sm text-green-600 hover:text-green-800 hover:underline cursor-pointer font-medium"
                    >
                      {s.label}
                    </button>
                  ) : (
                    <span className={`text-sm ${isActive ? "text-gray-900 font-medium" : "text-gray-400"}`}>
                      {s.label}
                    </span>
                  )}
                </div>
                {i < STEPS.length - 1 && <ArrowRight className="w-3 h-3 text-gray-300" />}
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
                <Badge className={`${theme.stepBadge} mb-3`}>Step 1 of 3</Badge>
                <h2 className="text-xl font-bold text-gray-900">Enter the Opportunity</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Search by name or paste a Salesforce Opportunity ID. Win Type must be Quote Signed or PO Received to proceed.
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
                          {opp.winType && (
                            <span className={`ml-2 text-xs ${opp.winTypeValid ? "text-green-600" : "text-amber-600"}`}>
                              Win Type: {opp.winType}
                            </span>
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
                <Badge className={`${theme.stepBadge} mb-3`}>Step 2 of 3</Badge>
                <h2 className="text-xl font-bold text-gray-900">Paste Document Links</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Provide links to the unsigned quote, signed quote, and PO (if applicable).
                </p>
              </div>

              <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-sm space-y-1">
                <p className="font-medium text-gray-900">{oppData.name}</p>
                <p className="text-gray-500">{oppData.accountName}</p>
                {oppData.winType && (
                  <p className={oppData.winTypeValid ? "text-green-700" : "text-amber-700"}>
                    Win Type: {oppData.winType}
                    {!oppData.winTypeValid && " — expected Quote Signed or PO Received"}
                  </p>
                )}
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
                  Review <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === "review" && oppData && (
          <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
            <div>
              <Badge className={`${theme.stepBadge} mb-3`}>Step 3 of 3</Badge>
              <h2 className="text-2xl font-bold text-gray-900">Review Summary</h2>
              <p className="text-sm text-gray-500 mt-1">
                Confirm document links and copy the provisioning template. Automated PDF diff and PO audit coming later.
              </p>
            </div>

            {winTypeBlocked && (
              <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Win Type gate — review before accepting</p>
                  <p>
                    Win Type is &quot;{oppData.winType}&quot;. This workflow is intended for Quote Signed or PO Received only.
                  </p>
                </div>
              </div>
            )}

            {!docs.purchaseOrderUrl && (
              <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <p>No PO link provided — confirm whether a PO is contractually required for this deal.</p>
              </div>
            )}

            <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" /> Opportunity
              </h3>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div><dt className="text-gray-500">Name</dt><dd className="font-medium">{oppData.name}</dd></div>
                <div><dt className="text-gray-500">Account</dt><dd>{oppData.accountName ?? "—"}</dd></div>
                <div><dt className="text-gray-500">Win Type</dt><dd>{oppData.winType ?? "—"}</dd></div>
                <div><dt className="text-gray-500">Product</dt><dd>{oppData.product ?? "—"}</dd></div>
                <div><dt className="text-gray-500">Term</dt><dd>{oppData.currentTerm ?? "—"}</dd></div>
                <div><dt className="text-gray-500">Primary contact</dt>
                  <dd>
                    {oppData.primaryContact
                      ? `${oppData.primaryContact.name}${oppData.primaryContact.email ? ` · ${oppData.primaryContact.email}` : ""}`
                      : "—"}
                  </dd>
                </div>
              </dl>
              <a href={oppData.oppUrl} target="_blank" rel="noopener noreferrer"
                className={`inline-flex items-center gap-1 text-sm ${theme.accent} hover:underline`}>
                Open in Salesforce <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-3">
              <h3 className="font-semibold text-gray-900">Document links</h3>
              <ul className="text-sm space-y-2">
                <li>
                  <span className="text-gray-500">Unsigned quote: </span>
                  <a href={docs.unsignedQuoteUrl} target="_blank" rel="noopener noreferrer" className={`${theme.accent} hover:underline break-all`}>
                    {docs.unsignedQuoteUrl}
                  </a>
                </li>
                <li>
                  <span className="text-gray-500">Signed quote: </span>
                  <a href={docs.signedQuoteUrl} target="_blank" rel="noopener noreferrer" className={`${theme.accent} hover:underline break-all`}>
                    {docs.signedQuoteUrl}
                  </a>
                </li>
                {docs.purchaseOrderUrl ? (
                  <li>
                    <span className="text-gray-500">Purchase order: </span>
                    <a href={docs.purchaseOrderUrl} target="_blank" rel="noopener noreferrer" className={`${theme.accent} hover:underline break-all`}>
                      {docs.purchaseOrderUrl}
                    </a>
                  </li>
                ) : (
                  <li className="text-gray-400">Purchase order: not provided</li>
                )}
              </ul>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Provisioning template</h3>
                <Button variant="outline" size="sm" onClick={copyTemplate} className="cursor-pointer">
                  {copied ? (
                    <><Check className="w-3 h-3 mr-1 text-green-600" /> Copied</>
                  ) : (
                    <><Copy className="w-3 h-3 mr-1" /> Copy template</>
                  )}
                </Button>
              </div>
              <Textarea readOnly value={template} rows={16} className="font-mono text-xs bg-gray-50" />
              <p className="text-xs text-gray-500">
                Fill in bracketed fields manually. Queue routing from Product Matrix will be added in a later phase.
              </p>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep("documents")} className="cursor-pointer">
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <Button onClick={() => { setStep("opp-input"); setOppData(null); setOppQuery(""); setDocs({ unsignedQuoteUrl: "", signedQuoteUrl: "", purchaseOrderUrl: "" }) }}
                className={`${theme.btnPrimary} cursor-pointer`}>
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
