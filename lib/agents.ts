// ─────────────────────────────────────────────────────────────
// AGENT CONFIGURATION
// To add a new agent to the dashboard, add a new entry below.
// ─────────────────────────────────────────────────────────────

export type Agent = {
  id: string
  name: string
  description: string
  url: string
  status: "active" | "coming-soon"
}

export type Workflow = {
  id: string
  name: string
  description: string
  steps: WorkflowStep[]
  status: "active" | "coming-soon"
}

export type WorkflowStep = {
  agentId: string
  label: string
  requiresConfirmation: boolean
  confirmationPrompt?: string
}

// ─────────────────────────────────────────────────────────────
// AGENTS — add new agents here
// ─────────────────────────────────────────────────────────────
export const agents: Agent[] = [
  {
    id: "contract-finder",
    name: "Contract Finder",
    description: "Search by opportunity name to find the most likely contract document.",
    url: process.env.NEXT_PUBLIC_CONTRACT_FINDER_URL ?? "https://sandbox-contract-finder.vercel.app/",
    status: "active",
  },
  {
    id: "opp-prep-ai",
    name: "Opp Prep AI",
    description: "Prepare your opportunity with AI-powered insights and analysis.",
    url: process.env.NEXT_PUBLIC_OPP_PREP_URL ?? "https://sandbox-opp-prep.vercel.app/",
    status: "active",
  },
  {
    id: "finalizing-closer",
    name: "Finalizing-Closer Agent",
    description: "Autonomously resolves opportunities stuck in the Finalizing stage in Salesforce. Completes blocking tasks, flags high-value items, and logs everything to a live monitoring dashboard.",
    url: "https://trilogy-core-renewals-sales-ops.vercel.app/",
    status: "active",
  },
]

// ─────────────────────────────────────────────────────────────
// WORKFLOWS — add new workflows here
// ─────────────────────────────────────────────────────────────
export const workflows: Workflow[] = [
  {
    id: "contract-to-opp",
    name: "Contract → Opp Prep",
    description: "Find the correct contract, confirm it, then launch Opp Prep AI.",
    status: "active",
    steps: [
      {
        agentId: "contract-finder",
        label: "Step 1: Find Contract",
        requiresConfirmation: true,
        confirmationPrompt: "Did Contract Finder find the correct contract?",
      },
      {
        agentId: "opp-prep-ai",
        label: "Step 2: Opp Prep AI",
        requiresConfirmation: false,
      },
      {
        agentId: "contract-report-gem",
        label: "Step 3: Contract Report Gem",
        requiresConfirmation: false,
      },
    ],
  },
]

export function getAgent(id: string): Agent | undefined {
  return agents.find((a) => a.id === id)
}

// ─────────────────────────────────────────────────────────────
// TOOLS — GPTs & Gems; add new entries here
// ─────────────────────────────────────────────────────────────
export type ToolKind = "gem" | "gpt"

export type Tool = {
  id: string
  name: string
  description: string
  url: string
  kind: ToolKind
  status: "active" | "coming-soon"
}

export const tools: Tool[] = [
  {
    id: "contract-report-gem",
    name: "Contract Report Generator",
    description: "Generates a contract analysis report with hierarchy, key clause analysis, narrative, and comparison to ESW terms.",
    url: "https://gemini.google.com/gem/ae20cb53e35f",
    kind: "gem",
    status: "active",
  },
  {
    id: "khoros-deprovisioning-gem",
    name: "Khoros Deprovisioning",
    description: "Extract the Khoros instances required to process the Khoros Deprovisioning ticket.",
    url: "https://gemini.google.com/gem/2cc0ea7b4320",
    kind: "gem",
    status: "active",
  },
  {
    id: "nnr-draft-assistant-gpt",
    name: "NNR Draft Assistant",
    description: "Aids in NNR draft creation.",
    url: "https://chatgpt.com/g/g-68dd021b2be08191b85d61049e59cf17-nnr-draft-assistant",
    kind: "gpt",
    status: "active",
  },
]

// kept for backwards-compat with workflow page
export const GEM_URLS = {
  contractReport: "https://gemini.google.com/gem/ae20cb53e35f",
}
