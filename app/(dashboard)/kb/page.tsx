"use client"

import { useState } from "react"
import { BookOpen, ExternalLink, FolderOpen, FileText } from "lucide-react"
import { theme } from "@/lib/theme"

const tabs = ["Product KB", "Product Repo", "Renewals Playbook"] as const
type Tab = typeof tabs[number]

const productKB = [
  {
    type: "notebook" as const,
    title: "Renewals Knowledge Base & Playbooks",
    description: "Strategic playbooks covering Influitive AdvocateHub, Everest, Jigsaw, VoltDelta, and more. Includes ARR data, pricing strategies, objection handling, Platinum Success tiers, and competitive insights across the full renewals portfolio.",
    url: "https://notebooklm.google.com/notebook/671cd5de-91eb-4422-bf72-133af9dac611",
    meta: "134 sources · Feb 13, 2026",
  },
  {
    type: "notebook" as const,
    title: "Khoros — Renewals Product Knowledgebase",
    description: "Covers Khoros One platform evolution, Aurora AI, Iris® AI, SMM+ and Ultimate editions, internal sales playbooks, pricing strategy (25–45% renewal upticks), and AI Vision for social media management and digital customer care.",
    url: "https://notebooklm.google.com/notebook/abbfd52b-3f0b-4e75-8a1e-0fda01ee2232",
    meta: "35 sources · Feb 5, 2026",
  },
  {
    type: "notebook" as const,
    title: "Tivian — Renewals Product Knowledgebase",
    description: "Covers Tivian CXI, EX, and MR product lines, floor pricing and tiered success levels, AI-driven survey features, renewal call scripts, objection handling, and profitability analysis under new management.",
    url: "https://notebooklm.google.com/notebook/c86d933d-896a-476e-a335-c9b8df0b6d38",
    meta: "5 sources · Apr 9, 2026",
  },
  {
    type: "sheet" as const,
    title: "CPM — S2 Tracker",
    description: "S2 tracker spreadsheet for CPM tracking and management.",
    url: "https://docs.google.com/spreadsheets/d/1UPA6fqhpzpz-yp4XPIxzzGb8KdzlqRhm7l8g3whOeeA/edit?gid=1694050839#gid=1694050839",
    meta: "Google Sheets",
  },
  {
    type: "sheet" as const,
    title: "Product Support Queues",
    description: "Product support queue tracker.",
    url: "https://docs.google.com/spreadsheets/d/1bySzm2pHZK5p5ny9R44_YPUPlETRokNMLyCpj5J8bq4/edit?gid=839128997#gid=839128997",
    meta: "Google Sheets",
  },
  {
    type: "sheet" as const,
    title: "Contracting Entities by Product",
    description: "Reference sheet mapping contracting entities to their respective products.",
    url: "https://docs.google.com/spreadsheets/d/1x7zyJjFALpeC3IE_zPKEcPfqjlYv3jaMmjsS1iXc1Rk/edit?gid=1213553245#gid=1213553245",
    meta: "Google Sheets",
  },
]

const productRepo = [
  {
    title: "RFP Documents",
    description: "RFP-related docs and templates.",
    url: "https://drive.google.com/drive/folders/1Y-fJKN6hyglSPWc3LuP0TEfDL8o2rZEQ",
    meta: "Google Drive",
  },
  {
    title: "Cloudsense Contracts",
    description: "Repository of Cloudsense contracts.",
    url: "https://drive.google.com/drive/folders/1CfyP-DL6G3Zw2BRXHHTQnMIiRFm5wMqh",
    meta: "Google Drive",
  },
  {
    title: "Contently Contracts",
    description: "Repository of Contently contracts.",
    url: "https://d37u31d70bwoo9.cloudfront.net/",
    meta: "Web",
  },
  {
    title: "NS File Cabinet",
    description: "NetSuite file cabinet — subscription and contract documents.",
    url: "https://4914352.app.netsuite.com/app/common/media/mediaitemfolders.nl?whence=&siaT=1781688089730&siaWhc=%2Fapp%2Faccounting%2Fsubscription%2Fsubscription.nl&siaNv=ct2",
    meta: "NetSuite",
  },
]

