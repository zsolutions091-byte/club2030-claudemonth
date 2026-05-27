import { completeTask, reopenTask, updateTask, createTask } from '@/lib/actions/tasks'
import { resolveRef } from '@/lib/whatsapp/resolve-task'
import type { Intent, NluContext } from '@/lib/whatsapp/nlu'

const NOT_FOUND = 'לא מצאתי משימה כזו ברשימה. שלח/י "רשימה" כדי לראות שוב.'
const HELP =
  'אפשר לכתוב למשל: "סיימתי את 2", "תפתח מחדש 1", "שנה 3 לבעבודה", "תדחה 2 למחר", "משימה חדשה: לקנות חלב", או "רשימה".'

function title(ctx: NluContext, ref: number): string {
  return ctx.tasks.find((t) => t.ref === ref)?.title ?? ''
}

export async function processCommand(
  intent: Intent,
  ctx: NluContext,
): Promise<{ reply: string }> {
  try {
    switch (intent.kind) {
      case 'clarify':
        return { reply: HELP }

      case 'list_today': {
        if (ctx.tasks.length === 0) return { reply: 'אין משימות פתוחות להיום 🎉' }
        return {
          reply: ctx.tasks.map((t) => `${t.ref}. ${t.title} [${t.status}]`).join('\n'),
        }
      }

      case 'create_task': {
        await createTask({ title: intent.title, dueDate: intent.dueDate }, 'WHATSAPP')
        return { reply: `✅ נוצרה משימה: ${intent.title}` }
      }

      case 'complete_task': {
        const id = resolveRef(ctx, intent.ref)
        if (!id) return { reply: NOT_FOUND }
        await completeTask(id, 'WHATSAPP')
        return { reply: `✅ המשימה "${title(ctx, intent.ref)}" הושלמה.` }
      }

      case 'reopen_task': {
        const id = resolveRef(ctx, intent.ref)
        if (!id) return { reply: NOT_FOUND }
        await reopenTask(id, 'WHATSAPP')
        return { reply: `↩️ המשימה "${title(ctx, intent.ref)}" נפתחה מחדש.` }
      }

      case 'set_status': {
        const id = resolveRef(ctx, intent.ref)
        if (!id) return { reply: NOT_FOUND }
        await updateTask(id, { status: intent.status }, 'WHATSAPP')
        return { reply: `🔁 הסטטוס של "${title(ctx, intent.ref)}" עודכן ל-${intent.status}.` }
      }

      case 'snooze_task': {
        const id = resolveRef(ctx, intent.ref)
        if (!id) return { reply: NOT_FOUND }
        await updateTask(id, { dueDate: intent.dueDate }, 'WHATSAPP')
        return { reply: `⏰ המשימה "${title(ctx, intent.ref)}" נדחתה.` }
      }

      default:
        return { reply: HELP }
    }
  } catch {
    return { reply: 'אירעה שגיאה בביצוע הפעולה. נסה/י שוב או פנה/י לאפליקציה.' }
  }
}
