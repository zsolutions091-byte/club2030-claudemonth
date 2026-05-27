import { describe, it, expect, vi, beforeEach } from 'vitest'

const txState = { events: [] as Array<{ type: string; actor: string }> }

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/db', () => ({
  prisma: {
    task: { findUnique: vi.fn(async () => ({ id: 't1', status: 'OPEN', deletedAt: null })) },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) =>
      fn({
        task: { update: vi.fn(async () => ({ id: 't1', status: 'DONE' })) },
        taskEvent: { create: vi.fn(async ({ data }: { data: { type: string; actor: string } }) => { txState.events.push(data) }) },
      }),
    ),
  },
}))

import { completeTask } from '@/lib/actions/tasks'

describe('completeTask actor', () => {
  beforeEach(() => { txState.events = [] })

  it('defaults to USER', async () => {
    await completeTask('t1')
    expect(txState.events[0].actor).toBe('USER')
  })

  it('records WHATSAPP when passed', async () => {
    await completeTask('t1', 'WHATSAPP')
    expect(txState.events[0].actor).toBe('WHATSAPP')
  })
})
