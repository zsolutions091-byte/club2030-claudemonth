import { describe, it, expect, vi, beforeEach } from 'vitest'

const txState = {
  events: [] as Array<{ type: string; actor: string }>,
  reminderUpdates: [] as Array<{ where: unknown; data: unknown }>,
}

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/db', () => ({
  prisma: {
    task: { findUnique: vi.fn(async () => ({ id: 't1', status: 'OPEN', deletedAt: null })) },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) =>
      fn({
        task: { update: vi.fn(async () => ({ id: 't1', status: 'DONE' })) },
        taskEvent: { create: vi.fn(async ({ data }: { data: { type: string; actor: string } }) => { txState.events.push(data) }) },
        reminder: {
          updateMany: vi.fn(async (args: { where: unknown; data: unknown }) => {
            txState.reminderUpdates.push(args)
            return { count: 0 }
          }),
          create: vi.fn(async () => undefined),
        },
      }),
    ),
  },
}))

import { completeTask } from '@/lib/actions/tasks'

describe('completeTask actor', () => {
  beforeEach(() => { txState.events = []; txState.reminderUpdates = [] })

  it('defaults to USER', async () => {
    await completeTask('t1')
    expect(txState.events[0].actor).toBe('USER')
  })

  it('records WHATSAPP when passed', async () => {
    await completeTask('t1', 'WHATSAPP')
    expect(txState.events[0].actor).toBe('WHATSAPP')
  })

  it('cancels pending reminders on completion', async () => {
    await completeTask('t1')
    expect(txState.reminderUpdates).toHaveLength(1)
    expect(txState.reminderUpdates[0].data).toEqual({ status: 'CANCELLED' })
    expect(txState.reminderUpdates[0].where).toEqual({ taskId: 't1', status: 'SCHEDULED' })
  })
})
