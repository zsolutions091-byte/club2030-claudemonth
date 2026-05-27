'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'

type Actor = 'USER' | 'WHATSAPP' | 'SYSTEM'

function normalizeName(raw: string): string {
  return raw.trim().slice(0, 60)
}

async function findOrCreateTag(name: string) {
  const clean = normalizeName(name)
  if (!clean) throw new Error('שם תגית ריק')
  const existing = await prisma.tag.findUnique({ where: { name: clean } })
  if (existing && !existing.deletedAt) return existing
  if (existing && existing.deletedAt) {
    return prisma.tag.update({
      where: { id: existing.id },
      data: { deletedAt: null },
    })
  }
  return prisma.tag.create({ data: { name: clean } })
}

export async function addTaskTag(
  taskId: string,
  tagName: string,
  actor: Actor = 'USER',
) {
  const task = await prisma.task.findUnique({ where: { id: taskId } })
  if (!task || task.deletedAt) throw new Error('המשימה לא נמצאה')

  const tag = await findOrCreateTag(tagName)

  await prisma.$transaction(async (tx) => {
    await tx.taskTag.upsert({
      where: { taskId_tagId: { taskId, tagId: tag.id } },
      create: { taskId, tagId: tag.id },
      update: {},
    })
    await tx.taskEvent.create({
      data: {
        taskId,
        type: 'UPDATED',
        actor,
        payload: JSON.stringify({ field: 'tags', op: 'add', tag: tag.name }),
      },
    })
  })

  revalidatePath('/all')
  return { tag }
}

export async function removeTaskTag(
  taskId: string,
  tagName: string,
  actor: Actor = 'USER',
) {
  const task = await prisma.task.findUnique({ where: { id: taskId } })
  if (!task || task.deletedAt) throw new Error('המשימה לא נמצאה')

  const clean = normalizeName(tagName)
  const tag = await prisma.tag.findUnique({ where: { name: clean } })
  if (!tag) throw new Error('התגית לא נמצאה')

  await prisma.$transaction(async (tx) => {
    await tx.taskTag.deleteMany({ where: { taskId, tagId: tag.id } })
    await tx.taskEvent.create({
      data: {
        taskId,
        type: 'UPDATED',
        actor,
        payload: JSON.stringify({ field: 'tags', op: 'remove', tag: tag.name }),
      },
    })
  })

  revalidatePath('/all')
  return { tag }
}
