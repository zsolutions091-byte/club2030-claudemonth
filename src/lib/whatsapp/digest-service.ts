import { prisma } from '@/lib/db'
import { sendText } from '@/lib/green-api/client'
import { formatDigest, digestOrder, type DigestTask } from '@/lib/whatsapp/digest'
import { localDayWindow, localDateKey } from '@/lib/whatsapp/time'
import type { WhatsappConfig } from '@/lib/whatsapp/config'

const LAST_DIGEST_KEY = 'whatsapp:lastDigest'
const ACTIVE = { notIn: ['DONE', 'CANCELLED'] as ('DONE' | 'CANCELLED')[] }

export async function runDailyDigest(
  cfg: WhatsappConfig,
  now: Date,
): Promise<{ sent: boolean; count: number }> {
  const { start, end } = localDayWindow(now, cfg.digestTimezone)

  const [today, overdue] = await Promise.all([
    prisma.task.findMany({
      where: {
        deletedAt: null, archivedAt: null, status: ACTIVE,
        dueDate: { gte: start, lt: end },
      },
      orderBy: [{ priority: 'asc' }, { dueDate: 'asc' }],
      select: { id: true, title: true },
    }),
    prisma.task.findMany({
      where: {
        deletedAt: null, archivedAt: null, status: ACTIVE,
        dueDate: { lt: start },
      },
      orderBy: [{ dueDate: 'asc' }],
      select: { id: true, title: true },
    }),
  ])

  const input = { today: today as DigestTask[], overdue: overdue as DigestTask[] }
  const body = formatDigest(input)
  const order = digestOrder(input)
  const dateKey = localDateKey(now, cfg.digestTimezone)

  const waMessageId = await sendText(
    { idInstance: cfg.idInstance, tokenInstance: cfg.tokenInstance, apiUrl: cfg.apiUrl },
    cfg.ownerChatId,
    body,
  )

  await prisma.$transaction(async (tx) => {
    await tx.outboundMessage.create({
      data: { body, waMessageId, status: 'SENT', sentAt: new Date() },
    })
    await tx.settings.upsert({
      where: { key: LAST_DIGEST_KEY },
      create: { key: LAST_DIGEST_KEY, value: JSON.stringify({ date: dateKey, taskIds: order }) },
      update: { value: JSON.stringify({ date: dateKey, taskIds: order }) },
    })
    for (const id of order) {
      await tx.taskEvent.create({
        data: { taskId: id, type: 'REMINDER_SENT', actor: 'SYSTEM' },
      })
    }
  })

  return { sent: true, count: order.length }
}
