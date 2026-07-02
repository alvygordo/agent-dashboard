# SO Agent Dashboard — Full Project Context & Restore Guide
**Owner:** Alvy Gordo (alvy.gordo@trilogy.com)
**Last updated:** Jul 2, 2026

---

## 🚨 Deployment rules (ALWAYS follow)

### Official URLs — use these only
| Environment | URL | Vercel project | Vercel team |
|---|---|---|---|
| **Production (SO)** | https://so-agent-dashboard.vercel.app | `so-agent-dashboard` | `dmitrybakaev-1061s-projects` |
| **Sandbox** | https://sandbox-agent-dashboard.vercel.app | `sandbox-agent-dashboard` | `alvygordos-projects` |

### ❌ Do NOT use — duplicate / wrong project
| URL | Vercel project | Why |
|---|---|---|
| https://agent-dashboard-rho-murex.vercel.app | `agent-dashboard` | **Not the SO dashboard.** Separate Vercel project under `alvygordos-projects`. Same GitHub repo, duplicate deployment surface. **Never deploy here.** |

### How to deploy (correct way)
1. Commit and push to GitHub — **never** `vercel deploy` for production/sandbox unless explicitly troubleshooting with the correct project linked.
2. **`main` branch** → auto-deploys **prod** (`so-agent-dashboard`)
3. **`sandbox` branch** → auto-deploys **sandbox** (`sandbox-agent-dashboard`)
4. After pushing, verify at the official URLs above — not `agent-dashboard-rho-murex` or `agent-dashboard-*.vercel.app`.

### Agent / Cursor rule
When the user asks to "deploy to prod" or "push to prod", the target is always **https://so-agent-dashboard.vercel.app** (`so-agent-dashboard` on `dmitrybakaev-1061s-projects`). Sandbox is **https://sandbox-agent-dashboard.vercel.app**. Do not link, deploy, or reference `agent-dashboard` / `rho-murex`.

---

## 🔐 Session Start Rule
When the user says "hello" or starts a new session, the VERY FIRST thing to say is:
**"MAGANDANG MAGANDA KA VIE!!"**

---

## 🟢 Production URLs
| Agent | Prod URL | Sandbox URL |
|---|---|---|
| Dashboard | https://so-agent-dashboard.vercel.app | https://sandbox-agent-dashboard.vercel.app |
| Contract Finder | https://so-contract-finder.vercel.app | https://sandbox-contract-finder.vercel.app |
| Opp Prep AI | https://gpt-opp-prep.vercel.app | https://sandbox-opp-prep.vercel.app |
| NS Agent | https://ns-agent.vercel.app | — |
| SF Agent | https://so-sf-agent.vercel.app | https://sandbox-sf-agent.vercel.app |

---

## 🏗️ What Has Been Built

### 1. SO Agent Dashboard
- Next.js 15 App Router, React 19, TypeScript, Tailwind CSS
- GitHub: https://github.com/alvygordo/agent-dashboard
- Vercel: `so-agent-dashboard` (prod), `sandbox-agent-dashboard` (sandbox) — see **Deployment rules** above
- Branch strategy: `sandbox` → sandbox Vercel, `main` → production
- **Do not use** Vercel project `agent-dashboard` (`agent-dashboard-rho-murex.vercel.app`) — duplicate; safe to remove after env audit
- **Tabs:** Home, Workflows, Agents, GPTs & Gems, SF Reports, Tasks, NNR Tracker, Knowledge Base
- **Key files:**
  - `lib/agents.ts` — all agent/tool config
  - `app/(dashboard)/page.tsx` — home page
  - `app/(dashboard)/sf-reports/page.tsx` — SF reports
  - `app/api/sf-report/route.ts` — SF reports API
  - `app/workflow/opp-prep-copilot/page.tsx` — Co-Pilot workflow
  - `proxy.ts` + `middleware.ts` — auth gate

### 2. Opp Prep Co-Pilot Workflow
- Automated pipeline: CF → NS Agent → SF Agent → Opp Prep AI → Contract Report
- Step 1 (CF) requires manual confirmation, all others auto-advance via postMessage
- All iframes use absolute overlay pattern (never hidden/display:none)
- visitedSteps tracking keeps progress bar clickable on back navigation

### 3. SF Reports (4 tabs)
- My Open Cases, Opps Stuck in Finalizing, Opps w/o Contact First Name, Contract Report Pipeline
- Opp Names are clickable links (SOQL fallback for summary reports)
- Last Name column clickable via email-based SOQL contact lookup
- Opps Stuck in Finalizing shows Sales Ops column (report ID: 00Ofu000008iGinEAE)

### 4. Agents in Dashboard
- Core Renewals (first), Contract Finder, Opp Prep AI, NS Agent, SF Agent, Contract Analyzer, Finalizing-Closer
- GPTs & Gems: Contract Report Generator, Khoros Deprovisioning, Provisioning Assistant, NNR Draft Assistant, W-9/W-8 Repository

