import { prisma } from '@/lib/db'
import { localDayWindow, localDateKey } from '@/lib/whatsapp/time'
import type { WhatsappConfig } from '@/lib/whatsapp/config'
import type { NluContext } from '@/lib/whatsapp/nlu'

const LAST_DIGEST_KEY = 'whatsapp:lastDigest'
const ACTIVE = { notIn: ['DONE', 'CANCELLED'] as ('DONE' | 'CANCELLED')[] }

export async function buildContext(now: Date, cfg: WhatsappConfig): Promise<NluContext> {
  const { start, end } = localDayWindow(now, cfg.digestTimezone)
  const rows = await prisma.task.findMany({
    where: {
      deletedAt: null, archivedAt: null, status: ACTIVE,
      OR: [{ dueDate: { gte: start, lt: end } }, { dueDate: { lt: start } }],
    },
    select: { id: true, title: true, status: true },
  })
  const byId = new Map(rows.map((r) => [r.id, r]))

  let order = rows.map((r) => r.id)
  const snap = await prisma.settings.findUnique({ where: { key: LAST_DIGEST_KEY } })
  if (snap) {
    try {
      const parsed = JSON.parse(snap.value) as { date?: string; taskIds?: string[] }
      if (parsed.date === localDateKey(now, cfg.digestTimezone) && Array.isArray(parsed.taskIds)) {
        order = parsed.taskIds.filter((id) => byId.has(id))
      }
    } catch {
      // corrupt snapshot — keep freshly-queried order
    }
  }

  return {
    tasks: order.map((id, i) => {
      const r = byId.get(id)!
      return { ref: i + 1, id: r.id, title: r.title, status: r.status }
    }),
  }
}

export function resolveRef(ctx: NluContext, ref: number): string | null {
  return ctx.tasks.find((t) => t.ref === ref)?.id ?? null
}
