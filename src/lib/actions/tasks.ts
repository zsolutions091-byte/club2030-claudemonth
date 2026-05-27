'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import {
  taskCreateSchema,
  taskUpdateSchema,
  type TaskCreateInput,
} from '@/lib/validators/task'

type Actor = 'USER' | 'WHATSAPP' | 'SYSTEM'

// PRD §4.10 — which fields trigger an UPDATED event
const LOGGED_FIELDS = [
  'title',
  'description',
  'dueDate',
  'startDate',
  'priority',
  'projectId',
] as const

function toDate(value: string | undefined | null): Date | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  return new Date(value)
}

function normalizeCreate(input: TaskCreateInput) {
  return {
    title: input.title,
    description: input.description ?? null,
    status: input.status,
    priority: input.priority,
    dueDate: toDate(input.dueDate ?? null) ?? null,
    dueHasTime: input.dueHasTime,
    startDate: toDate(input.startDate ?? null) ?? null,
    estimatedMinutes: input.estimatedMinutes ?? null,
    projectId: input.projectId ?? null,
  }
}

// Auto-reminder helpers (Phase 2 — Green API).
// Rule: when a Task has dueDate AND dueHasTime AND dueDate>now AND status is active,
// keep exactly one SCHEDULED Reminder of type=AT_TIME on the task with scheduledFor=dueDate.
// Removing/changing dueDate or completing/cancelling the task → cancel pending reminders.

type ReminderTx = {
  reminder: {
    updateMany: (args: {
      where: Record<string, unknown>
      data: Record<string, unknown>
    }) => Promise<{ count: number }>
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>
  }
}

async function cancelPendingReminders(tx: ReminderTx, taskId: string): Promise<void> {
  await tx.reminder.updateMany({
    where: { taskId, status: 'SCHEDULED' },
    data: { status: 'CANCELLED' },
  })
}

async function syncAtTimeReminder(
  tx: ReminderTx,
  taskId: string,
  dueDate: Date | null,
  dueHasTime: boolean,
  status: string,
  now: Date,
): Promise<void> {
  // Always cancel pending first — idempotent.
  await cancelPendingReminders(tx, taskId)

  const isActive = status !== 'DONE' && status !== 'CANCELLED'
  if (!isActive) return
  if (!dueDate || !dueHasTime) return
  if (dueDate.getTime() <= now.getTime()) return

  await tx.reminder.create({
    data: {
      taskId,
      type: 'AT_TIME',
      channel: 'WHATSAPP',
      scheduledFor: dueDate,
      status: 'SCHEDULED',
    },
  })
}

export async function createTask(rawInput: unknown, actor: Actor = 'USER') {
  const input = taskCreateSchema.parse(rawInput)
  const data = normalizeCreate(input)
  const now = new Date()

  const task = await prisma.$transaction(async (tx) => {
    const created = await tx.task.create({ data })
    await tx.taskEvent.create({
      data: {
        taskId: created.id,
        type: 'CREATED',
        actor,
        payload: JSON.stringify({ initial: data }),
      },
    })
    await syncAtTimeReminder(
      tx as unknown as ReminderTx,
      created.id,
      created.dueDate,
      created.dueHasTime,
      created.status,
      now,
    )
    return created
  })

  revalidatePath('/all')
  return task
}

export async function updateTask(id: string, rawInput: unknown, actor: Actor = 'USER') {
  const input = taskUpdateSchema.parse(rawInput)

  const existing = await prisma.task.findUnique({ where: { id } })
  if (!existing || existing.deletedAt) throw new Error('המשימה לא נמצאה')

  const next: Record<string, unknown> = {}
  if (input.title !== undefined) next.title = input.title
  if (input.description !== undefined) next.description = input.description ?? null
  if (input.status !== undefined) next.status = input.status
  if (input.priority !== undefined) next.priority = input.priority
  if (input.dueDate !== undefined) next.dueDate = toDate(input.dueDate)
  if (input.dueHasTime !== undefined) next.dueHasTime = input.dueHasTime
  if (input.startDate !== undefined) next.startDate = toDate(input.startDate)
  if (input.estimatedMinutes !== undefined) next.estimatedMinutes = input.estimatedMinutes ?? null
  if (input.projectId !== undefined) next.projectId = input.projectId ?? null

  const events: Array<{ type: 'UPDATED' | 'STATUS_CHANGED'; payload: string }> = []

  // status change → dedicated event
  if (next.status !== undefined && next.status !== existing.status) {
    events.push({
      type: 'STATUS_CHANGED',
      payload: JSON.stringify({ field: 'status', from: existing.status, to: next.status }),
    })
  }

  // other logged-field changes → UPDATED events
  for (const field of LOGGED_FIELDS) {
    if (next[field] === undefined) continue
    const before = (existing as Record<string, unknown>)[field]
    const after = next[field]
    const beforeKey = before instanceof Date ? before.toISOString() : before
    const afterKey = after instanceof Date ? after.toISOString() : after
    if (beforeKey !== afterKey) {
      events.push({
        type: 'UPDATED',
        payload: JSON.stringify({ field, from: before ?? null, to: after ?? null }),
      })
    }
  }

  const now = new Date()
  const task = await prisma.$transaction(async (tx) => {
    const updated = await tx.task.update({ where: { id }, data: next })
    for (const ev of events) {
      await tx.taskEvent.create({
        data: { taskId: id, type: ev.type, actor, payload: ev.payload },
      })
    }
    // If anything reminder-relevant changed, re-sync.
    if (
      next.dueDate !== undefined ||
      next.dueHasTime !== undefined ||
      next.status !== undefined
    ) {
      await syncAtTimeReminder(
        tx as unknown as ReminderTx,
        id,
        updated.dueDate,
        updated.dueHasTime,
        updated.status,
        now,
      )
    }
    return updated
  })

  revalidatePath('/all')
  return task
}

