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
// GEM URLS — external Gemini Gem links
// ─────────────────────────────────────────────────────────────
export const GEM_URLS = {
  contractReport: "https://gemini.google.com/gem/ae20cb53e35f",
}
