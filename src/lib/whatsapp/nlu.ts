import Anthropic from '@anthropic-ai/sdk'
import type { WhatsappConfig } from '@/lib/whatsapp/config'

export interface NluContext {
  tasks: { ref: number; id: string; title: string; status: string }[]
  focusedTaskId: string | null
  projects: { id: string; name: string }[]
  tags: { id: string; name: string }[]
}

export type Intent =
  | { kind: 'complete_task'; ref: number }
  | { kind: 'reopen_task'; ref: number }
  | { kind: 'set_status'; ref: number; status: string }
  | { kind: 'set_priority'; ref: number; priority: string }
  | { kind: 'snooze_task'; ref: number; dueDate: string }
  | { kind: 'delete_task'; ref: number }
  | { kind: 'set_project'; ref: number; projectId: string }
  | { kind: 'add_tag'; ref: number; tag: string }
  | { kind: 'remove_tag'; ref: number; tag: string }
  | { kind: 'create_task'; title: string; dueDate?: string; projectId?: string }
  | { kind: 'create_project'; name: string }
  | { kind: 'list_today' }
  | { kind: 'list_week' }
  | { kind: 'list_inbox' }
  | { kind: 'clarify'; reason?: string }

const SYSTEM = `אתה עוזר שמפענח פקודות וואטסאפ בעברית לניהול משימות.
תמיד הפעל בדיוק כלי אחד. אם לא ברור למה הכוונה — הפעל clarify.
"ref" הוא המספר שמופיע ברשימת המשימות שסופקה.
סטטוסים חוקיים: OPEN, IN_PROGRESS, WAITING, DONE, CANCELLED.
עדיפויות חוקיות: P1 (דחוף), P2 (גבוה), P3 (בינוני), P4 (נמוך).
projectId הוא ה-id ברשימת הפרויקטים שסופקה — לא שם.
אם המשתמש מזכיר "המשימה הזו" / "זה" / "אותה" — והודעתו מצורפת לתזכורת — הכוון את ה-ref למשימה שב-ref=1 (היא המשימה הממוקדת).
תאריכים בפורמט ISO 8601.`

const tools: Anthropic.Tool[] = [
  { name: 'complete_task', description: 'סמן משימה כהושלמה', input_schema: { type: 'object', properties: { ref: { type: 'number' } }, required: ['ref'] } },
  { name: 'reopen_task', description: 'פתח מחדש משימה שהושלמה', input_schema: { type: 'object', properties: { ref: { type: 'number' } }, required: ['ref'] } },
  { name: 'set_status', description: 'שנה סטטוס של משימה', input_schema: { type: 'object', properties: { ref: { type: 'number' }, status: { type: 'string' } }, required: ['ref', 'status'] } },
  { name: 'set_priority', description: 'שנה עדיפות (P1-P4) של משימה', input_schema: { type: 'object', properties: { ref: { type: 'number' }, priority: { type: 'string', enum: ['P1', 'P2', 'P3', 'P4'] } }, required: ['ref', 'priority'] } },
  { name: 'snooze_task', description: 'דחה משימה לתאריך חדש (ISO 8601)', input_schema: { type: 'object', properties: { ref: { type: 'number' }, dueDate: { type: 'string' } }, required: ['ref', 'dueDate'] } },
  { name: 'delete_task', description: 'מחק משימה (soft delete)', input_schema: { type: 'object', properties: { ref: { type: 'number' } }, required: ['ref'] } },
  { name: 'set_project', description: 'שייך משימה לפרויקט לפי projectId מהרשימה שסופקה', input_schema: { type: 'object', properties: { ref: { type: 'number' }, projectId: { type: 'string' } }, required: ['ref', 'projectId'] } },
  { name: 'add_tag', description: 'הוסף תגית למשימה (לפי שם; תיווצר אם לא קיימת)', input_schema: { type: 'object', properties: { ref: { type: 'number' }, tag: { type: 'string' } }, required: ['ref', 'tag'] } },
  { name: 'remove_tag', description: 'הסר תגית ממשימה', input_schema: { type: 'object', properties: { ref: { type: 'number' }, tag: { type: 'string' } }, required: ['ref', 'tag'] } },
  { name: 'create_task', description: 'צור משימה חדשה (אופציונלי: dueDate ISO, projectId מהרשימה)', input_schema: { type: 'object', properties: { title: { type: 'string' }, dueDate: { type: 'string' }, projectId: { type: 'string' } }, required: ['title'] } },
  { name: 'create_project', description: 'צור פרויקט חדש', input_schema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } },
  { name: 'list_today', description: 'שלח שוב את רשימת המשימות להיום', input_schema: { type: 'object', properties: {} } },
  { name: 'list_week', description: 'הצג את משימות השבוע הקרוב', input_schema: { type: 'object', properties: {} } },
  { name: 'list_inbox', description: 'הצג משימות שלא משויכות לפרויקט', input_schema: { type: 'object', properties: {} } },
  { name: 'clarify', description: 'הפקודה לא ברורה — בקש הבהרה', input_schema: { type: 'object', properties: { reason: { type: 'string' } } } },
]

