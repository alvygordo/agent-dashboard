export type TaskWorkflowAction = {
  type: 'sq-reviewer'
  oppName: string
  label: 'SQ Reviewer' | 'Provisioning'
}

export function getTaskWorkflowAction(
  subject: string,
  whatName: string | null,
): TaskWorkflowAction | null {
  const sub = subject.toLowerCase()

  if (sub.includes('signed quote review')) {
    return { type: 'sq-reviewer', oppName: whatName ?? subject, label: 'SQ Reviewer' }
  }

  if (
    sub.includes('auto-renew opp')
    || sub.includes('auto renew opp')
    || (sub.includes('provisioning ticket') && sub.includes('auto renewal'))
  ) {
    return { type: 'sq-reviewer', oppName: whatName ?? subject, label: 'Provisioning' }
  }

  return null
}

export function isCancelArQuotesTask(subject: string): boolean {
  return subject.toLowerCase().includes('cancel ar quote')
}
