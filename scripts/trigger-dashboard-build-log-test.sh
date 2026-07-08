#!/usr/bin/env bash
# Test Dashboard Notion build log via Vercel API (replaces Make webhook).
# Usage: ./scripts/trigger-dashboard-build-log-test.sh ["commit message"]
set -euo pipefail

API_URL="${BUILD_LOG_API_URL:-https://so-agent-dashboard.vercel.app/api/build-log}"
MSG="${1:-chore: build log api test from script}"

payload=$(jq -n --arg subject "$MSG" '{subject: $subject}')

echo "Posting to $API_URL ..."
code=$(curl -s -o /tmp/build-log-response.txt -w "%{http_code}" \
  -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d "$payload")

echo "HTTP $code"
cat /tmp/build-log-response.txt
echo ""

if [ "$code" -ge 400 ]; then
  echo "Failed. Ensure NOTION_TOKEN is set on Vercel (so-agent-dashboard project)."
  exit 1
fi

echo "Check Build Log — Dashboard in Notion for: $MSG"