function formatContextMessage(text: string, context: NluContext): string {
  const lines: string[] = []
  lines.push('רשימת משימות נוכחית (ref · כותרת · סטטוס):')
  if (context.tasks.length === 0) {
    lines.push('(אין משימות פעילות)')
  } else {
    for (const t of context.tasks) {
      const star = context.focusedTaskId === t.id ? ' ⭐ (ממוקדת)' : ''
      lines.push(`${t.ref}. ${t.title} [${t.status}]${star}`)
    }
  }
  if (context.projects.length > 0) {
    lines.push('', 'פרויקטים זמינים (id · שם):')
    for (const p of context.projects) lines.push(`${p.id} · ${p.name}`)
  }
  if (context.tags.length > 0) {
    lines.push('', 'תגיות אחרונות: ' + context.tags.map((t) => t.name).join(', '))
  }
  lines.push('', 'ההודעה מהמשתמש:', text)
  return lines.join('\n')
}

export async function parseCommand(
  cfg: WhatsappConfig,
  text: string,
  context: NluContext,
): Promise<Intent> {
  const client = new Anthropic({ apiKey: cfg.anthropicApiKey })
  const res = await client.messages.create({
    model: cfg.anthropicModel,
    max_tokens: 512,
    system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
    tools,
    tool_choice: { type: 'any' },
    messages: [{ role: 'user', content: formatContextMessage(text, context) }],
  })

  const tool = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
  if (!tool) return { kind: 'clarify' }
  const input = (tool.input ?? {}) as Record<string, unknown>

  switch (tool.name) {
    case 'complete_task': return { kind: 'complete_task', ref: Number(input.ref) }
    case 'reopen_task': return { kind: 'reopen_task', ref: Number(input.ref) }
    case 'set_status': return { kind: 'set_status', ref: Number(input.ref), status: String(input.status) }
    case 'set_priority': return { kind: 'set_priority', ref: Number(input.ref), priority: String(input.priority) }
    case 'snooze_task': return { kind: 'snooze_task', ref: Number(input.ref), dueDate: String(input.dueDate) }
    case 'delete_task': return { kind: 'delete_task', ref: Number(input.ref) }
    case 'set_project': return { kind: 'set_project', ref: Number(input.ref), projectId: String(input.projectId) }
    case 'add_tag': return { kind: 'add_tag', ref: Number(input.ref), tag: String(input.tag) }
    case 'remove_tag': return { kind: 'remove_tag', ref: Number(input.ref), tag: String(input.tag) }
    case 'create_task': return {
      kind: 'create_task',
      title: String(input.title),
      dueDate: input.dueDate ? String(input.dueDate) : undefined,
      projectId: input.projectId ? String(input.projectId) : undefined,
    }
    case 'create_project': return { kind: 'create_project', name: String(input.name) }
    case 'list_today': return { kind: 'list_today' }
    case 'list_week': return { kind: 'list_week' }
    case 'list_inbox': return { kind: 'list_inbox' }
    default: return { kind: 'clarify', reason: input.reason ? String(input.reason) : undefined }
  }
}
