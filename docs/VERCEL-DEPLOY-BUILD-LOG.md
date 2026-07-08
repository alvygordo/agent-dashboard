# Build Log — Vercel Deployment Webhook (other agents)

**Scope:** Contract Finder, Opp Prep AI, SF Agent, NS Agent — **not Dashboard**.

**Dashboard** keeps its **existing working build log** (Make / current pipeline). Do not change it.

**Triggers on:** `deployment.succeeded` for **production only** — a row is added only after Vercel finishes a successful prod deploy.

---

## Split architecture

| Agent | Build log pipeline | Notion database |
|-------|-------------------|-----------------|
| **Dashboard** | **Existing (keep as-is)** | [Build Log — Dashboard](https://app.notion.com/p/38a85e927d3180c1bba5ccc08b96c257) |
| Contract Finder | Vercel deploy webhook → `/api/vercel-deploy-webhook` | Build Log — All Agents (new) |
| Opp Prep AI | Same | Same |
| SF Agent | Same | Same |
| NS Agent | Same | Same |

```
Other agent prod deploy succeeds
        ↓
deployment.succeeded webhook (per agent Vercel project)
        ↓
POST https://so-agent-dashboard.vercel.app/api/vercel-deploy-webhook
        ↓
Verify signature → map project → Agent label
        ↓
Build Log — All Agents (Notion)
```

Dashboard deploys are **ignored** by this webhook (`skipped: dashboard-uses-legacy-pipeline`).

---

## Step 1 — Create Notion database **Build Log — All Agents**

Under **SO Agent Dashboard — Playbook & Reference**:

| Property | Type | Options / notes |
|----------|------|-----------------|
| **Commit** | Title | Git commit message |
| **Agent** | Select | `Contract Finder`, `Opp Prep AI`, `SF Agent`, `NS Agent` |
| **Date** | Date | Deploy date |
| **Type** | Select | `feat`, `fix`, `chore`, `revert`, `debug`, `temp`, `Merge sandbox` |
| **Deploy URL** | URL | Vercel deployment URL |

Grant your Notion integration **Content access** to this database only (Dashboard DB stays on its existing integration/access).

---

## Step 2 — Vercel env vars (so-agent-dashboard)

| Variable | Value |
|----------|--------|
| `NOTION_TOKEN` | Integration secret with access to **Build Log — All Agents** |
| `NOTION_DEPLOY_LOG_DATA_SOURCE_ID` | Data source ID for the new database |
| `NOTION_DEPLOY_LOG_DATABASE_ID` | Page ID fallback |
| `VERCEL_DEPLOY_WEBHOOK_SECRET` | Shared secret from Step 3 |

Redeploy **so-agent-dashboard** after adding.

---

## Step 3 — Webhooks on **other agent** prod projects only

**Do not** add a deploy webhook on `so-agent-dashboard`.

For each **other** prod project → Settings → Webhooks:

| Field | Value |
|-------|--------|
| **URL** | `https://so-agent-dashboard.vercel.app/api/vercel-deploy-webhook` |
| **Events** | `deployment.succeeded` |
| **Secret** | Same value as `VERCEL_DEPLOY_WEBHOOK_SECRET` |

| Vercel project | Logged as |
|----------------|-----------|
| `so-contract-finder` | Contract Finder |
| `gpt-opp-prep` | Opp Prep AI |
| `so-sf-agent` | SF Agent |
| `ns-agent` | NS Agent |

---

## Step 4 — Clean up **other agents only**

- **Keep** Dashboard Make / existing webhook pipeline running
- Turn off CF/other Make routes if any
- Remove ContractFinder `.github/workflows/notion-build-log.yml` when webhook is verified

---

## Step 5 — Test

1. Push to `main` on **ContractFinder** (not agent-dashboard)
2. Wait for prod deploy on Vercel
3. New row in **Build Log — All Agents** with Agent = Contract Finder
4. Confirm **Build Log — Dashboard** still updates via its existing pipeline

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Dashboard row in All Agents DB | Should not happen — webhook skips dashboard projects |
| `403 Invalid signature` | Match `VERCEL_DEPLOY_WEBHOOK_SECRET` to webhook secret |
| `500 object_not_found` | Content access for **All Agents** DB only |
| CF row missing | Webhook on `so-contract-finder`, event `deployment.succeeded`, prod target |
