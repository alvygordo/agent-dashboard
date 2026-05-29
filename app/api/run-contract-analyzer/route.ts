import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const { oppId } = await req.json()

    if (!oppId || typeof oppId !== "string" || !oppId.trim()) {
      return NextResponse.json({ error: "Opportunity ID is required" }, { status: 400 })
    }

    const repo = process.env.GITHUB_REPO
    const token = process.env.GITHUB_PAT

    if (!repo || !token) {
      return NextResponse.json({ error: "Server misconfiguration — missing GitHub credentials" }, { status: 500 })
    }

    const response = await fetch(
      `https://api.github.com/repos/${repo}/actions/workflows/agent.yml/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ref: "main",
          inputs: {
            opp_id: oppId.trim(),
            dry_run: "false",
          },
        }),
      }
    )

    if (!response.ok) {
      const text = await response.text()
      console.error("GitHub API error:", text)
      return NextResponse.json({ error: "Failed to trigger GitHub Actions workflow" }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("run-contract-analyzer error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}