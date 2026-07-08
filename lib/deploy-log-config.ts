/** Vercel production project name → Notion Agent label */
export const VERCEL_PROJECT_TO_AGENT: Record<string, string> = {
  'so-agent-dashboard': 'Dashboard',
  'so-contract-finder': 'Contract Finder',
  'gpt-opp-prep': 'Opp Prep AI',
  'so-sf-agent': 'SF Agent',
  'ns-agent': 'NS Agent',
  'sandbox-agent-dashboard': 'Dashboard (sandbox)',
  'sandbox-contract-finder': 'Contract Finder (sandbox)',
  'sandbox-opp-prep': 'Opp Prep AI (sandbox)',
  'sandbox-sf-agent': 'SF Agent (sandbox)',
}

export function agentForVercelProject(projectName: string): string | null {
  return VERCEL_PROJECT_TO_AGENT[projectName] ?? null
}

export function commitType(commit: string): string {
  const prefix = commit.split(':')[0]?.trim() ?? ''
  switch (prefix) {
    case 'feat':
    case 'fix':
    case 'chore':
    case 'revert':
    case 'debug':
    case 'temp':
      return prefix
    case 'docs':
      return 'chore'
    default:
      return prefix.startsWith('Merge') ? 'Merge sandbox' : 'chore'
  }
}
