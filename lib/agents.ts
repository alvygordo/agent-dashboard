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
  status: "active" | "coming-soon" | "hidden"
  sandboxOnly?: boolean
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
    url: process.env.NEXT_PUBLIC_OPP_PREP_URL ||
         (process.env.NEXT_PUBLIC_ENV === "production"
           ? "https://gpt-opp-prep.vercel.app/"
           : "https://sandbox-opp-prep.vercel.app/"),
    status: "active",
  },
  {
    id: "ns-agent",
    name: "NS Agent",
    description: "Extract subscription, customer, and billing data from NetSuite.",
    url: process.env.NEXT_PUBLIC_NS_AGENT_URL || "https://ns-agent.vercel.app/",
    status: "active",
  },
  {
    id: "finalizing-closer",
    name: "Finalizing-Closer Agent",
    description: "Autonomously resolves opportunities stuck in the Finalizing stage in Salesforce. Completes blocking tasks, flags high-value items, and logs everything to a live monitoring dashboard.",
    url: "https://trilogy-core-renewals-sales-ops.vercel.app/",
    status: "active",
  },
  {
    id: "sf-agent",
    name: "SF Agent",
    description: "Read-only Salesforce lookup: search an Opportunity by name and view its renewal/subscription fields.",
    url: process.env.NEXT_PUBLIC_SF_AGENT_URL ||
         (process.env.NEXT_PUBLIC_ENV === "production"
           ? "https://so-sf-agent.vercel.app/"
           : "https://sandbox-sf-agent.vercel.app/"),
    status: "active",
  },
  {
    id: "contract-analyzer",
    name: "Contract Analyzer Agent",
    description: "Analyzes contract PDFs for a Salesforce opportunity, generates a Contract Report, updates 8 SF fields, and writes a journal summary.",
    url: "",
    status: "active",
  },
]

// ─────────────────────────────────────────────────────────────
// WORKFLOWS — add new workflows here
// ─────────────────────────────────────────────────────────────
export const workflows: Workflow[] = [
  {
    id: "opp-prep-copilot",
    name: "Opp Prep Co-Pilot",
    description: "Automated pipeline — enter the opp, select the contract, and let the agents handle the rest through to Opp Prep AI.",
    status: "active",
    steps: [
      { agentId: "contract-finder", label: "Find Contract",     requiresConfirmation: true },
      { agentId: "ns-agent",        label: "Extract NS Data",   requiresConfirmation: false },
      { agentId: "sf-agent",        label: "Extract SF Data",   requiresConfirmation: false },
      { agentId: "opp-prep-ai",     label: "Opp Prep AI",       requiresConfirmation: false },
      { agentId: "contract-report-gem", label: "Contract Report", requiresConfirmation: false },
    ],
  },
  {
    id: "opp-prep-automation",
    name: "Opp Prep Automation",
    description: "Full automated renewal analysis — contract data, NS data, SF data, and comparison summary.",
    status: "coming-soon",
    steps: [
      {
        agentId: "contract-finder",
        label: "Step 1: Find Contract",
        requiresConfirmation: true,
        confirmationPrompt: "Did Contract Finder find the correct contract?",
      },
      {
        agentId: "ns-agent",
        label: "Step 2: NS Agent",
        requiresConfirmation: false,
      },
    ],
  },
  {
    id: "contract-to-opp",
    name: "Opp Prep Assistant",
    description: "Find the correct contract, confirm it, then launch Opp Prep AI.",
    status: "hidden",
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
  {
    id: "w9-w8-repository-gpt",
    name: "W-9 / W-8 Repository",
    description: "Repository and assistant for W-9 and W-8 tax forms.",
    url: "https://chatgpt.com/g/g-M7fDm3cfo-w-9-w-8-repository",
    kind: "gpt",
    status: "active",
  },
]

// kept for backwards-compat with workflow page
export const GEM_URLS = {
  contractReport: "https://gemini.google.com/gem/ae20cb53e35f",
}
