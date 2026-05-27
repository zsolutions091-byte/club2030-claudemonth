'use client'

import { useState } from 'react'
import { TaskRow, type TaskRowData } from '@/components/tasks/TaskRow'
import { TaskEditDialog } from '@/components/tasks/TaskEditDialog'
import type { TaskStatusValue, TaskPriorityValue } from '@/lib/validators/task'

type ProjectOption = { id: string; name: string }

type FullTask = TaskRowData & {
  description: string | null
  startDate: string | null
}

type TaskInitial = {
  id: string
  title: string
  description: string | null
  status: TaskStatusValue
  priority: TaskPriorityValue
  dueDate: string | null
  dueHasTime: boolean
  startDate: string | null
  projectId: string | null
}

export function TaskList({
  tasks,
  projects,
}: {
  tasks: FullTask[]
  projects: ProjectOption[]
}) {
  const [editing, setEditing] = useState<TaskInitial | null>(null)

  if (tasks.length === 0) {
    return (
      <div className="border border-dashed border-border rounded-lg p-12 text-center">
        <p className="text-muted-foreground">אין משימות. צור משימה חדשה כדי להתחיל.</p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-1">
        {tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            onEdit={() =>
              setEditing({
                id: task.id,
                title: task.title,
                description: task.description,
                status: task.status,
                priority: task.priority,
                dueDate: task.dueDate,
                dueHasTime: task.dueHasTime,
                startDate: task.startDate,
                projectId: task.project?.id ?? null,
              })
            }
          />
        ))}
      </div>

      <TaskEditDialog
        task={editing}
        projects={projects}
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      />
    </>
  )
}