export async function completeTask(id: string, actor: Actor = 'USER') {
  const existing = await prisma.task.findUnique({ where: { id } })
  if (!existing || existing.deletedAt) throw new Error('המשימה לא נמצאה')
  if (existing.status === 'DONE') return existing

  const task = await prisma.$transaction(async (tx) => {
    const updated = await tx.task.update({
      where: { id },
      data: { status: 'DONE', completedAt: new Date() },
    })
    await tx.taskEvent.create({
      data: {
        taskId: id,
        type: 'COMPLETED',
        actor,
        payload: JSON.stringify({ from: existing.status, to: 'DONE' }),
      },
    })
    await cancelPendingReminders(tx as unknown as ReminderTx, id)
    return updated
  })

  revalidatePath('/all')
  return task
}

export async function reopenTask(id: string, actor: Actor = 'USER') {
  const existing = await prisma.task.findUnique({ where: { id } })
  if (!existing || existing.deletedAt) throw new Error('המשימה לא נמצאה')
  if (existing.status !== 'DONE') return existing

  const now = new Date()
  const task = await prisma.$transaction(async (tx) => {
    const updated = await tx.task.update({
      where: { id },
      data: { status: 'OPEN', completedAt: null },
    })
    await tx.taskEvent.create({
      data: {
        taskId: id,
        type: 'REOPENED',
        actor,
        payload: JSON.stringify({ from: 'DONE', to: 'OPEN' }),
      },
    })
    // Re-create reminder if dueDate is still in the future.
    await syncAtTimeReminder(
      tx as unknown as ReminderTx,
      id,
      updated.dueDate,
      updated.dueHasTime,
      updated.status,
      now,
    )
    return updated
  })

  revalidatePath('/all')
  return task
}

export async function archiveTask(id: string) {
  const existing = await prisma.task.findUnique({ where: { id } })
  if (!existing || existing.deletedAt) throw new Error('המשימה לא נמצאה')
  if (existing.archivedAt) return existing

  const task = await prisma.$transaction(async (tx) => {
    const updated = await tx.task.update({
      where: { id },
      data: { archivedAt: new Date() },
    })
    await tx.taskEvent.create({
      data: {
        taskId: id,
        type: 'ARCHIVED',
        actor: 'USER',
        payload: JSON.stringify({ archivedAt: updated.archivedAt }),
      },
    })
    await cancelPendingReminders(tx as unknown as ReminderTx, id)
    return updated
  })

  revalidatePath('/all')
  return task
}

export async function restoreTask(id: string) {
  const existing = await prisma.task.findUnique({ where: { id } })
  if (!existing || existing.deletedAt) throw new Error('המשימה לא נמצאה')
  if (!existing.archivedAt) return existing

  const task = await prisma.$transaction(async (tx) => {
    const updated = await tx.task.update({
      where: { id },
      data: { archivedAt: null },
    })
    await tx.taskEvent.create({
      data: {
        taskId: id,
        type: 'RESTORED',
        actor: 'USER',
        payload: JSON.stringify({ from: 'archived' }),
      },
    })
    return updated
  })

  revalidatePath('/all')
  return task
}

export async function softDeleteTask(id: string, actor: Actor = 'USER') {
  const existing = await prisma.task.findUnique({ where: { id } })
  if (!existing || existing.deletedAt) return null

  await prisma.$transaction(async (tx) => {
    await tx.task.update({ where: { id }, data: { deletedAt: new Date() } })
    await tx.taskEvent.create({
      data: { taskId: id, type: 'DELETED', actor },
    })
    await cancelPendingReminders(tx as unknown as ReminderTx, id)
  })

  revalidatePath('/all')
  return { id }
}