### 5. TrueFoundry AI Gateway
- All AI agents (CF, Opp Prep AI) routed through `tfy.promptlens.trilogy.com/api/llm`
- OpenAI SDK reads `OPENAI_BASE_URL` env var automatically — no code changes needed
- Use VAT (Virtual Account Token) for production apps, not PAT

### 6. Notion Build Log (NEW — Jun 25 2026)
- Notion page: SO Agent Dashboard — Playbook & Reference
- URL: https://app.notion.com/p/trilogy-enterprises/SO-Agent-Dashboard-Playbook-Reference-38a85e927d318034a3a4fdb102e0d191
- Dashboard build log WORKING: every push to agent-dashboard → Make.com → Notion row
- Make.com scenario: `Integration GitHub, Notion — Dashboard`

---

## 📋 Current Status (Jun 26, 2026)

### ✅ Working / Live
- Dashboard prod + sandbox
- Opp Prep Co-Pilot (full pipeline)
- SF Reports (all 4 tabs, clickable links)
- Tasks tab, NNR Tracker, Knowledge Base
- TrueFoundry migration (CF + Opp Prep AI)
- Notion Build Log for Dashboard agent

### ⏳ Pending / Incomplete
1. **Notion build logs for 4 remaining agents** — CF, NS Agent, SF Agent, Opp Prep AI
2. **Backfill historical commits** into Dashboard build log (CSV ready)
3. **Contract Analyzer** — needs `GITHUB_REPO` and `GITHUB_PAT` env vars (Ana has these)
4. **Ana's PR** — `feature/contract-analyzer-shared-card` branch needs review (check proxy.ts first)
5. **CF prod alias** — must run `vercel alias set` after every CF prod deploy
6. **Agents still to build** — Quote Validator, QC Agent, OP Checklist, Summary step

---

## 🔧 Technical Rules & Guidelines

### Deployment Rules (CRITICAL)
- **SANDBOX ONLY by default** — never deploy to prod unless user says "push to prod"
- Never deploy sandbox and production simultaneously
- `sandbox` branch → sandbox Vercel project
- `main` branch → production Vercel project

### Auth Gate Rule
- Always check `proxy.ts` first when reviewing any PR
- If auth gate is commented out or removed → block merge immediately, flag user

### iframe State in Workflows
- Always use absolute positioning overlay pattern (never `display:none` or Tailwind `hidden`)
- Include `visitedSteps` tracking for progress bar
- Use `nsHandoffSent` ref to prevent re-sending postMessage on back navigation

### CF Prod Alias
- `so-contract-finder.vercel.app` is manually pinned
- Must run `vercel alias set` after every CF prod deploy

### Design System
- Production: teal `#00b4a2`, `PRODUCTION` badge
- Sandbox: purple, sandbox banner

---

## 📁 Key File Paths
- `app/(dashboard)/page.tsx` — home
- `app/(dashboard)/agents/page.tsx` — agents list
- `app/(dashboard)/tools/page.tsx` — GPTs & Gems
- `app/(dashboard)/sf-reports/page.tsx` — SF reports
- `app/(dashboard)/tasks/page.tsx` — tasks
- `app/(dashboard)/nnr-tracker/page.tsx` — NNR tracker
- `app/workflow/opp-prep-copilot/page.tsx` — Co-Pilot
- `app/api/sf-report/route.ts` — SF reports API
- `lib/agents.ts` — agent + tool config
- `proxy.ts` — auth gate

---

## 🗂️ GitHub Repos
| Agent | Repo |
|---|---|
| Dashboard | https://github.com/alvygordo/agent-dashboard |
| Contract Finder | https://github.com/alvygordo/ContractFinder |
| NS Agent | https://github.com/alvygordo/NS-Agent |
| SF Agent | https://github.com/alvygordo/SF-Agent |
| Opp Prep AI | https://github.com/alvygordo/GPT-Opp-Prep |

---

## 📓 Notion Build Log Database IDs
| Agent | Database ID |
|---|---|
| Main playbook page | `38a85e927d318034a3a4fdb102e0d191` |
| Build Log — Dashboard | `38a85e927d3180c1bba5ccc08b96c257` |
| Build Log — Contract Finder | `38a85e927d31800aa470d27c6bb086ec` |
| Build Log — NS Agent | `38a85e927d3180d7bb74e5d28bfe182c` |
| Build Log — SF Agent | `38a85e927d3180479549ff2ac95221b2` |
| Build Log — Opp Prep AI | `38a85e927d31804c8526c3a44415cdfd` |

---

## 👥 Key People
| Person | Role |
|---|---|
| Alvy Gordo | Owner — all agents |
| Ana | Contract Analyzer — holds GITHUB_REPO + GITHUB_PAT |
| Satish | SF OAuth callback URL approvals |
| David Morris | AI-First mandate, VP approvals |
| Najeeha Humayun | Cancellation Automation team |

---

## 🔑 Important Notes
- Salesforce org: trilogy-sales.my.salesforce.com
- SF token refresh: if INVALID_LOGIN → update SALESFORCE_TOKEN in Vercel env
- TrueFoundry gateway: tfy.promptlens.trilogy.com/api/llm
- Make.com zone: eu1.make.com
- Notion workspace: trilogy-enterprises
