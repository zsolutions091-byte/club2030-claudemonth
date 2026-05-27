import { describe, it, expect, vi, beforeEach } from 'vitest'

const taskActions = vi.hoisted(() => ({
  completeTask: vi.fn(async () => ({ id: 'a' })),
  updateTask: vi.fn(async () => ({ id: 'a' })),
  reopenTask: vi.fn(async () => ({ id: 'a' })),
  createTask: vi.fn(async () => ({ id: 'new' })),
  softDeleteTask: vi.fn(async () => ({ id: 'a' })),
}))
const projectActions = vi.hoisted(() => ({
  createProject: vi.fn(async () => ({ id: 'p-new', name: 'לימודים' })),
}))
const tagActions = vi.hoisted(() => ({
  addTaskTag: vi.fn(async () => ({ tag: { id: 't1', name: 'דחוף' } })),
  removeTaskTag: vi.fn(async () => ({ tag: { id: 't1', name: 'דחוף' } })),
}))

// `@/lib/actions/*` ('use server') transitively import `@/lib/db` which does
// `import 'server-only'` — Vitest cannot resolve it. Mock the import graph.
vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/db', () => ({
  prisma: {
    task: { findMany: vi.fn(async () => []) },
  },
}))
vi.mock('@/lib/actions/tasks', () => taskActions)
vi.mock('@/lib/actions/projects', () => projectActions)
vi.mock('@/lib/actions/tags', () => tagActions)

import { processCommand } from '@/lib/whatsapp/process-command'

const ctx = {
  tasks: [{ ref: 1, id: 'a', title: 'לקנות חלב', status: 'OPEN' }],
  focusedTaskId: null,
  projects: [{ id: 'p1', name: 'עבודה' }],
  tags: [{ id: 't1', name: 'דחוף' }],
}

describe('processCommand', () => {
  beforeEach(() => vi.clearAllMocks())

  it('completes via WHATSAPP actor and confirms in Hebrew', async () => {
    const { reply } = await processCommand({ kind: 'complete_task', ref: 1 }, ctx)
    expect(taskActions.completeTask).toHaveBeenCalledWith('a', 'WHATSAPP')
    expect(reply).toContain('הושלמה')
    expect(reply).toContain('לקנות חלב')
  })

  it('handles an unknown ref in Hebrew without calling actions', async () => {
    const { reply } = await processCommand({ kind: 'complete_task', ref: 7 }, ctx)
    expect(taskActions.completeTask).not.toHaveBeenCalled()
    expect(reply).toContain('לא מצאתי')
  })

  it('creates a task with optional fields', async () => {
    const { reply } = await processCommand(
      { kind: 'create_task', title: 'משימה חדשה' },
      ctx,
    )
    expect(taskActions.createTask).toHaveBeenCalledWith(
      { title: 'משימה חדשה', dueDate: undefined, projectId: undefined },
      'WHATSAPP',
    )
    expect(reply).toContain('נוצרה')
  })

  it('soft-deletes a task', async () => {
    const { reply } = await processCommand({ kind: 'delete_task', ref: 1 }, ctx)
    expect(taskActions.softDeleteTask).toHaveBeenCalledWith('a', 'WHATSAPP')
    expect(reply).toContain('נמחקה')
  })

  it('sets priority via updateTask', async () => {
    const { reply } = await processCommand(
      { kind: 'set_priority', ref: 1, priority: 'P1' },
      ctx,
    )
    expect(taskActions.updateTask).toHaveBeenCalledWith('a', { priority: 'P1' }, 'WHATSAPP')
    expect(reply).toContain('P1')
  })

  it('assigns a known project', async () => {
    const { reply } = await processCommand(
      { kind: 'set_project', ref: 1, projectId: 'p1' },
      ctx,
    )
    expect(taskActions.updateTask).toHaveBeenCalledWith('a', { projectId: 'p1' }, 'WHATSAPP')
    expect(reply).toContain('עבודה')
  })

  it('rejects an unknown project gracefully', async () => {
    const { reply } = await processCommand(
      { kind: 'set_project', ref: 1, projectId: 'p-missing' },
      ctx,
    )
    expect(taskActions.updateTask).not.toHaveBeenCalled()
    expect(reply).toContain('הפרויקט לא נמצא')
  })

  it('adds a tag', async () => {
    const { reply } = await processCommand(
      { kind: 'add_tag', ref: 1, tag: 'דחוף' },
      ctx,
    )
    expect(tagActions.addTaskTag).toHaveBeenCalledWith('a', 'דחוף', 'WHATSAPP')
    expect(reply).toContain('דחוף')
  })

  it('removes a tag', async () => {
    const { reply } = await processCommand(
      { kind: 'remove_tag', ref: 1, tag: 'דחוף' },
      ctx,
    )
    expect(tagActions.removeTaskTag).toHaveBeenCalledWith('a', 'דחוף', 'WHATSAPP')
    expect(reply).toContain('הוסרה')
  })

  it('creates a project', async () => {
    const { reply } = await processCommand(
      { kind: 'create_project', name: 'לימודים' },
      ctx,
    )
    expect(projectActions.createProject).toHaveBeenCalledWith({ name: 'לימודים' })
    expect(reply).toContain('נוצר פרויקט')
  })
})
