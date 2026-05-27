export interface DigestTask {
  id: string
  title: string
}

export interface DigestInput {
  today: DigestTask[]
  overdue: DigestTask[]
}

/** Ordered task ids matching the numbering in the formatted message. */
export function digestOrder(input: DigestInput): string[] {
  return [...input.today, ...input.overdue].map((t) => t.id)
}

export function formatDigest(input: DigestInput): string {
  if (input.today.length === 0 && input.overdue.length === 0) {
    return 'אין משימות להיום 🎉'
  }
  const lines: string[] = ['📋 משימות להיום', '']
  let n = 1
  for (const task of input.today) {
    lines.push(`${n}. ${task.title}`)
    n++
  }
  if (input.overdue.length > 0) {
    lines.push('', '⚠️ באיחור')
    for (const task of input.overdue) {
      lines.push(`${n}. ${task.title}`)
      n++
    }
  }
  lines.push('', 'אפשר להשיב בהודעה חופשית: לסגור משימה, לשנות סטטוס, ליצור חדשה, או לדחות.')
  return lines.join('\n')
}
