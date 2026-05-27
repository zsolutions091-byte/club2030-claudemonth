import { prisma } from '@/lib/db'
import { localDayWindow, localDateKey } from '@/lib/whatsapp/time'
import type { WhatsappConfig } from '@/lib/whatsapp/config'
import type { NluContext } from '@/lib/whatsapp/nlu'

const LAST_DIGEST_KEY = 'whatsapp:lastDigest'
const ACTIVE = { notIn: ['DONE', 'CANCELLED'] as ('DONE' | 'CANCELLED')[] }

export async function buildContext(
  now: Date,
  cfg: WhatsappConfig,
  focusedTaskId: string | null = null,
): Promise<NluContext> {
  const { start, end } = localDayWindow(now, cfg.digestTimezone)
  const rows = await prisma.task.findMany({
    where: {
      deletedAt: null, archivedAt: null, status: ACTIVE,
      OR: [{ dueDate: { gte: start, lt: end } }, { dueDate: { lt: start } }],
    },
    select: { id: true, title: true, status: true },
  })
  const byId = new Map(rows.map((r) => [r.id, r]))

  // If the user replied to a reminder for a task that isn't in today/overdue
  // (e.g. dueDate later this week), pull it in so the NLU can act on it.
  if (focusedTaskId && !byId.has(focusedTaskId)) {
    const focused = await prisma.task.findFirst({
      where: { id: focusedTaskId, deletedAt: null, archivedAt: null, status: ACTIVE },
      select: { id: true, title: true, status: true },
    })
    if (focused) byId.set(focused.id, focused)
  }

  let order = Array.from(byId.keys())
  const snap = await prisma.settings.findUnique({ where: { key: LAST_DIGEST_KEY } })
  if (snap) {
    try {
      const parsed = JSON.parse(snap.value) as { date?: string; taskIds?: string[] }
      if (parsed.date === localDateKey(now, cfg.digestTimezone) && Array.isArray(parsed.taskIds)) {
        const fromSnap = parsed.taskIds.filter((id) => byId.has(id))
        const extras = order.filter((id) => !fromSnap.includes(id))
        order = [...fromSnap, ...extras]
      }
    } catch {
      // corrupt snapshot — keep freshly-queried order
    }
  }

  // Promote focused task to ref=1 — the user replied to it; treat it as the default target.
  if (focusedTaskId && byId.has(focusedTaskId)) {
    order = [focusedTaskId, ...order.filter((id) => id !== focusedTaskId)]
  }

  // Side-load active projects + recent tags so the NLU can resolve names → ids.
  const [projects, tags] = await Promise.all([
    prisma.project.findMany({
      where: { deletedAt: null, isArchived: false },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true },
      take: 50,
    }),
    prisma.tag.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true },
      take: 50,
    }),
  ])

  return {
    tasks: order.map((id, i) => {
      const r = byId.get(id)!
      return { ref: i + 1, id: r.id, title: r.title, status: r.status }
    }),
    focusedTaskId: focusedTaskId ?? null,
    projects: projects.map((p) => ({ id: p.id, name: p.name })),
    tags: tags.map((t) => ({ id: t.id, name: t.name })),
  }
}

export function resolveRef(ctx: NluContext, ref: number): string | null {
  return ctx.tasks.find((t) => t.ref === ref)?.id ?? null
}
