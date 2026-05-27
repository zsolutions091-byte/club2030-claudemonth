import { prisma } from '@/lib/db'
import { TaskList } from '@/components/views/TaskList'
import { StatusFilter } from '@/components/views/StatusFilter'
import { TaskCreateDialog } from '@/components/tasks/TaskCreateDialog'
import {
  TaskStatusEnum,
  type TaskStatusValue,
  type TaskPriorityValue,
} from '@/lib/validators/task'

function parseStatuses(raw: string | string[] | undefined): TaskStatusValue[] {
  if (!raw) return []
  const list = Array.isArray(raw) ? raw : raw.split(',')
  return list
    .map((s) => s.trim())
    .filter((s) => TaskStatusEnum.safeParse(s).success) as TaskStatusValue[]
}

export default async function AllTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const sp = await searchParams
  const activeStatuses = parseStatuses(sp.status)

  const [tasksRaw, projects] = await Promise.all([
    prisma.task.findMany({
      where: {
        deletedAt: null,
        archivedAt: null,
        parentTaskId: null,
        ...(activeStatuses.length > 0 ? { status: { in: activeStatuses } } : {}),
      },
      include: {
        project: { select: { id: true, name: true, color: true } },
      },
      orderBy: [{ priority: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
    }),
    prisma.project.findMany({
      where: { deletedAt: null, isArchived: false },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true },
    }),
  ])

  const tasks = tasksRaw.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status as TaskStatusValue,
    priority: t.priority as TaskPriorityValue,
    dueDate: t.dueDate ? t.dueDate.toISOString() : null,
    dueHasTime: t.dueHasTime,
    startDate: t.startDate ? t.startDate.toISOString() : null,
    project: t.project,
  }))

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">הכל</h1>
        <TaskCreateDialog projects={projects} />
      </div>

      <StatusFilter active={activeStatuses} />

      <TaskList tasks={tasks} projects={projects} />
    </div>
  )
}
