import { describe, it, expect, vi, beforeEach } from 'vitest'

const taskFindMany = vi.fn()
const taskFindFirst = vi.fn(async () => null)
const settingsFindUnique = vi.fn()
const projectFindMany = vi.fn(async () => [])
const tagFindMany = vi.fn(async () => [])

vi.mock('@/lib/db', () => ({ prisma: {
  task: {
    findMany: (...a: unknown[]) => taskFindMany(...a),
    findFirst: (...a: unknown[]) => taskFindFirst(...a),
  },
  settings: { findUnique: (...a: unknown[]) => settingsFindUnique(...a) },
  project: { findMany: (...a: unknown[]) => projectFindMany(...a) },
  tag: { findMany: (...a: unknown[]) => tagFindMany(...a) },
} }))

import { buildContext, resolveRef } from '@/lib/whatsapp/resolve-task'

const cfg = { digestTimezone: 'Asia/Jerusalem' } as never

describe('resolve-task', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    taskFindFirst.mockResolvedValue(null)
    projectFindMany.mockResolvedValue([])
    tagFindMany.mockResolvedValue([])
    settingsFindUnique.mockResolvedValue(null)
  })

  it('numbers by the saved digest snapshot order', async () => {
    settingsFindUnique.mockResolvedValue({
      value: JSON.stringify({ date: '2026-05-19', taskIds: ['b', 'a'] }),
    })
    taskFindMany.mockResolvedValue([
      { id: 'a', title: 'A', status: 'OPEN' },
      { id: 'b', title: 'B', status: 'OPEN' },
    ])
    const ctx = await buildContext(new Date('2026-05-19T06:00:00Z'), cfg)
    expect(ctx.tasks.map((t) => `${t.ref}:${t.id}`)).toEqual(['1:b', '2:a'])
    expect(resolveRef(ctx, 2)).toBe('a')
    expect(resolveRef(ctx, 9)).toBeNull()
    expect(ctx.focusedTaskId).toBeNull()
    expect(ctx.projects).toEqual([])
    expect(ctx.tags).toEqual([])
  })

  it('promotes the focused task to ref=1 even when not first in snapshot', async () => {
    settingsFindUnique.mockResolvedValue(null)
    taskFindMany.mockResolvedValue([
      { id: 'a', title: 'A', status: 'OPEN' },
      { id: 'b', title: 'B', status: 'OPEN' },
    ])
    const ctx = await buildContext(new Date('2026-05-19T06:00:00Z'), cfg, 'b')
    expect(ctx.tasks[0].id).toBe('b')
    expect(ctx.tasks[0].ref).toBe(1)
    expect(ctx.focusedTaskId).toBe('b')
  })

  it('pulls in a focused task that is outside today/overdue window', async () => {
    settingsFindUnique.mockResolvedValue(null)
    taskFindMany.mockResolvedValue([
      { id: 'a', title: 'A', status: 'OPEN' },
    ])
    taskFindFirst.mockResolvedValue({ id: 'far', title: 'Far Future', status: 'OPEN' })
    const ctx = await buildContext(new Date('2026-05-19T06:00:00Z'), cfg, 'far')
    expect(ctx.tasks.map((t) => t.id)).toEqual(['far', 'a'])
    expect(ctx.focusedTaskId).toBe('far')
  })

  it('exposes active projects and recent tags', async () => {
    taskFindMany.mockResolvedValue([])
    projectFindMany.mockResolvedValue([{ id: 'p1', name: 'עבודה' }])
    tagFindMany.mockResolvedValue([{ id: 't1', name: 'דחוף' }])
    const ctx = await buildContext(new Date('2026-05-19T06:00:00Z'), cfg)
    expect(ctx.projects).toEqual([{ id: 'p1', name: 'עבודה' }])
    expect(ctx.tags).toEqual([{ id: 't1', name: 'דחוף' }])
  })
})
