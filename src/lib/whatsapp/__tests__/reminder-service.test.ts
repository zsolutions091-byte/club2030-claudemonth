import { describe, it, expect, vi, beforeEach } from 'vitest'

const state = {
  due: [] as unknown[],
  sendText: vi.fn(async () => 'WA-OUT-1'),
  reminderUpdates: [] as Array<{ id: string; data: unknown }>,
  outboundCreates: [] as Array<Record<string, unknown>>,
  events: [] as Array<{ taskId: string; type: string; actor: string }>,
}

vi.mock('@/lib/green-api/client', () => ({ sendText: (...a: unknown[]) => state.sendText(...a) }))
vi.mock('@/lib/db', () => ({
  prisma: {
    reminder: {
      findMany: vi.fn(async () => state.due),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: unknown }) => {
        state.reminderUpdates.push({ id: where.id, data })
        return { id: where.id }
      }),
    },
    outboundMessage: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        state.outboundCreates.push(data)
        return data
      }),
    },
    taskEvent: { create: vi.fn() },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) =>
      fn({
        reminder: {
          update: vi.fn(async ({ where, data }: { where: { id: string }; data: unknown }) => {
            state.reminderUpdates.push({ id: where.id, data })
            return { id: where.id }
          }),
        },
        outboundMessage: {
          create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
            state.outboundCreates.push(data)
            return data
          }),
        },
        taskEvent: {
          create: vi.fn(async ({ data }: { data: { taskId: string; type: string; actor: string } }) => {
            state.events.push(data)
          }),
        },
      }),
    ),
  },
}))

import { runReminderSweep } from '@/lib/whatsapp/reminder-service'

const cfg = {
  idInstance: '1',
  tokenInstance: 't',
  apiUrl: 'https://api.green-api.com',
  ownerChatId: '972500000000@c.us',
} as never

const activeTask = {
  id: 'task-1',
  title: 'משימה לבדיקה',
  status: 'OPEN',
  deletedAt: null,
  archivedAt: null,
}

function makeReminder(overrides: Partial<{ id: string; type: string; task: typeof activeTask }> = {}) {
  return {
    id: overrides.id ?? 'rem-1',
    taskId: overrides.task?.id ?? activeTask.id,
    type: overrides.type ?? 'AT_TIME',
    scheduledFor: new Date('2026-05-27T08:00:00Z'),
    task: overrides.task ?? activeTask,
  }
}

describe('runReminderSweep', () => {
  beforeEach(() => {
    state.due = []
    state.reminderUpdates = []
    state.outboundCreates = []
    state.events = []
    vi.clearAllMocks()
  })

  it('returns zeroes when nothing is due', async () => {
    const res = await runReminderSweep(cfg, new Date('2026-05-27T08:00:00Z'))
    expect(res).toEqual({ sent: 0, failed: 0, skipped: 0 })
    expect(state.sendText).not.toHaveBeenCalled()
  })

  it('sends due reminder, marks SENT, persists OutboundMessage + REMINDER_SENT event', async () => {
    state.due = [makeReminder()]
    const res = await runReminderSweep(cfg, new Date('2026-05-27T08:05:00Z'))
    expect(res).toEqual({ sent: 1, failed: 0, skipped: 0 })
    expect(state.sendText).toHaveBeenCalledOnce()

    const sentUpdate = state.reminderUpdates.find((u) => (u.data as { status: string }).status === 'SENT')
    expect(sentUpdate).toBeDefined()

    expect(state.outboundCreates).toHaveLength(1)
    expect(state.outboundCreates[0].taskId).toBe('task-1')
    expect(state.outboundCreates[0].reminderId).toBe('rem-1')
    expect(state.outboundCreates[0].status).toBe('SENT')

    expect(state.events).toHaveLength(1)
    expect(state.events[0]).toMatchObject({ taskId: 'task-1', type: 'REMINDER_SENT', actor: 'SYSTEM' })
  })

  it('cancels reminder silently when task is DONE/CANCELLED/archived/deleted', async () => {
    state.due = [makeReminder({ task: { ...activeTask, status: 'DONE' } })]
    const res = await runReminderSweep(cfg, new Date('2026-05-27T08:05:00Z'))
    expect(res).toEqual({ sent: 0, failed: 0, skipped: 1 })
    expect(state.sendText).not.toHaveBeenCalled()
    expect(state.reminderUpdates[0]?.data).toEqual({ status: 'CANCELLED' })
  })

  it('marks FAILED and records error when sendText throws', async () => {
    state.due = [makeReminder()]
    state.sendText.mockRejectedValueOnce(new Error('Green API send failed: 500'))
    const res = await runReminderSweep(cfg, new Date('2026-05-27T08:05:00Z'))
    expect(res).toEqual({ sent: 0, failed: 1, skipped: 0 })
    expect(state.reminderUpdates[0]?.data).toEqual({ status: 'FAILED' })
    expect(state.outboundCreates[0].status).toBe('FAILED')
    expect(state.outboundCreates[0].errorMessage).toMatch(/Green API/)
  })
})
