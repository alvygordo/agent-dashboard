# Make.com → Notion Build Log — Backup & Multi-Repo Upgrade Guide

**Created:** 2026-07-03  
**Purpose:** Full backup of the working Dashboard pipeline before extending it to other agents on Make.com free plan (one scenario, Router by repo).  
**Owner:** Alvy Gordo

---

## ⚠️ Read this first

You **must** complete **Part A (Backup)** before **Part B (Upgrade)**.  
If anything breaks, use **Part C (Restore)**.

This doc captures everything known from live testing (Jun 25–30, 2026). Make.com module names inside your scenario may differ slightly — **your exported blueprint is the source of truth**.

---

## Part A — Backup (do this before any Make change)

### A1. Export the Make.com scenario blueprint

1. Go to **https://eu1.make.com** → **Scenarios**
2. Open **Integration GitHub, Notion — Dashboard**
3. Click **⋯** (three dots) → **Export blueprint**
4. Save the file as:
   ```
   Integration-GitHub-Notion-Dashboard-BACKUP-2026-07-03.blueprint.json
   ```
5. Store copies in:
   - This repo: `docs/backups/` (recommended)
   - Google Drive / local Downloads

**To restore later:** Make.com → **Create a new scenario** → **Import blueprint** (uses a scenario slot — only if you have room, or replace after deleting a test scenario).

### A2. Screenshot the scenario canvas

Take screenshots showing:
- Full flow (all modules and connections)
- **Webhook** module settings (URL)
- **Filter** on the line after webhook (if any)
- **Notion → Create a database item** module — all field mappings
- Any **Router**, **Set variable**, or **Text parser** modules

Save as `make-dashboard-scenario-2026-07-03.png`.

### A3. Copy the webhook URL (do not change it)

| Setting | Value |
|---------|--------|
| Scenario name | `Integration GitHub, Notion — Dashboard` |
| Webhook URL | `https://hook.eu1.make.com/7dk68m9mv7yvjybafwrkd6etrn28qdud` |
| Make zone | `eu1.make.com` |
| Status (as of Jul 2026) | ON — GitHub deliveries show **successful** |

**Important:** All agent repos will point to this **same URL**. You are not creating new webhooks in Make.

### A4. Document GitHub webhook (agent-dashboard only today)

1. GitHub → **alvygordo/agent-dashboard** → **Settings** → **Webhooks**
2. Find the webhook pointing to `hook.eu1.make.com/7dk68m9...`
3. Screenshot or note:
   - **Payload URL**
   - **Content type** (usually `application/json`)
   - **Events** (should include **Pushes**)
   - **Active** = checked

Other agent repos likely **do not** have this webhook yet — that is expected.

### A5. Verify Dashboard logging still works (baseline test)

Before changing Make, confirm a push to **`main`** still creates a Notion row.

**Last verified working example (Jun 30, 2026):**

| Field | Value |
|-------|--------|
| GitHub commit | `d30956c` |
| Branch | `main` |
| Commit message | `chore: test Notion build log from main branch` |
| Notion row | Commit = full message, Type = `chore`, Date = 2026-06-30 |