const renewalsPlaybook = [
  {
    title: "Core Renewals Playbook & Brainlifts",
    description: "Core renewals playbook and Brainlifts documentation for the renewals team.",
    url: "https://drive.google.com/drive/folders/1x6RfqKV18c04VgyhetsrdMJyKc75Cu-I",
    meta: "Google Drive",
  },
  {
    title: "Decommissioning Requests — Runbook",
    description: "Step-by-step runbook for processing decommissioning requests.",
    url: "https://docs.google.com/document/d/1SEm8qzIvN9l-k_pd5DF2ICPiqMqIux8-/edit",
    meta: "Google Docs",
  },
]

function NotebookCard({ item }: { item: typeof productKB[0] }) {
  const accent = theme.isProd ? "bg-[#e0f7f5] text-[#009688]" : "bg-purple-50 text-purple-700"
  return (
    <a href={item.url} target="_blank" rel="noopener noreferrer"
      className="block bg-white border border-gray-200 rounded-xl p-5 hover:border-gray-300 hover:shadow-sm transition-all group">
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-lg ${theme.avatarBg} flex items-center justify-center shrink-0 mt-0.5`}>
          {item.type === "sheet"
            ? <FileText className="w-4 h-4 text-white" />
            : <BookOpen className="w-4 h-4 text-white" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="text-sm font-semibold text-gray-900 group-hover:text-gray-700">{item.title}</h3>
            <ExternalLink className="w-3 h-3 text-gray-400 shrink-0 group-hover:text-gray-600" />
          </div>
          <p className="text-xs text-gray-400 mb-2">{item.meta}</p>
          <p className="text-sm text-gray-600 leading-relaxed">{item.description}</p>
          <span className={`inline-flex items-center gap-1 mt-3 text-xs font-medium px-2.5 py-1 rounded-md ${accent}`}>
            {item.type === "sheet" ? <FileText className="w-3 h-3" /> : <BookOpen className="w-3 h-3" />}
            {item.type === "sheet" ? "Open Sheet" : "Open in NotebookLM"}
          </span>
        </div>
      </div>
    </a>
  )
}

function RepoCard({ item }: { item: { title: string; description: string; url: string; meta: string } }) {
  const accent = theme.isProd ? "bg-[#e0f7f5] text-[#009688]" : "bg-purple-50 text-purple-700"
  return (
    <a href={item.url} target="_blank" rel="noopener noreferrer"
      className="block bg-white border border-gray-200 rounded-xl p-5 hover:border-gray-300 hover:shadow-sm transition-all group">
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-lg ${theme.avatarBg} flex items-center justify-center shrink-0 mt-0.5`}>
          <FolderOpen className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="text-sm font-semibold text-gray-900 group-hover:text-gray-700">{item.title}</h3>
            <ExternalLink className="w-3 h-3 text-gray-400 shrink-0 group-hover:text-gray-600" />
          </div>
          <p className="text-xs text-gray-400 mb-2">{item.meta}</p>
          <p className="text-sm text-gray-600 leading-relaxed">{item.description}</p>
          <span className={`inline-flex items-center gap-1 mt-3 text-xs font-medium px-2.5 py-1 rounded-md ${accent}`}>
            <FolderOpen className="w-3 h-3" /> Open
          </span>
        </div>
      </div>
    </a>
  )
}

export default function KnowledgeBasePage() {
  const [activeTab, setActiveTab] = useState<Tab>("Product KB")

  const activeBorder = theme.isProd ? "border-[#00b4a2] text-[#00b4a2]" : "border-purple-600 text-purple-700"
  const inactiveTab  = "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"

  return (
    <div className="p-8 max-w-4xl">

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className={`w-9 h-9 rounded-lg ${theme.avatarBg} flex items-center justify-center`}>
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Knowledge Base</h1>
        </div>
        <p className="text-sm text-gray-500 ml-12">
          Product knowledge, document repositories, and renewals playbooks.
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-6">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                activeTab === tab ? activeBorder : inactiveTab
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === "Product KB" && (
        <div className="space-y-4">
          {productKB.map(item => <NotebookCard key={item.url} item={item} />)}
        </div>
      )}

      {activeTab === "Product Repo" && (
        <div className="space-y-4">
          {productRepo.map(item => <RepoCard key={item.url} item={item} />)}
        </div>
      )}

      {activeTab === "Renewals Playbook" && (
        <div className="space-y-4">
          {renewalsPlaybook.map(item => <RepoCard key={item.url} item={item} />)}
        </div>
      )}

      <p className="mt-8 text-xs text-gray-400">
        NotebookLM notebooks require a Google account. Drive links open in Google Drive.
      </p>

    </div>
  )
}
