import { describe, it, expect, vi, beforeEach } from 'vitest'

const actions = vi.hoisted(() => ({
  completeTask: vi.fn(async () => ({ id: 'a' })),
  updateTask: vi.fn(async () => ({ id: 'a' })),
  reopenTask: vi.fn(async () => ({ id: 'a' })),
  createTask: vi.fn(async () => ({ id: 'new' })),
}))
// `@/lib/actions/tasks` ('use server') transitively imports `@/lib/db` which
// does `import 'server-only'` — a module Vitest cannot resolve in this repo.
// Mocking those modules short-circuits the import graph (same pattern as
// `src/lib/actions/__tests__/tasks-actor.test.ts`). The actions mock below is
// what actually drives the assertions.
vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: {} }))
vi.mock('@/lib/actions/tasks', () => actions)

import { processCommand } from '@/lib/whatsapp/process-command'

const ctx = { tasks: [{ ref: 1, id: 'a', title: 'לקנות חלב', status: 'OPEN' }] }

describe('processCommand', () => {
  beforeEach(() => vi.clearAllMocks())

  it('completes via WHATSAPP actor and confirms in Hebrew', async () => {
    const { reply } = await processCommand({ kind: 'complete_task', ref: 1 }, ctx)
    expect(actions.completeTask).toHaveBeenCalledWith('a', 'WHATSAPP')
    expect(reply).toContain('הושלמה')
    expect(reply).toContain('לקנות חלב')
  })

  it('handles an unknown ref in Hebrew without calling actions', async () => {
    const { reply } = await processCommand({ kind: 'complete_task', ref: 7 }, ctx)
    expect(actions.completeTask).not.toHaveBeenCalled()
    expect(reply).toContain('לא מצאתי')
  })

  it('creates a task', async () => {
    const { reply } = await processCommand({ kind: 'create_task', title: 'משימה חדשה' }, ctx)
    expect(actions.createTask).toHaveBeenCalledWith(
      { title: 'משימה חדשה', dueDate: undefined }, 'WHATSAPP',
    )
    expect(reply).toContain('נוצרה')
  })
})
