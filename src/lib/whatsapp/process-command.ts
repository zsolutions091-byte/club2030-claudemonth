import { completeTask, reopenTask, updateTask, createTask, softDeleteTask } from '@/lib/actions/tasks'
import { createProject } from '@/lib/actions/projects'
import { addTaskTag, removeTaskTag } from '@/lib/actions/tags'
import { resolveRef } from '@/lib/whatsapp/resolve-task'
import { prisma } from '@/lib/db'
import type { Intent, NluContext } from '@/lib/whatsapp/nlu'

const NOT_FOUND = 'לא מצאתי משימה כזו ברשימה. שלח/י "רשימה" כדי לראות שוב.'
const HELP =
  'אפשר לכתוב למשל: "סיימתי את 2", "תפתח מחדש 1", "שנה 3 לבעבודה", "תדחה 2 למחר", "מחק 4", "תוסיף תגית דחוף ל-3", "שייך 1 לפרויקט עבודה", "משימה חדשה: לקנות חלב", "רשימה / שבוע / inbox", או "פרויקט חדש: לימודים".'

const ACTIVE = { notIn: ['DONE', 'CANCELLED'] as ('DONE' | 'CANCELLED')[] }

function title(ctx: NluContext, ref: number): string {
  return ctx.tasks.find((t) => t.ref === ref)?.title ?? ''
}

function formatList(rows: { title: string; status: string }[], heading: string, emptyMsg: string): string {
  if (rows.length === 0) return emptyMsg
  const lines = [heading, '']
  rows.forEach((r, i) => lines.push(`${i + 1}. ${r.title} [${r.status}]`))
  return lines.join('\n')
}

async function listWeek(): Promise<string> {
  const now = new Date()
  const inWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const rows = await prisma.task.findMany({
    where: {
      deletedAt: null, archivedAt: null, status: ACTIVE,
      OR: [{ dueDate: { gte: now, lt: inWeek } }, { dueDate: { lt: now } }],
    },
    orderBy: [{ dueDate: 'asc' }, { priority: 'asc' }],
    select: { title: true, status: true },
    take: 30,
  })
  return formatList(rows, '🗓️ משימות השבוע', 'אין משימות פעילות לשבוע הקרוב 🎉')
}

async function listInbox(): Promise<string> {
  const rows = await prisma.task.findMany({
    where: {
      deletedAt: null, archivedAt: null, status: ACTIVE,
      projectId: null,
    },
    orderBy: [{ createdAt: 'desc' }],
    select: { title: true, status: true },
    take: 30,
  })
  return formatList(rows, '📥 Inbox', 'ה-Inbox ריק 🎉')
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

      case 'list_week':
        return { reply: await listWeek() }

      case 'list_inbox':
        return { reply: await listInbox() }

      case 'create_task': {
        await createTask(
          { title: intent.title, dueDate: intent.dueDate, projectId: intent.projectId },
          'WHATSAPP',
        )
        return { reply: `✅ נוצרה משימה: ${intent.title}` }
      }

      case 'create_project': {
        const project = await createProject({ name: intent.name })
        return { reply: `📁 נוצר פרויקט: ${project.name}` }
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

      case 'set_priority': {
        const id = resolveRef(ctx, intent.ref)
        if (!id) return { reply: NOT_FOUND }
        await updateTask(id, { priority: intent.priority }, 'WHATSAPP')
        return { reply: `🎯 העדיפות של "${title(ctx, intent.ref)}" עודכנה ל-${intent.priority}.` }
      }

      case 'snooze_task': {
        const id = resolveRef(ctx, intent.ref)
        if (!id) return { reply: NOT_FOUND }
        await updateTask(id, { dueDate: intent.dueDate, dueHasTime: true }, 'WHATSAPP')
        return { reply: `⏰ המשימה "${title(ctx, intent.ref)}" נדחתה.` }
      }

      case 'delete_task': {
        const id = resolveRef(ctx, intent.ref)
        if (!id) return { reply: NOT_FOUND }
        await softDeleteTask(id, 'WHATSAPP')
        return { reply: `🗑️ המשימה "${title(ctx, intent.ref)}" נמחקה.` }
      }

      case 'set_project': {
        const id = resolveRef(ctx, intent.ref)
        if (!id) return { reply: NOT_FOUND }
        const project = ctx.projects.find((p) => p.id === intent.projectId)
        if (!project) return { reply: 'הפרויקט לא נמצא. שלח/י "פרויקטים" כדי לראות.' }
        await updateTask(id, { projectId: intent.projectId }, 'WHATSAPP')
        return { reply: `📁 המשימה "${title(ctx, intent.ref)}" שויכה ל-${project.name}.` }
      }

      case 'add_tag': {
        const id = resolveRef(ctx, intent.ref)
        if (!id) return { reply: NOT_FOUND }
        await addTaskTag(id, intent.tag, 'WHATSAPP')
        return { reply: `🏷️ נוספה תגית "${intent.tag}" ל-"${title(ctx, intent.ref)}".` }
      }

      case 'remove_tag': {
        const id = resolveRef(ctx, intent.ref)
        if (!id) return { reply: NOT_FOUND }
        await removeTaskTag(id, intent.tag, 'WHATSAPP')
        return { reply: `🏷️ הוסרה תגית "${intent.tag}" מ-"${title(ctx, intent.ref)}".` }
      }

      default:
        return { reply: HELP }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    if (msg && msg !== 'המשימה לא נמצאה') {
      return { reply: `אירעה שגיאה: ${msg}` }
    }
    return { reply: 'אירעה שגיאה בביצוע הפעולה. נסה/י שוב או פנה/י לאפליקציה.' }
  }
}
