'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import {
  projectCreateSchema,
  projectUpdateSchema,
} from '@/lib/validators/project'

const MAX_DEPTH = 3 // PRD §4.2

async function depthOf(parentId: string): Promise<number> {
  let depth = 1
  let current: { parentId: string | null } | null = await prisma.project.findUnique({
    where: { id: parentId },
    select: { parentId: true },
  })
  while (current?.parentId) {
    depth += 1
    if (depth > MAX_DEPTH) return depth
    current = await prisma.project.findUnique({
      where: { id: current.parentId },
      select: { parentId: true },
    })
  }
  return depth
}

export async function createProject(rawInput: unknown) {
  const input = projectCreateSchema.parse(rawInput)

  if (input.parentId) {
    const parentDepth = await depthOf(input.parentId)
    if (parentDepth >= MAX_DEPTH) {
      throw new Error(`עומק היררכיה מקסימלי הוא ${MAX_DEPTH} רמות`)
    }
  }

  const project = await prisma.project.create({
    data: {
      name: input.name,
      color: input.color,
      icon: input.icon ?? null,
      parentId: input.parentId ?? null,
    },
  })

  revalidatePath('/all')
  revalidatePath('/')
  return project
}

export async function updateProject(id: string, rawInput: unknown) {
  const input = projectUpdateSchema.parse(rawInput)

  if (input.parentId === id) throw new Error('פרויקט לא יכול להיות הורה של עצמו')

  const project = await prisma.project.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.color !== undefined && { color: input.color }),
      ...(input.icon !== undefined && { icon: input.icon ?? null }),
      ...(input.parentId !== undefined && { parentId: input.parentId ?? null }),
    },
  })

  revalidatePath('/all')
  return project
}

export async function archiveProject(id: string) {
  const project = await prisma.project.update({
    where: { id },
    data: { isArchived: true, archivedAt: new Date() },
  })
  revalidatePath('/all')
  return project
}

export async function softDeleteProject(id: string) {
  const activeTasks = await prisma.task.count({
    where: { projectId: id, deletedAt: null, status: { not: 'DONE' } },
  })
  if (activeTasks > 0) {
    throw new Error(`לא ניתן למחוק פרויקט עם ${activeTasks} משימות פעילות. ארכב במקום.`)
  }

  await prisma.project.update({
    where: { id },
    data: { deletedAt: new Date() },
  })

  revalidatePath('/all')
  return { id }
}
