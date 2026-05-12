# Agent Dashboard — Step-by-Step Setup Guide

This guide walks you through creating your own Agent Dashboard from scratch and deploying it to Vercel. It does **not** touch any existing agents.

---

## What You Will End Up With

A personal dashboard at your own URL (e.g. `yourname-agent-dashboard.vercel.app`) where you can launch your AI agents in one place, with guided handoffs between them.

---

## Before You Start — What You Need

Make sure you have all of these installed and set up:

| Tool | How to check | Where to get it |
|---|---|---|
| Node.js | Open Terminal, type `node --version` | nodejs.org |
| Git | Open Terminal, type `git --version` | git-scm.com |
| GitHub account | github.com | Free to sign up |
| Vercel account | vercel.com | Free to sign up — sign in with GitHub |

You also need **VS Code** or any code editor installed.

---

## Part 1 — Create the Project

### Step 1 — Open Terminal and go to your projects folder

```
cd ~/Documents/Cursor
```

> If you store projects somewhere else, navigate there instead.

### Step 2 — Create the dashboard app

Run this command exactly as written:

```
npx create-next-app@latest agent-dashboard --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*" --yes
```

This creates a folder called `agent-dashboard` with everything pre-configured. It takes about 1 minute.

### Step 3 — Go into the folder

```
cd agent-dashboard
```

### Step 4 — Install the UI components

Run these two commands one at a time:

```
npx shadcn@latest init --defaults -y
```

```
npx shadcn@latest add card badge textarea separator
```

---

## Part 2 — Add the Dashboard Code

You will now replace or create 4 files. Copy each one exactly.

### File 1 — `vercel.json` (create this file in the root of the project)

```json
{
  "outputDirectory": "out"
}
```

### File 2 — `next.config.ts` (replace the existing file)

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
};

export default nextConfig;
```

### File 3 — `lib/agents.ts` (create the `lib` folder, then create this file inside it)

This is the only file you need to edit to add your own agents later.

```ts
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
    url: "https://contract-finder-one.vercel.app/",
    status: "active",
  },
  {
    id: "opp-prep-ai",
    name: "Opp Prep AI",
    description: "Prepare your opportunity with AI-powered insights and analysis.",
    url: "https://sandbox-opp-prep.vercel.app/",
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
    ],
  },
]

export function getAgent(id: string): Agent | undefined {
  return agents.find((a) => a.id === id)
}
```

### File 4 — `app/page.tsx` (replace the existing file)

Copy the full contents from the existing `so-agent-dashboard.vercel.app` codebase, or ask the dashboard owner to share the `app/page.tsx` and `app/workflow/contract-to-opp/page.tsx` files directly.

---

## Part 3 — Test It Locally

### Step 5 — Start the local preview

```
npm run dev
```

Open your browser and go to **http://localhost:3000**

You should see the Agent Dashboard homepage. Test the workflow by clicking "Start Workflow".

When it looks right, stop the server with `Ctrl + C`.

---

## Part 4 — Put the Code on GitHub

### Step 6 — Create a GitHub repository

1. Go to **github.com** and sign in
2. Click the **+** button (top right) → **New repository**
3. Name it `agent-dashboard` (or anything you like)
4. Set it to **Private**
5. **Do not** tick "Add a README" or any other checkbox
6. Click **Create repository**
7. Copy the URL shown — it looks like: `https://github.com/YOUR-USERNAME/agent-dashboard.git`

### Step 7 — Push your code to GitHub

Run these commands in Terminal, replacing the URL with yours:

```
git remote add origin https://github.com/YOUR-USERNAME/agent-dashboard.git
git push -u origin main
```

Go to your GitHub repo page and refresh — you should see your files there.

---

## Part 5 — Deploy to Vercel

### Step 8 — Deploy from Terminal

Make sure you are still inside the `agent-dashboard` folder, then run:

```
npx vercel --prod --force
```

When it asks questions, accept all defaults (just press Enter).

Wait for it to finish — you will see a line that says:
```
Production: https://agent-dashboard-xxxxx-yourteam.vercel.app
```

### Step 9 — Disable Deployment Protection

By default Vercel blocks public access. Fix this:

1. Go to **vercel.com** → find your `agent-dashboard` project
2. Click **Settings** → **Deployment Protection**
3. Set it to **Disabled**
4. Click **Save**

### Step 10 — Set a clean URL (optional)

The default URL has random words in it. To get a cleaner one:

1. In Vercel, go to your project → **Settings** → **Domains**
2. Add a domain like `yourname-agent-dashboard.vercel.app`
3. Then in Terminal run:

```
npx vercel alias YOUR-DEPLOYMENT-URL.vercel.app yourname-agent-dashboard.vercel.app
```

Replace `YOUR-DEPLOYMENT-URL` with the URL from Step 8.

---

## Part 6 — Adding Your Own Agents

To add a new agent to your dashboard, open `lib/agents.ts` and:

**Add an agent** to the `agents` array:

```ts
{
  id: "my-new-agent",
  name: "My New Agent",
  description: "What this agent does.",
  url: "https://my-agent.vercel.app/",
  status: "active",
},
```

**Add a workflow** to the `workflows` array if you want a guided handoff between agents.

Then redeploy:

```
git add . && git commit -m "Add new agent" && git push
npx vercel --prod --force
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `npm` not found | Install Node.js from nodejs.org |
| `git push` fails with "remote origin already exists" | Run `git remote remove origin` then try Step 7 again |
| Vercel URL shows 404 | Make sure Deployment Protection is Disabled (Step 9) |
| Vercel URL still 404 after disabling protection | Run the `vercel alias` command from Step 10 manually |
| Agent not loading inside dashboard | The agent may need its `next.config` updated to allow embedding — ask the dashboard owner |

---

## Summary of Files You Created

```
agent-dashboard/
├── vercel.json                          ← tells Vercel where the built files are
├── next.config.ts                       ← sets static export mode
├── lib/
│   └── agents.ts                        ← YOUR MAIN CONFIG — edit this to add agents
├── app/
│   ├── page.tsx                         ← dashboard home page
│   └── workflow/
│       └── contract-to-opp/
│           └── page.tsx                 ← workflow logic
└── components/                          ← UI components (do not edit)
```

---

*Built by the SO team. Questions? Ask the dashboard owner.*
