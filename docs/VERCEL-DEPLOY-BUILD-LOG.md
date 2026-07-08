# Build Log — Vercel Deployment Webhook (recommended)

**Replaces:** GitHub push triggers, Make.com, per-repo GitHub Actions.

**Triggers on:** `deployment.succeeded` for **production only** — a row is added only after Vercel finishes a successful prod deploy.

---

## Why this approach

| Approach | Problem |
|----------|---------|
| Make.com Router | Free tier limits; router unreliable for 6 agents |
| GitHub push → API | Logs every push, not every deploy; Notion integration access pain per repo |
| GitHub Actions on push | Fires before deploy completes |
| **Vercel deployment webhook** | Native, prod-only, one endpoint, one Notion DB |

Optional later: add AI summary inside the webhook handler using your existing TrueFoundry gateway (`OPENAI_BASE_URL`).

---

## Architecture

```
Vercel prod deploy succeeds (any of 6 projects)
        ↓
deployment.succeeded webhook
        ↓
POST https://so-agent-dashboard.vercel.app/api/vercel-deploy-webhook
        ↓
Verify x-vercel-signature (HMAC-SHA1)
        ↓
Map project name → Agent label
        ↓
One centralized Notion database (Agent + Commit + Date + Type + Deploy URL)
```

---

## Step 1 — Create centralized Notion database

In Notion (under **SO Agent Dashboard — Playbook & Reference**):

1. Create a new database: **Build Log — All Agents**
2. Properties:

| Property | Type | Notes |
|----------|------|--------|
| **Commit** | Title | Git commit message |
| **Agent** | Select | Options: `Dashboard`, `Contract Finder`, `Opp Prep AI`, `SF Agent`, `NS Agent` |
| **Date** | Date | Deploy date |
| **Type** | Select | `feat`, `fix`, `chore`, `revert`, `debug`, `temp`, `Merge sandbox` |
| **Deploy URL** | URL | Optional — Vercel deployment URL |

3. Open your Notion integration → **Content access** → add **Build Log — All Agents**
4. Copy the **data source ID** from the database URL (or use Notion fetch — format `collection://…`)

---

## Step 2 — Vercel env vars (so-agent-dashboard only)

On project **so-agent-dashboard** → Settings → Environment Variables:

| Variable | Value |
|----------|--------|
| `NOTION_TOKEN` | Your Notion internal integration secret |
| `NOTION_DEPLOY_LOG_DATA_SOURCE_ID` | Data source ID for **Build Log — All Agents** |
| `NOTION_DEPLOY_LOG_DATABASE_ID` | Page/database ID (classic API fallback) |
| `VERCEL_DEPLOY_WEBHOOK_SECRET` | Create in Step 3 — same secret on all webhooks |

Redeploy **so-agent-dashboard** after adding.

---

## Step 3 — Vercel deployment webhooks (each prod project)

For **each production Vercel project**, add a webhook:

**Vercel** → project → **Settings** → **Webhooks** → **Create Webhook**

| Field | Value |
|-------|--------|
| **URL** | `https://so-agent-dashboard.vercel.app/api/vercel-deploy-webhook` |
| **Events** | `deployment.succeeded` only |
| **Secret** | Generate once — paste into `VERCEL_DEPLOY_WEBHOOK_SECRET` on dashboard |

Repeat for:

| Vercel project | Agent logged |
|----------------|--------------|
| `so-agent-dashboard` | Dashboard |
| `so-contract-finder` | Contract Finder |
| `gpt-opp-prep` | Opp Prep AI |
| `so-sf-agent` | SF Agent |
| `ns-agent` | NS Agent |

Use the **same webhook URL and same secret** for all five.

> **Tip:** If your Vercel team supports a **team-level webhook** covering all projects, one webhook replaces five.

---

## Step 4 — Turn off old pipelines

- **Make.com:** turn OFF the GitHub→Notion scenario
- **GitHub webhooks** pointing at Make or `/api/build-log`: delete or disable
- **ContractFinder** `.github/workflows/notion-build-log.yml`: optional to remove (deploy webhook replaces it)

---

## Step 5 — Test

1. Push a small commit to `main` on any agent repo
2. Wait for Vercel prod deploy to finish (green)
3. Check **Build Log — All Agents** in Notion
4. Or check Vercel → **so-agent-dashboard** → **Logs** for `vercel-deploy-webhook`

Manual test (after deploy):

```bash
# Requires valid signature — easiest test is a real prod redeploy from Vercel UI
```

---

## Optional: AI summary (phase 2)

Inside `app/api/vercel-deploy-webhook/route.ts`, after parsing the commit message:

1. Call TrueFoundry / OpenAI with: “One-line summary of this deploy commit: …”
2. Write to a **Summary** rich-text property on the Notion row

No GitHub Actions needed — the webhook handler does it in one place.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `403 Invalid signature` | `VERCEL_DEPLOY_WEBHOOK_SECRET` must match the secret shown when the webhook was created |
| `503 NOTION_TOKEN` | Add token on **so-agent-dashboard** Vercel project |
| `500 object_not_found` | Grant integration **Content access** to the centralized database |
| `skipped: unknown-project:foo` | Add mapping in `lib/deploy-log-config.ts` |
| Row missing after deploy | Confirm webhook event is `deployment.succeeded` and deploy target is **production** |

---

## Legacy per-agent databases

Your existing 6 separate Build Log databases can stay as read-only history. New entries go to **Build Log — All Agents**. Use Notion filtered views grouped by **Agent** if you want the old per-agent feel.
