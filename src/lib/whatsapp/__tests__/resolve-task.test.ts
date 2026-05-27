import { describe, it, expect, vi, beforeEach } from 'vitest'

const findMany = vi.fn()
const findUnique = vi.fn()
vi.mock('@/lib/db', () => ({ prisma: {
  task: { findMany: (...a: unknown[]) => findMany(...a) },
  settings: { findUnique: (...a: unknown[]) => findUnique(...a) },
} }))

import { buildContext, resolveRef } from '@/lib/whatsapp/resolve-task'

const cfg = { digestTimezone: 'Asia/Jerusalem' } as never

describe('resolve-task', () => {
  beforeEach(() => vi.clearAllMocks())

  it('numbers by the saved digest snapshot order', async () => {
    findUnique.mockResolvedValue({ value: JSON.stringify({ date: '2026-05-19', taskIds: ['b', 'a'] }) })
    findMany.mockResolvedValue([
      { id: 'a', title: 'A', status: 'OPEN' },
      { id: 'b', title: 'B', status: 'OPEN' },
    ])
    const ctx = await buildContext(new Date('2026-05-19T06:00:00Z'), cfg)
    expect(ctx.tasks.map((t) => `${t.ref}:${t.id}`)).toEqual(['1:b', '2:a'])
    expect(resolveRef(ctx, 2)).toBe('a')
    expect(resolveRef(ctx, 9)).toBeNull()
  })
})
