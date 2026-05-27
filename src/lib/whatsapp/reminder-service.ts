import { prisma } from '@/lib/db'
import { sendText } from '@/lib/green-api/client'
import type { WhatsappConfig } from '@/lib/whatsapp/config'

// Operator-facing English errors (network/config), per project precedent.
// User-facing message body is Hebrew (sent to WhatsApp).

interface DueReminder {
  id: string
  taskId: string
  type: 'BEFORE_DUE' | 'AT_TIME' | 'DAILY_DIGEST'
  scheduledFor: Date | null
  task: { id: string; title: string; status: string; deletedAt: Date | null; archivedAt: Date | null }
}

function formatReminderBody(r: DueReminder): string {
  const lines = [`⏰ תזכורת: ${r.task.title}`]
  if (r.type === 'BEFORE_DUE') {
    lines.push('המשימה מתקרבת ל-due date.')
  } else {
    lines.push('הגיע הזמן למשימה הזו.')
  }
  lines.push('', 'אפשר להשיב: "סיימתי", "תדחה למחר", או "תבטל".')
  return lines.join('\n')
}

export async function runReminderSweep(
  cfg: WhatsappConfig,
  now: Date,
): Promise<{ sent: number; failed: number; skipped: number }> {
  const due = (await prisma.reminder.findMany({
    where: {
      status: 'SCHEDULED',
      channel: 'WHATSAPP',
      scheduledFor: { lte: now },
    },
    orderBy: { scheduledFor: 'asc' },
    take: 50,
    include: {
      task: {
        select: {
          id: true,
          title: true,
          status: true,
          deletedAt: true,
          archivedAt: true,
        },
      },
    },
  })) as unknown as DueReminder[]

  let sent = 0
  let failed = 0
  let skipped = 0

  for (const r of due) {
    // Skip silently: deleted/archived/done/cancelled tasks should not page the user.
    const t = r.task
    if (t.deletedAt || t.archivedAt || t.status === 'DONE' || t.status === 'CANCELLED') {
      await prisma.reminder.update({
        where: { id: r.id },
        data: { status: 'CANCELLED' },
      })
      skipped++
      continue
    }

    const body = formatReminderBody(r)
    try {
      const waMessageId = await sendText(
        { idInstance: cfg.idInstance, tokenInstance: cfg.tokenInstance, apiUrl: cfg.apiUrl },
        cfg.ownerChatId,
        body,
      )
      const sentAt = new Date()
      await prisma.$transaction(async (tx) => {
        await tx.reminder.update({
          where: { id: r.id },
          data: { status: 'SENT', sentAt },
        })
        await tx.outboundMessage.create({
          data: {
            body,
            waMessageId,
            taskId: r.taskId,
            reminderId: r.id,
            status: 'SENT',
            sentAt,
          },
        })
        await tx.taskEvent.create({
          data: {
            taskId: r.taskId,
            type: 'REMINDER_SENT',
            actor: 'SYSTEM',
            payload: JSON.stringify({ reminderId: r.id, reminderType: r.type }),
          },
        })
      })
      sent++
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      await prisma.reminder.update({
        where: { id: r.id },
        data: { status: 'FAILED' },
      })
      await prisma.outboundMessage.create({
        data: {
          body,
          taskId: r.taskId,
          reminderId: r.id,
          status: 'FAILED',
          errorMessage: message.slice(0, 500),
        },
      })
      failed++
    }
  }

  return { sent, failed, skipped }
}