**Test procedure:**
1. Push a tiny commit to `main` with message: `chore: backup test before make upgrade`
2. Wait 1–2 minutes
3. Check [Build Log — Dashboard](https://app.notion.com/p/38a85e927d3180c1bba5ccc08b96c257)
4. If no row appears → **stop** and fix Dashboard logging before adding other repos

### A6. Optional — turn scenario OFF during edit

While restructuring the flow:
1. Make.com → open scenario → toggle **OFF**
2. Make your changes
3. Run manual test (A5)
4. Toggle **ON**

This prevents half-finished edits from processing live pushes.

---

## Part B — Current working Dashboard scenario (snapshot)

### B1. Pipeline diagram (as designed)

```
GitHub push (agent-dashboard)
    → Webhook: hook.eu1.make.com/7dk68m9mv7yvjybafwrkd6etrn28qdud
    → [Optional filter on connection — should be EMPTY or non-blocking]
    → Parse commit (head_commit or commits[])
    → Notion: Create item in "Build Log — Dashboard"
```

### B2. What we know works

| Item | Status |
|------|--------|
| Webhook receives pushes | ✅ GitHub shows successful delivery |
| `main` branch + `chore:` prefix | ✅ Logged (`d30956c`) |
| `sandbox` branch | ❌ Did not log in tests (may need Router/filter on `ref`) |
| `docs:` prefix | ❌ May fail — Type not in dropdown at time of testing |
| Broken empty filter (`Equal to` with no value) | ⚠️ Can block entire scenario — delete empty rules |

### B3. Notion target — Build Log — Dashboard

| Property | Notion type | Map from GitHub |
|----------|-------------|-----------------|
| **Commit** | Title | `head_commit.message` (full first line of commit message) |
| **Date** | Date | `head_commit.timestamp` |
| **Type** | Select | First word before `:` in message (e.g. `chore`, `feat`, `fix`) |

**Type dropdown options (Dashboard DB — Jul 2026):**

`revert`, `debug`, `chore`, `fix`, `feat`, `temp`, `Merge sandbox`

**Notion URLs / IDs:**

| Resource | ID / URL |
|----------|----------|
| Playbook page | https://app.notion.com/p/38a85e927d318034a3a4fdb102e0d191 |
| Build Log — Dashboard (page) | https://app.notion.com/p/38a85e927d3180c1bba5ccc08b96c257 |
| Data source | `collection://38a85e92-7d31-80c4-aca9-000bf6440696` |

### B4. Type parsing rules (recommended — match in Make)

```
feat:     → feat
fix:      → fix
chore:    → chore
docs:    → chore (fallback) OR add "docs" to Notion first
Merge ... → Merge sandbox (Dashboard) OR chore fallback
unknown   → chore (fallback — never leave Type empty)
```

**Never send an empty Commit title** — caused "Untitled" rows on Jun 25.

### B5. GitHub payload fields (standard push event)

Use these in Make Router filters and mappings:

| Field | Example | Use |
|-------|---------|-----|
| `repository.full_name` | `alvygordo/agent-dashboard` | **Router by repo** |
| `repository.name` | `agent-dashboard` | Alternate filter |
| `ref` | `refs/heads/main` | Branch filter |
| `head_commit.message` | `chore: fix tasks tab` | Notion Commit title |
| `head_commit.timestamp` | ISO datetime | Notion Date |
| `commits[]` | array | Use Iterator if logging every commit in push |

---

## Part C — All agent build log databases (reference)

| Agent | GitHub repo | Notion page | Data source ID |
|-------|-------------|-------------|----------------|
| Dashboard | `alvygordo/agent-dashboard` | [Build Log — Dashboard](https://app.notion.com/p/38a85e927d3180c1bba5ccc08b96c257) | `38a85e92-7d31-80c4-aca9-000bf6440696` |
| Contract Finder | `alvygordo/ContractFinder` | [Build Log — CF](https://app.notion.com/p/38a85e927d31800aa470d27c6bb086ec) | `0f385e92-7d31-8328-a8e1-8721664a678e` |
| NS Agent | `alvygordo/NS-Agent` | [Build Log — NS](https://app.notion.com/p/38a85e927d3180d7bb74e5d28bfe182c) | `6ed85e92-7d31-836f-b3fe-87c1f77e6626` |
| SF Agent | `alvygordo/SF-Agent` | [Build Log — SF](https://app.notion.com/p/38a85e927d3180479549ff2ac95221b2) | `88885e92-7d31-833b-9ac8-078634dd77de` |
| Opp Prep AI | `alvygordo/GPT-Opp-Prep` | [Build Log — Opp Prep](https://app.notion.com/p/38a85e927d31804c8526c3a44415cdfd) | `db785e92-7d31-830f-b3b0-07618c71f2a8` |

### Type column differences (critical)

| Database | Type options | Extra columns |
|----------|--------------|---------------|
| Dashboard | revert, debug, chore, fix, feat, temp, **Merge sandbox** | — |
| Contract Finder | revert, debug, chore, fix, feat | — |
| NS Agent | revert, debug, chore, fix, feat | — |
| SF Agent | Deployment, refactor, docs, chore, fix, feat | **Branch** (text) |
| Opp Prep AI | **No Type column** | Commit + Date only |

When cloning the Notion step for each repo, adjust Type mapping and database ID per table above.

---

## Part D — Restore if upgrade breaks Dashboard

### D1. Quick restore (same scenario)

1. Make.com → open **Integration GitHub, Notion — Dashboard**
2. **⋯** → **Import blueprint** → choose your backup file  
   OR manually undo: delete Router, reconnect webhook directly to original Notion module
3. Confirm Notion module still points to **Build Log — Dashboard** data source
4. Confirm mappings: Commit, Date, Type
5. Run baseline test (Part A5)

### D2. Full restore (import as new scenario)

If the scenario is corrupted:
1. Import backup blueprint as new scenario (if you have a free slot)
2. Copy the **new** webhook URL OR update GitHub webhook to new URL
3. Turn OFF old scenario, ON new scenario
4. Test with `chore: restore test`

### D3. Manual Notion row (emergency)

If Make is down, log commits manually in the Build Log database:
- **Commit** = commit message
- **Date** = push date
- **Type** = feat / fix / chore / etc.

---

## Part E — Upgrade plan (one scenario, Router by repo)

**Goal:** Log pushes from all 5 repos without creating new Make scenarios.

**Principle:** Wrap the **existing working Dashboard path** as Router **Route 1**. Do not rewrite it — duplicate it for other routes.

### E0. Prerequisites

- [ ] Part A backup complete (blueprint + screenshots)
- [ ] Baseline test passed (Dashboard push → Notion row)
- [ ] Notion Type options aligned per database (Part C)

---

### E1. Insert Router after webhook (Dashboard path unchanged)

**Step 1 — Open scenario in edit mode**  
Make.com → **Integration GitHub, Notion — Dashboard** → **Edit**

**Step 2 — Add Router module**  
1. Click **+** between **Webhook** and the **next module** (everything that currently runs after webhook)
2. Search **Router** → add it
3. **Disconnect** webhook from old next module
4. Connect: **Webhook → Router**

**Step 3 — Move existing flow to Route 1**  
1. Connect current modules to **Router → Route 1** (same order as before)
2. Click **Route 1** → **Set up filter**
3. Add condition:
   - Field: `repository.full_name` (from webhook bundle)
   - Operator: **Equal to**
   - Value: `alvygordo/agent-dashboard`

**Step 4 — Save and test Route 1 only**  
1. Save scenario  
2. Push to `main`: `chore: router test dashboard route only`  
3. Confirm row in **Build Log — Dashboard**  
4. **Stop here if this fails** — restore from backup (Part D)

---

### E2. Add Route 2 — Contract Finder

**Step 5 — Duplicate Route 1**  
1. Right-click Route 1 modules → **Clone** / duplicate to Route 2  
2. Route 2 filter: `repository.full_name` = `alvygordo/ContractFinder`

**Step 6 — Change Notion module on Route 2 only**  
1. Open **Notion → Create a database item** on Route 2  
2. Change database to **Build Log — Contract Finder**  
3. Keep same field mappings (Commit, Date, Type)  
4. Type must be one of: `revert`, `debug`, `chore`, `fix`, `feat`

**Step 7 — Add GitHub webhook on Contract Finder repo**  
1. GitHub → **alvygordo/ContractFinder** → Settings → Webhooks → **Add webhook**  
2. Payload URL: `https://hook.eu1.make.com/7dk68m9mv7yvjybafwrkd6etrn28qdud` (same as Dashboard)  
3. Content type: `application/json`  
4. Events: **Just the push event**  
5. Active: ✅

**Step 8 — Test Contract Finder**  
Push to CF `main`: `chore: test notion build log contract finder`  
Check [Build Log — Contract Finder](https://app.notion.com/p/38a85e927d31800aa470d27c6bb086ec)

---

### E3. Add Route 3 — NS Agent

| Setting | Value |
|---------|--------|
| Router filter | `repository.full_name` = `alvygordo/NS-Agent` |
| Notion database | Build Log — NS Agent |
| GitHub repo webhook | Same Make URL |

Test message: `chore: test notion build log ns agent`

---

### E4. Add Route 4 — SF Agent

| Setting | Value |
|---------|--------|
| Router filter | `repository.full_name` = `alvygordo/SF-Agent` |
| Notion database | Build Log — SF Agent |
| Extra mapping | **Branch** ← `ref` (e.g. show as `main` or full `refs/heads/main`) |
| Type options | Deployment, refactor, docs, chore, fix, feat |

Test message: `chore: test notion build log sf agent`

---

### E5. Add Route 5 — Opp Prep AI

| Setting | Value |
|---------|--------|
| Router filter | `repository.full_name` = `alvygordo/GPT-Opp-Prep` |
| Notion database | Build Log — Opp Prep AI |
| **No Type field** | Map only **Commit** + **Date** |

Test message: `chore: test notion build log opp prep`

---

### E6. Optional — log sandbox branch too

On each route (or once before Router), allow both branches:

```
ref Equal to refs/heads/main
OR
ref Equal to refs/heads/sandbox
```

Or remove branch filter entirely if you only push to those two branches.

---

## Part F — Step-by-step checklist (printable)

| # | Task | Done? |
|---|------|-------|
| 1 | Export Make blueprint | ☐ |
| 2 | Screenshot scenario | ☐ |
| 3 | Baseline Dashboard test push | ☐ |
| 4 | Add Router; Route 1 = agent-dashboard | ☐ |
| 5 | Test Dashboard still logs | ☐ |
| 6 | Add Route 2 CF + GitHub webhook + test | ☐ |
| 7 | Add Route 3 NS + webhook + test | ☐ |
| 8 | Add Route 4 SF + webhook + test | ☐ |
| 9 | Add Route 5 Opp Prep + webhook + test | ☐ |
| 10 | Optional: sandbox branch filter | ☐ |

---

## Part G — Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| GitHub delivery OK, no Notion row | Type not in dropdown | Use `chore` fallback or add option in Notion |
| GitHub delivery OK, no Notion row | Empty/broken filter | Delete incomplete filter rules |
| Only main logs, not sandbox | Branch filter | Add `refs/heads/sandbox` to OR rule |
| Untitled row, empty Commit | Wrong mapping path | Map `head_commit.message`, not blank |
| Wrong database | Router filter typo | Check `repository.full_name` exact match |
| All repos log to Dashboard | Route 1 has no filter | Add repo filter to each route |

---

## Part H — What Cursor / Notion MCP can do vs cannot

| Task | Automated? |
|------|------------|
| Update playbook guides on Notion | ✅ Yes (Notion MCP) |
| Manually backfill build log rows | ✅ Yes (Notion MCP) |
| Export Make blueprint | ❌ You must do in Make UI |
| Add Router / clone routes | ❌ You must do in Make UI |
| Register GitHub webhooks on other repos | ❌ You must do in GitHub UI |

---

## Change log

| Date | Change |
|------|--------|
| 2026-07-03 | Initial backup doc before multi-repo Router upgrade |
