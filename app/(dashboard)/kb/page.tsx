import { BookOpen, ExternalLink } from "lucide-react"
import { theme } from "@/lib/theme"

const notebooks = [
  {
    title: "Renewals Knowledge Base & Playbooks",
    description: "134 sources · Strategic playbooks covering Influitive AdvocateHub, Everest, Jigsaw, VoltDelta, and more. Includes ARR data, pricing strategies, objection handling, Platinum Success tiers, and competitive insights across the full renewals portfolio.",
    url: "https://notebooklm.google.com/notebook/671cd5de-91eb-4422-bf72-133af9dac611",
    sources: 134,
    updated: "Feb 13, 2026",
  },
  {
    title: "Khoros — Renewals Product Knowledgebase",
    description: "35 sources · Covers Khoros One platform evolution, Aurora AI, Iris® AI, SMM+ and Ultimate editions, internal sales playbooks, pricing strategy (25–45% renewal upticks), and AI Vision for social media management and digital customer care.",
    url: "https://notebooklm.google.com/notebook/abbfd52b-3f0b-4e75-8a1e-0fda01ee2232",
    sources: 35,
    updated: "Feb 5, 2026",
  },
  {
    title: "Tivian — Renewals Product Knowledgebase",
    description: "5 sources · Covers Tivian CXI, EX, and MR product lines, floor pricing and tiered success levels, AI-driven survey features, renewal call scripts, objection handling, and profitability analysis under new management.",
    url: "https://notebooklm.google.com/notebook/c86d933d-896a-476e-a335-c9b8df0b6d38",
    sources: 5,
    updated: "Apr 9, 2026",
  },
]

export default function KnowledgeBasePage() {
  return (
    <div className="p-8 max-w-4xl">

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className={`w-9 h-9 rounded-lg ${theme.avatarBg} flex items-center justify-center`}>
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Knowledge Base</h1>
        </div>
        <p className="text-sm text-gray-500 ml-12">
          Renewals playbooks and product knowledge. Click any notebook to open it in NotebookLM — you can ask questions, search sources, and get AI-powered answers.
        </p>
      </div>

      <div className="space-y-4">
        {notebooks.map((nb) => (
          <a
            key={nb.url}
            href={nb.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block bg-white border border-gray-200 rounded-xl p-6 hover:border-gray-300 hover:shadow-sm transition-all group"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-base font-semibold text-gray-900 group-hover:text-gray-700">
                    {nb.title}
                  </h2>
                  <ExternalLink className="w-3.5 h-3.5 text-gray-400 shrink-0 group-hover:text-gray-600" />
                </div>
                <p className="text-xs text-gray-400 mb-3">
                  {nb.sources} sources · Updated {nb.updated}
                </p>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {nb.description}
                </p>
              </div>
            </div>
            <div className="mt-4">
              <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg ${
                theme.isProd
                  ? "bg-[#e0f7f5] text-[#009688]"
                  : "bg-purple-50 text-purple-700"
              }`}>
                <BookOpen className="w-3 h-3" />
                Open in NotebookLM
              </span>
            </div>
          </a>
        ))}
      </div>

      <p className="mt-8 text-xs text-gray-400">
        These notebooks are hosted in Google NotebookLM. A Google account is required to access them.
      </p>

    </div>
  )
}
