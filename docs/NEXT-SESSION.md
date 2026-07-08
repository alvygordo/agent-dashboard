# Build log — RESOLVED (Jul 8, 2026)

**Make Router is abandoned.** Multi-repo routing on Make free plan was the root cause of repeated failures.

## Architecture (final)

| Repo | Trigger | Notion target |
|------|---------|---------------|
| **agent-dashboard** | GitHub webhook → `https://so-agent-dashboard.vercel.app/api/build-log` | [Build Log — Dashboard](https://app.notion.com/p/38a85e927d3180c1bba5ccc08b96c257) |
| **ContractFinder** | GitHub Action on `main` → curls Vercel API | [Build Log — CF](https://app.notion.com/p/38a85e927d31800aa470d27c6bb086ec) |
| **SF Agent** | Existing `.github/workflows/notion-build-log.yml` (unchanged) | Build Log — SF |

Both apps use `app/api/build-log/route.ts` + `lib/notion-build-log.ts`. Token lives on **Vercel** as `NOTION_TOKEN` (not GitHub secrets).

## One-time setup (if not done)

### 1. Vercel env var (both projects) — **required before logs appear**

Add to **so-agent-dashboard** and **so-contract-finder** on Vercel:

| Variable | Value |
|----------|--------|
| `NOTION_TOKEN` | Same integration token as SF Agent GitHub secret `NOTION_TOKEN` |

Redeploy both projects after adding. API returns `503 NOTION_TOKEN is not configured` until this is set (auth/proxy fix is already deployed).

### 2. Dashboard GitHub webhook

GitHub → **alvygordo/agent-dashboard** → Settings → Webhooks:

- **Payload URL:** `https://so-agent-dashboard.vercel.app/api/build-log`
- **Content type:** `application/json`
- **Events:** Just the push event
- Turn **OFF** or delete the old Make webhook (`hook.eu1.make.com/7dk68m9...`) to avoid duplicate rows

### 3. ContractFinder

- Workflow already on `main`: `.github/workflows/notion-build-log.yml`
- Remove CF webhook from Make if still present (CF no longer uses Make)

### 4. Make.com

- **Turn OFF** the scenario or restore simple Dashboard-only backup (`docs/backups/Integration-GitHub-Notion-Dashboard-BACKUP-2026-07-07.blueprint.json`) only if you keep Make as backup — do not use Router

## Test

```bash
# Dashboard (after Vercel deploy + NOTION_TOKEN)
./scripts/trigger-dashboard-build-log-test.sh "chore: build log api verification"

# CF — push empty commit to main
cd ../ContractFinder && git checkout main && git commit --allow-empty -m "chore: build log verification" && git push origin main
```

## Notion database IDs

| Agent | Page ID | Data source ID |
|-------|---------|----------------|
| Dashboard | `38a85e927d3180c1bba5ccc08b96c257` | `38a85e92-7d31-80c4-aca9-000bf6440696` |
| Contract Finder | `38a85e927d31800aa470d27c6bb086ec` | `0f385e92-7d31-8328-a8e1-8721664a678e` |

## Optional: GitHub Actions workflow for Dashboard

Local file `.github/workflows/notion-build-log.yml` exists but could not be pushed (PAT lacks `workflow` scope). Either add workflow scope to your token, or create the file once via GitHub web UI. **Not required** if the webhook points at the Vercel API.
