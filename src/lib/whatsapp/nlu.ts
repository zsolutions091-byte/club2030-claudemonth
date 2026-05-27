import Anthropic from '@anthropic-ai/sdk'
import type { WhatsappConfig } from '@/lib/whatsapp/config'

export interface NluContext {
  tasks: { ref: number; id: string; title: string; status: string }[]
}

export type Intent =
  | { kind: 'complete_task'; ref: number }
  | { kind: 'reopen_task'; ref: number }
  | { kind: 'set_status'; ref: number; status: string }
  | { kind: 'snooze_task'; ref: number; dueDate: string }
  | { kind: 'create_task'; title: string; dueDate?: string }
  | { kind: 'list_today' }
  | { kind: 'clarify'; reason?: string }

const SYSTEM = `אתה עוזר שמפענח פקודות וואטסאפ בעברית לניהול משימות.
תמיד הפעל בדיוק כלי אחד. אם לא ברור למה הכוונה — הפעל clarify.
"ref" הוא המספר שמופיע ברשימת המשימות שסופקה. סטטוסים חוקיים: OPEN, IN_PROGRESS, WAITING, DONE, CANCELLED.
תאריכים בפורמט ISO 8601.`

const tools: Anthropic.Tool[] = [
  { name: 'complete_task', description: 'סמן משימה כהושלמה', input_schema: { type: 'object', properties: { ref: { type: 'number' } }, required: ['ref'] } },
  { name: 'reopen_task', description: 'פתח מחדש משימה שהושלמה', input_schema: { type: 'object', properties: { ref: { type: 'number' } }, required: ['ref'] } },
  { name: 'set_status', description: 'שנה סטטוס של משימה', input_schema: { type: 'object', properties: { ref: { type: 'number' }, status: { type: 'string' } }, required: ['ref', 'status'] } },
  { name: 'snooze_task', description: 'דחה משימה לתאריך חדש', input_schema: { type: 'object', properties: { ref: { type: 'number' }, dueDate: { type: 'string' } }, required: ['ref', 'dueDate'] } },
  { name: 'create_task', description: 'צור משימה חדשה', input_schema: { type: 'object', properties: { title: { type: 'string' }, dueDate: { type: 'string' } }, required: ['title'] } },
  { name: 'list_today', description: 'שלח שוב את רשימת המשימות להיום', input_schema: { type: 'object', properties: {} } },
  { name: 'clarify', description: 'הפקודה לא ברורה — בקש הבהרה', input_schema: { type: 'object', properties: { reason: { type: 'string' } } } },
]

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
    messages: [
      {
        role: 'user',
        content:
          `רשימת משימות נוכחית (ref · כותרת · סטטוס):\n` +
          context.tasks.map((t) => `${t.ref}. ${t.title} [${t.status}]`).join('\n') +
          `\n\nההודעה מהמשתמש:\n${text}`,
      },
    ],
  })

  const tool = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
  if (!tool) return { kind: 'clarify' }
  const input = (tool.input ?? {}) as Record<string, unknown>

  switch (tool.name) {
    case 'complete_task': return { kind: 'complete_task', ref: Number(input.ref) }
    case 'reopen_task': return { kind: 'reopen_task', ref: Number(input.ref) }
    case 'set_status': return { kind: 'set_status', ref: Number(input.ref), status: String(input.status) }
    case 'snooze_task': return { kind: 'snooze_task', ref: Number(input.ref), dueDate: String(input.dueDate) }
    case 'create_task': return { kind: 'create_task', title: String(input.title), dueDate: input.dueDate ? String(input.dueDate) : undefined }
    case 'list_today': return { kind: 'list_today' }
    default: return { kind: 'clarify', reason: input.reason ? String(input.reason) : undefined }
  }
}
